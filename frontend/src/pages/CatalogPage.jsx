import { useMemo, useState } from "react";
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
  const resolvedTheme = resolveTheme(theme);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return products.filter((product) => {
      if (
        selectedCategoryId !== "all" &&
        String(product?.categoria_id ?? "") !== String(selectedCategoryId)
      ) {
        return false;
      }
      if (!normalizedQuery) return true;
      const haystack = [
        product.nombre,
        product.descripcion,
        product.badge_text,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [products, searchQuery, selectedCategoryId]);

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
