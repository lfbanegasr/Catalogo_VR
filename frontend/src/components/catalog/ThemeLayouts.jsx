import { useMemo } from "react";
import { buildAssetUrl } from "../../api/api";
import ProductCard from "../ProductCard";

function formatCategoryIcon(name = "") {
  const normalized = String(name).toLowerCase();
  if (normalized.includes("ropa")) return "R";
  if (normalized.includes("belleza")) return "B";
  if (normalized.includes("hogar")) return "H";
  if (normalized.includes("tecn")) return "T";
  if (normalized.includes("comida")) return "C";
  if (normalized.includes("zapato")) return "Z";
  return "•";
}

function ThemeHeader({ storeName, slug, title, subtitle, heroImageUrl, compact = false }) {
  return (
    <section className={`catalog-hero ${compact ? "compact" : ""}`}>
      <div className="catalog-hero-copy">
        <span className="catalog-kicker">{slug}</span>
        <h1>{title || storeName || "Catalogo"}</h1>
        <p>{subtitle}</p>
      </div>
      {heroImageUrl ? (
        <div className="catalog-hero-media">
          <img src={buildAssetUrl(heroImageUrl)} alt={storeName || "Banner de tienda"} />
        </div>
      ) : null}
    </section>
  );
}

function SearchBar({ value, onChange }) {
  return (
    <label className="catalog-search">
      <span>Buscar producto</span>
      <input
        value={value}
        autoComplete="off"
        placeholder="Nombre, descripcion o promo"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function CategoryNav({
  categories,
  selectedCategoryId,
  onSelectCategoryId,
  style = "chips",
  categoryImages = {},
}) {
  const items = [{ id: "all", nombre: "Todas" }, ...categories];
  return (
    <div className={`category-nav ${style}`} role="tablist" aria-label="Categorias">
      {items.map((category) => {
        const active = String(selectedCategoryId) === String(category.id);
        const categoryImage =
          categoryImages?.[String(category.id)] ||
          categoryImages?.[String(category.nombre || "").toLowerCase()] ||
          "";
        return (
          <button
            key={category.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`category-pill ${active ? "active" : ""}`}
            onClick={() => onSelectCategoryId(category.id)}
          >
            {style === "round_icons" ? (
              <span className="category-icon">
                {categoryImage ? (
                  <img src={buildAssetUrl(categoryImage)} alt={category.nombre} />
                ) : (
                  formatCategoryIcon(category.nombre)
                )}
              </span>
            ) : null}
            <span>{category.nombre}</span>
          </button>
        );
      })}
    </div>
  );
}

function OfferCarousel({ offers, products, onViewDetail }) {
  const cards = useMemo(() => {
    const offerProducts = products.filter((product) => product.id_oferta_aplicada != null);
    if (offers.length > 0) {
      return offers.map((offer) => {
        const linkedProduct = offerProducts.find(
          (product) =>
            String(product.id_oferta_aplicada || "") === String(offer.id_oferta || ""),
        );
        return {
          key: `offer-${offer.id_oferta}`,
          title: offer.nombre,
          subtitle:
            offer.tipo === "PERCENT" && offer.porcentaje != null
              ? `${offer.porcentaje}% de descuento`
              : "Precio especial",
          badge: offer.badge_text || null,
          imageUrl: offer.banner_url || linkedProduct?.imagen_url || "",
          product: linkedProduct || null,
        };
      });
    }

    return offerProducts.map((product) => ({
      key: `product-${product.id}`,
      title: product.nombre,
      subtitle: "Producto en oferta",
      badge: product.badge_text || (product.descuento_pct != null ? `-${Math.round(product.descuento_pct)}%` : null),
      imageUrl: product.imagen_url || "",
      product,
    }));
  }, [offers, products]);

  if (cards.length === 0) return null;

  return (
    <section className="catalog-section">
      <div className="catalog-section-head">
        <div>
          <span className="catalog-section-kicker">Promociones</span>
          <h2>En oferta</h2>
        </div>
      </div>
      <div className="offer-carousel">
        {cards.map((card) => (
          <article key={card.key} className="offer-carousel-card">
            {card.imageUrl ? (
              <img src={buildAssetUrl(card.imageUrl)} alt={card.title} />
            ) : (
              <div className="offer-carousel-empty">Oferta</div>
            )}
            <div className="offer-carousel-body">
              <p>{card.title}</p>
              <span>{card.subtitle}</span>
              {card.badge ? <strong>{card.badge}</strong> : null}
              {card.product ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => onViewDetail(card.product)}
                >
                  Ver producto
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function FeaturedSection({ products, onViewDetail }) {
  if (!products.length) return null;
  return (
    <section className="catalog-section">
      <div className="catalog-section-head">
        <div>
          <span className="catalog-section-kicker">Seleccion</span>
          <h2>Destacados</h2>
        </div>
      </div>
      <div className="product-row">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} onViewDetail={onViewDetail} compact />
        ))}
      </div>
    </section>
  );
}

function ProductGridSection({ title, products, onViewDetail }) {
  return (
    <section className="catalog-section">
      <div className="catalog-section-head">
        <div>
          <span className="catalog-section-kicker">Catalogo</span>
          <h2>{title}</h2>
        </div>
        <span>{products.length} resultados</span>
      </div>
      {products.length === 0 ? (
        <div className="catalog-empty">
          <p>No hay productos para este filtro.</p>
        </div>
      ) : (
        <div className="products-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} onViewDetail={onViewDetail} />
          ))}
        </div>
      )}
    </section>
  );
}

function CatalogState({ loading, error, onRetry }) {
  if (loading) {
    return (
      <section className="catalog-section catalog-state">
        <div className="loading-pulse" />
        <p>Cargando catalogo...</p>
      </section>
    );
  }
  if (!error) return null;
  return (
    <section className="catalog-section catalog-state">
      <p>{error}</p>
      <button className="btn btn-primary" type="button" onClick={onRetry}>
        Reintentar
      </button>
    </section>
  );
}

export function ModernBannerTheme(props) {
  const {
    slug,
    storeName,
    themeConfig,
    categories,
    selectedCategoryId,
    onSelectCategoryId,
    searchQuery,
    onSearchQueryChange,
    filteredProducts,
    featuredProducts,
    offerProducts,
    offers,
    loading,
    error,
    onRetry,
    onViewDetail,
  } = props;

  return (
    <main className="catalog-shell modern-banner">
      <div className="catalog-container">
        <ThemeHeader
          storeName={storeName}
          slug={slug}
          title={storeName}
          subtitle="Coleccion destacada, categorias visuales y ofertas activas."
          heroImageUrl={themeConfig.hero_image_url}
        />
        <section className="catalog-section toolbar">
          <SearchBar value={searchQuery} onChange={onSearchQueryChange} />
          <CategoryNav
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategoryId={onSelectCategoryId}
            style={themeConfig.category_style}
            categoryImages={themeConfig.category_images}
          />
        </section>
        <CatalogState loading={loading} error={error} onRetry={onRetry} />
        {!loading && !error ? (
          <>
            {themeConfig.show_featured ? (
              <FeaturedSection products={featuredProducts} onViewDetail={onViewDetail} />
            ) : null}
            {themeConfig.show_offers ? (
              <OfferCarousel offers={offers} products={offerProducts} onViewDetail={onViewDetail} />
            ) : null}
            <ProductGridSection
              title="Todos los productos"
              products={filteredProducts}
              onViewDetail={onViewDetail}
            />
          </>
        ) : null}
      </div>
    </main>
  );
}

export function SoftBeigeTheme(props) {
  const {
    slug,
    storeName,
    themeConfig,
    categories,
    selectedCategoryId,
    onSelectCategoryId,
    searchQuery,
    onSearchQueryChange,
    filteredProducts,
    offerProducts,
    offers,
    loading,
    error,
    onRetry,
    onViewDetail,
  } = props;

  return (
    <main className="catalog-shell soft-beige">
      <div className="catalog-container">
        <ThemeHeader
          storeName={storeName}
          slug={slug}
          title={storeName}
          subtitle="Catalogo simple con foco en busqueda, categorias y ofertas."
          compact
        />
        <section className="catalog-section toolbar">
          <SearchBar value={searchQuery} onChange={onSearchQueryChange} />
          <CategoryNav
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategoryId={onSelectCategoryId}
            style={themeConfig.category_style}
            categoryImages={themeConfig.category_images}
          />
        </section>
        <CatalogState loading={loading} error={error} onRetry={onRetry} />
        {!loading && !error ? (
          <>
            <OfferCarousel offers={offers} products={offerProducts} onViewDetail={onViewDetail} />
            <ProductGridSection
              title="Productos"
              products={filteredProducts}
              onViewDetail={onViewDetail}
            />
          </>
        ) : null}
      </div>
    </main>
  );
}

export function MinimalCleanTheme(props) {
  const {
    slug,
    storeName,
    themeConfig,
    categories,
    selectedCategoryId,
    onSelectCategoryId,
    searchQuery,
    onSearchQueryChange,
    filteredProducts,
    offerProducts,
    offers,
    loading,
    error,
    onRetry,
    onViewDetail,
  } = props;

  return (
    <main className="catalog-shell minimal-clean">
      <div className="catalog-container">
        <section className="catalog-section minimal-head">
          <div>
            <span className="catalog-kicker">{slug}</span>
            <h1>{storeName || "Catalogo"}</h1>
          </div>
          <SearchBar value={searchQuery} onChange={onSearchQueryChange} />
        </section>
        <CategoryNav
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onSelectCategoryId={onSelectCategoryId}
          style={themeConfig.category_style}
          categoryImages={themeConfig.category_images}
        />
        <CatalogState loading={loading} error={error} onRetry={onRetry} />
        {!loading && !error ? (
          <>
            {offers.length > 0 || offerProducts.length > 0 ? (
              <OfferCarousel offers={offers} products={offerProducts} onViewDetail={onViewDetail} />
            ) : null}
            <ProductGridSection
              title="Catalogo completo"
              products={filteredProducts}
              onViewDetail={onViewDetail}
            />
          </>
        ) : null}
      </div>
    </main>
  );
}
