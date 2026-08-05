import { useEffect, useMemo, useRef, useState } from "react";
import { registerPublicEvent } from "../api/api";
import {
  MinimalCleanTheme,
  ModernBannerTheme,
  SoftBeigeTheme,
} from "../components/catalog/ThemeLayouts";
import { resolveTheme } from "../theme/theme";

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

function CatalogPage({
  slug,
  storeName,
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
  const selectedCategoryIds = useMemo(() => {
    if (selectedCategoryId === "all") return null;
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
      !selectedCategoryIds
      || selectedCategoryIds.has(String(product?.categoria_id ?? ""))
    )),
    [products, selectedCategoryIds],
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

  const offerProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product.id_oferta_aplicada != null ||
          (product.precio_original || 0) > (product.precio_final || 0),
      ),
    [products],
  );

  const ThemeComponent = THEME_COMPONENTS[resolvedTheme.themeId] || ModernBannerTheme;

  return (
    <ThemeComponent
      slug={slug}
      storeName={storeName}
      categories={categories}
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
  );
}

export default CatalogPage;
