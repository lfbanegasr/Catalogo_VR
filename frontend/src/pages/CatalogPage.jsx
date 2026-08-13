import { useEffect, useMemo, useRef, useState } from "react";
import { registerPublicEvent } from "../api/api";
import {
  MinimalCleanTheme,
  ModernBannerTheme,
  SoftBeigeTheme,
} from "../components/catalog/ThemeLayouts";
import { resolveTheme } from "../theme/theme";
import StorefrontHeader from "../components/StorefrontHeader";

const THEME_COMPONENTS = {
  modern_banner: ModernBannerTheme,
  soft_beige: SoftBeigeTheme,
  minimal_clean: MinimalCleanTheme,
};

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isOfferProduct(product) {
  return product.id_oferta_aplicada != null
    || Number(product.precio_original || 0) > Number(product.precio_final || 0);
}

function expandVariantCards(products) {
  return products.flatMap((product) => {
    const variants = Array.isArray(product.variantes) ? product.variantes : [];
    if (variants.length === 0) {
      return [{ ...product, catalog_card_id: String(product.id) }];
    }
    return variants.map((variant) => {
      const variantId = String(variant.id_variante);
      const variantAttributes = (Array.isArray(variant.atributos) ? variant.atributos : [])
        .map((attribute) => ({
          ...attribute,
          tipo_dato: attribute.tipo_dato || "OPTION",
          filtrable: attribute.filtrable ?? true,
        }));
      const variantAttributeIds = new Set(
        variantAttributes.map((attribute) => String(attribute.id_atributo)),
      );
      const baseAttributes = (Array.isArray(product.atributos) ? product.atributos : [])
        .filter((attribute) => !variantAttributeIds.has(String(attribute.id_atributo)));
      return {
        ...product,
        catalog_card_id: String(product.id) + ":" + variantId,
        catalog_variant_id: variantId,
        nombre: product.nombre + " - " + (variant.nombre || variant.sku),
        precio: variant.precio ?? product.precio,
        precio_original: variant.precio_original ?? product.precio_original,
        precio_final: variant.precio_final ?? product.precio_final,
        descuento_pct: variant.descuento_pct ?? product.descuento_pct,
        stock: Number(variant.stock ?? 0),
        imagen_url: variant.imagen_url || product.imagen_url,
        imagen_fit: variant.imagen_fit || product.imagen_fit,
        imagen_posicion_x: variant.imagen_posicion_x ?? product.imagen_posicion_x,
        imagen_posicion_y: variant.imagen_posicion_y ?? product.imagen_posicion_y,
        imagen_zoom: variant.imagen_zoom ?? product.imagen_zoom,
        imagen_fondo: variant.imagen_fondo || product.imagen_fondo,
        atributos: [...baseAttributes, ...variantAttributes],
        variantes: variants.map((item) => ({
          ...item,
          es_predeterminada: String(item.id_variante) === variantId,
        })),
      };
    });
  });
}


function CatalogPage({
  slug,
  storeName,
  whatsappNumber,
  categories,
  products,
  offers,
  theme,
  loading,
  error,
  selectedCategoryId,
  onSelectCategoryId,
  onViewDetail,
  onRetry,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [attributeFilters, setAttributeFilters] = useState({});
  const trackedSearches = useRef(new Set());
  const resolvedTheme = resolveTheme(theme);
  products = expandVariantCards(products);
  const offerProducts = useMemo(() => products.filter(isOfferProduct), [products]);
  const catalogCategories = useMemo(
    () => offerProducts.length
      ? [{ id: "offers", nombre: "Ofertas", virtual: true }, ...categories]
      : categories,
    [categories, offerProducts.length],
  );
  const selectedCategoryIds = useMemo(() => {
    if (selectedCategoryId === "all" || selectedCategoryId === "offers") return null;
    const childrenByParent = new Map();
    categories.forEach((category) => {
      const parentId = category.id_categoria_padre || null;
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId).push(String(category.id));
    });
    const selectedIds = new Set([String(selectedCategoryId)]);
    const pending = [String(selectedCategoryId)];
    while (pending.length > 0) {
      const currentId = pending.pop();
      (childrenByParent.get(currentId) || []).forEach((childId) => {
        if (!selectedIds.has(childId)) {
          selectedIds.add(childId);
          pending.push(childId);
        }
      });
    }
    return selectedIds;
  }, [categories, selectedCategoryId]);
  useEffect(() => {
    setAttributeFilters({});
  }, [selectedCategoryId]);
  useEffect(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (normalized.length < 2 || trackedSearches.current.has(normalized)) return undefined;
    const timeoutId = window.setTimeout(() => {
      trackedSearches.current.add(normalized);
      registerPublicEvent(slug, "search");
    }, 900);
    return () => window.clearTimeout(timeoutId);
  }, [searchQuery, slug]);

  const categoryProducts = useMemo(
    () => products.filter((product) => (
      selectedCategoryId === "offers"
        ? isOfferProduct(product)
        : (!selectedCategoryIds || selectedCategoryIds.has(String(product?.categoria_id ?? "")))
    )),
    [products, selectedCategoryId, selectedCategoryIds],
  );
  const availableAttributeFilters = useMemo(() => {
    const filters = new Map();
    categoryProducts.forEach((product) => {
      (Array.isArray(product.atributos) ? product.atributos : [])
        .filter((attribute) => attribute.filtrable)
        .forEach((attribute) => {
          if (!filters.has(attribute.codigo)) {
            filters.set(attribute.codigo, {
              codigo: attribute.codigo,
              nombre: attribute.nombre,
              values: new Set(),
            });
          }
          const displayValue = attribute.tipo_dato === "BOOLEAN"
            ? (attribute.valor ? "Si" : "No")
            : String(attribute.valor);
          filters.get(attribute.codigo).values.add(displayValue);
        });
    });
    return Array.from(filters.values()).map((filter) => ({
      ...filter,
      values: Array.from(filter.values).sort((a, b) => a.localeCompare(b)),
    }));
  }, [categoryProducts]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchQuery);
    return categoryProducts.filter((product) => {
      const productAttributes = Array.isArray(product.atributos) ? product.atributos : [];
      const matchesAttributes = Object.entries(attributeFilters).every(([code, expected]) => {
        if (!expected) return true;
        return productAttributes.some((attribute) => {
          if (attribute.codigo !== code) return false;
          const value = attribute.tipo_dato === "BOOLEAN"
            ? (attribute.valor ? "Si" : "No")
            : String(attribute.valor);
          return value === expected;
        });
      });
      if (!matchesAttributes) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        product.nombre,
        product.descripcion,
        product.badge_text,
        ...productAttributes.flatMap((attribute) => [
          attribute.nombre,
          attribute.valor,
        ]),
        ...(Array.isArray(product.variantes) ? product.variantes : []).flatMap((variant) => [
          variant.sku,
          variant.nombre,
          ...(Array.isArray(variant.atributos)
            ? variant.atributos.flatMap((attribute) => [attribute.nombre, attribute.valor])
            : []),
        ]),
      ]
        .filter(Boolean)
        .join(" ")
      const normalizedHaystack = normalizeSearchText(haystack);
      return normalizedHaystack.includes(normalizedQuery);
    });
  }, [categoryProducts, searchQuery, attributeFilters]);

  const featuredProducts = useMemo(
    () =>
      filteredProducts
        .filter((product) => product.badge_text || product.descuento_pct != null)
        .slice(0, 4)
        .concat(filteredProducts.slice(0, 4))
        .filter((product, index, array) => array.findIndex((item) => item.id === product.id) === index)
        .slice(0, 4),
    [filteredProducts],
  );

  const ThemeComponent = THEME_COMPONENTS[resolvedTheme.themeId] || ModernBannerTheme;

  return (
    <>
      <StorefrontHeader storeName={storeName} themeConfig={resolvedTheme.config} whatsappNumber={whatsappNumber} />
      <ThemeComponent
      slug={slug}
      storeName={storeName}
      categories={catalogCategories}
      products={products}
      offers={offers}
      themeConfig={resolvedTheme.config}
      selectedCategoryId={selectedCategoryId}
      onSelectCategoryId={onSelectCategoryId}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      availableAttributeFilters={availableAttributeFilters}
      attributeFilters={attributeFilters}
      onAttributeFilterChange={(code, value) => setAttributeFilters((current) => ({
        ...current,
        [code]: value,
      }))}
      onClearAttributeFilters={() => setAttributeFilters({})}
      filteredProducts={filteredProducts}
      featuredProducts={featuredProducts}
      offerProducts={offerProducts}
      loading={loading}
      error={error}
      onRetry={onRetry}
      onViewDetail={onViewDetail}
      />
    </>
  );
}

export default CatalogPage;
