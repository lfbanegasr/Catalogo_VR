import { useState, useMemo } from "react";
import { buildAssetUrl } from "../../api/api";
import ProductCard from "../ProductCard";

function formatCategoryIcon(name = "") {
  const normalized = String(name).toLowerCase();
  if (normalized.includes("oferta")) return "%";
  if (normalized.includes("ropa")) return "R";
  if (normalized.includes("belleza")) return "B";
  if (normalized.includes("hogar")) return "H";
  if (normalized.includes("tecn")) return "T";
  if (normalized.includes("comida")) return "C";
  if (normalized.includes("zapato")) return "Z";
  return "•";
}

function ThemeHeader({ storeName, heroImageUrl, config = {} }) {
  if (!heroImageUrl) return null;

  return (
    <section className="catalog-banner" aria-label={"Banner de " + (storeName || "la tienda")}>
      <img
        src={buildAssetUrl(heroImageUrl)}
        alt=""
        aria-hidden="true"
        className={"fit-" + (config.hero_image_fit || "cover")}
        loading="eager"
        decoding="async"
        fetchPriority="high"
      />
    </section>
  );
}
function SearchBar({ value, onChange }) {
  return (
    <label className={"catalog-search " + (value ? "has-value" : "")} aria-label="Buscar producto">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.6-3.6" />
      </svg>
      <input
        value={value}
        autoComplete="off"
        placeholder="Buscar productos..."
        onChange={(event) => onChange(event.target.value)}
      />
      {value ? (
        <button type="button" className="search-clear-btn" onClick={() => onChange("")} aria-label="Limpiar búsqueda">×</button>
      ) : null}
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
  const categoryById = new Map(categories.map((category) => [String(category.id), category]));
  const categoryLabel = (category) => {
    if (category.id === "all") return category.nombre;
    const names = [category.nombre];
    const visited = new Set([String(category.id)]);
    let parentId = category.id_categoria_padre;
    while (parentId && categoryById.has(String(parentId)) && !visited.has(String(parentId))) {
      visited.add(String(parentId));
      const parent = categoryById.get(String(parentId));
      names.unshift(parent.nombre);
      parentId = parent.id_categoria_padre;
    }
    return names.join(" > ");
  };
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
                  <img
                    src={buildAssetUrl(categoryImage)}
                    alt={category.nombre}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  formatCategoryIcon(category.nombre)
                )}
              </span>
            ) : null}
            <span>{categoryLabel(category)}</span>
          </button>
        );
      })}
    </div>
  );
}

function AttributeFilters({
  filters,
  values,
  onChange,
  onClear,
  totalResults,
}) {
  const [isOpen, setIsOpen] = useState(false);

  const hasFilters = Boolean(filters?.length);
  const activeEntries = Object.entries(values || {}).filter(([_, val]) => Boolean(val));
  const activeCount = activeEntries.length;

  return (
    <div className="catalog-filters-wrapper">
      <div className="filter-trigger-bar">
        <button
          type="button"
          className={`filter-toggle-btn ${activeCount > 0 ? "has-active" : ""}`}
          onClick={() => hasFilters && setIsOpen(true)}
          disabled={!hasFilters}
          aria-label={hasFilters ? "Abrir filtros" : "No hay filtros disponibles"}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span>Filtros</span>
          {activeCount > 0 ? <span className="filter-badge">{activeCount}</span> : null}
        </button>

        {activeCount > 0 ? (
          <div className="filter-active-chips">
            {activeEntries.map(([code, value]) => {
              const filterDef = filters.find((f) => f.codigo === code);
              const label = filterDef ? filterDef.nombre : code;
              return (
                <span key={code} className="filter-active-chip">
                  <span className="chip-label">{label}: <strong>{value}</strong></span>
                  <button
                    type="button"
                    className="chip-remove-btn"
                    title="Remover filtro"
                    onClick={() => onChange(code, "")}
                  >
                    ✕
                  </button>
                </span>
              );
            })}
            <button type="button" className="clear-all-link" onClick={onClear}>
              Limpiar todo
            </button>
          </div>
        ) : null}
      </div>

      {isOpen && hasFilters ? (
        <div className="filter-modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="filter-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="filter-modal-header">
              <div className="filter-modal-title">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <h3>Filtros de productos</h3>
              </div>
              <div className="filter-modal-header-actions">
                {activeCount > 0 ? (
                  <button type="button" className="modal-clear-btn" onClick={onClear}>
                    Limpiar todo
                  </button>
                ) : null}
                <button type="button" className="modal-close-btn" onClick={() => setIsOpen(false)}>
                  ✕
                </button>
              </div>
            </div>

            <div className="filter-modal-body">
              <div className="filter-grid-list">
                {filters.map((filter) => {
                  const currentValue = values[filter.codigo] || "";
                  return (
                    <div key={filter.codigo} className="filter-group-item">
                      <label className="filter-group-title">{filter.nombre}</label>
                      <div className="filter-options-pills">
                        <button
                          type="button"
                          className={`filter-option-pill ${currentValue === "" ? "selected" : ""}`}
                          onClick={() => onChange(filter.codigo, "")}
                        >
                          Todos
                        </button>
                        {filter.values.map((val) => {
                          const isSelected = currentValue === val;
                          return (
                            <button
                              key={val}
                              type="button"
                              className={`filter-option-pill ${isSelected ? "selected" : ""}`}
                              onClick={() => onChange(filter.codigo, val)}
                            >
                              {val}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="filter-modal-footer">
              <button
                type="button"
                className="btn btn-primary modal-apply-btn"
                onClick={() => setIsOpen(false)}
              >
                Ver {totalResults !== undefined ? `${totalResults} ` : ""}resultados
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
              <img
                src={buildAssetUrl(card.imageUrl)}
                alt={card.title}
                loading="lazy"
                decoding="async"
              />
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
          <ProductCard key={product.catalog_card_id || product.id} product={product} onViewDetail={onViewDetail} compact />
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
            <ProductCard key={product.catalog_card_id || product.id} product={product} onViewDetail={onViewDetail} />
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
    availableAttributeFilters,
    attributeFilters,
    onAttributeFilterChange,
    onClearAttributeFilters,
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
        {themeConfig.hero_image_url ? (
          <section className="catalog-banner modern-banner-cover" aria-label={"Banner de " + (storeName || "la tienda")}>
            <img
              src={buildAssetUrl(themeConfig.hero_image_url)}
              alt=""
              aria-hidden="true"
              className={"fit-" + (themeConfig.hero_image_fit || "cover")}
              loading="eager"
              decoding="async"
              fetchPriority="high"
            />
            {(themeConfig.hero_title || themeConfig.hero_subtitle) && (
              <div className="modern-banner-overlay">
                {themeConfig.hero_kicker ? <span className="modern-banner-kicker">{themeConfig.hero_kicker}</span> : null}
                <h1 className="modern-banner-title">{themeConfig.hero_title || storeName}</h1>
                {themeConfig.hero_subtitle ? <p className="modern-banner-sub">{themeConfig.hero_subtitle}</p> : null}
              </div>
            )}
          </section>
        ) : (
          <header className="modern-banner-hero">
            <div className="modern-banner-hero-content">
              <span className="modern-banner-kicker">{themeConfig.hero_kicker || "COLECCIÓN DESTACADA"}</span>
              <h1 className="modern-banner-title">{themeConfig.hero_title || storeName || "Catálogo Oficial"}</h1>
              <p className="modern-banner-sub">
                {themeConfig.hero_subtitle || "Explora las últimas novedades, disponibilidad inmediata y ofertas especiales."}
              </p>
            </div>
          </header>
        )}

        {themeConfig.hero_offer_text && (
          <div className="modern-banner-promo-strip">
            <span className="promo-fire">🔥</span>
            <strong>{themeConfig.hero_offer_text}</strong>
          </div>
        )}

        <section className="catalog-section toolbar">
          <SearchBar value={searchQuery} onChange={onSearchQueryChange} />
          <CategoryNav
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategoryId={onSelectCategoryId}
            style={themeConfig.category_style}
            categoryImages={themeConfig.category_images}
          />
          <AttributeFilters
            filters={availableAttributeFilters}
            values={attributeFilters}
            onChange={onAttributeFilterChange}
            onClear={onClearAttributeFilters}
            totalResults={filteredProducts?.length}
          />
        </section>

        <CatalogState loading={loading} error={error} onRetry={onRetry} />

        {!loading && !error ? (
          <>
            {themeConfig.show_featured && featuredProducts?.length > 0 ? (
              <FeaturedSection products={featuredProducts} onViewDetail={onViewDetail} />
            ) : null}
            {themeConfig.show_offers && (offers.length > 0 || offerProducts.length > 0) ? (
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
    availableAttributeFilters,
    attributeFilters,
    onAttributeFilterChange,
    onClearAttributeFilters,
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
    <main className="catalog-shell soft-beige">
      <div className="catalog-container">
        {themeConfig.hero_image_url ? (
          <section className="catalog-banner soft-beige-cover" aria-label={"Banner de " + (storeName || "la tienda")}>
            <img
              src={buildAssetUrl(themeConfig.hero_image_url)}
              alt=""
              aria-hidden="true"
              className={"fit-" + (themeConfig.hero_image_fit || "cover")}
              loading="eager"
              decoding="async"
              fetchPriority="high"
            />
          </section>
        ) : (
          <header className="soft-beige-hero">
            <span className="soft-beige-kicker">{themeConfig.hero_kicker || "SELECCIÓN EXCLUSIVA"}</span>
            <h1 className="soft-beige-title">{themeConfig.hero_title || storeName || "Boutique & Bienestar"}</h1>
            <p className="soft-beige-subtitle">
              {themeConfig.hero_subtitle || "Piezas seleccionadas con dedicación, texturas naturales y diseño armónico."}
            </p>
          </header>
        )}

        {themeConfig.hero_offer_text && (
          <div className="soft-beige-promo-chip">
            <span className="soft-beige-promo-dot">✨</span>
            <span>{themeConfig.hero_offer_text}</span>
          </div>
        )}

        <section className="catalog-section toolbar">
          <SearchBar value={searchQuery} onChange={onSearchQueryChange} />
          <CategoryNav
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategoryId={onSelectCategoryId}
            style={themeConfig.category_style}
            categoryImages={themeConfig.category_images}
          />
          <AttributeFilters
            filters={availableAttributeFilters}
            values={attributeFilters}
            onChange={onAttributeFilterChange}
            onClear={onClearAttributeFilters}
            totalResults={filteredProducts?.length}
          />
        </section>

        <CatalogState loading={loading} error={error} onRetry={onRetry} />

        {!loading && !error ? (
          <>
            {themeConfig.show_offers && (offers.length > 0 || offerProducts.length > 0) ? (
              <OfferCarousel offers={offers} products={offerProducts} onViewDetail={onViewDetail} />
            ) : null}
            {themeConfig.show_featured && featuredProducts?.length > 0 ? (
              <FeaturedSection products={featuredProducts} onViewDetail={onViewDetail} />
            ) : null}
            <ProductGridSection
              title="Colección"
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
    availableAttributeFilters,
    attributeFilters,
    onAttributeFilterChange,
    onClearAttributeFilters,
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
    <main className="catalog-shell minimal-clean">
      <div className="catalog-container">
        {themeConfig.hero_image_url ? (
          <section className="catalog-banner minimal-clean-cover" aria-label={"Banner de " + (storeName || "la tienda")}>
            <img
              src={buildAssetUrl(themeConfig.hero_image_url)}
              alt=""
              aria-hidden="true"
              className={"fit-" + (themeConfig.hero_image_fit || "cover")}
              loading="eager"
              decoding="async"
              fetchPriority="high"
            />
          </section>
        ) : null}

        <section className="minimal-clean-hero">
          <div className="minimal-clean-head-left">
            <span className="minimal-clean-kicker">{themeConfig.hero_kicker || (slug ? `@${slug}` : "CATÁLOGO OFICIAL")}</span>
            <h1 className="minimal-clean-title">{themeConfig.hero_title || storeName || "Catálogo Digital"}</h1>
            <p className="minimal-clean-subtitle">
              {themeConfig.hero_subtitle || "Explora todo nuestro inventario con entrega rápida y disponibilidad en tiempo real."}
            </p>
          </div>
        </section>

        {themeConfig.hero_offer_text && (
          <div className="minimal-clean-promo-bar">
            <span className="minimal-clean-promo-badge">PROMO</span>
            <span className="minimal-clean-promo-text">{themeConfig.hero_offer_text}</span>
          </div>
        )}

        <section className="catalog-section toolbar minimal-toolbar">
          <SearchBar value={searchQuery} onChange={onSearchQueryChange} />
          <CategoryNav
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategoryId={onSelectCategoryId}
            style={themeConfig.category_style}
            categoryImages={themeConfig.category_images}
          />
          <AttributeFilters
            filters={availableAttributeFilters}
            values={attributeFilters}
            onChange={onAttributeFilterChange}
            onClear={onClearAttributeFilters}
            totalResults={filteredProducts?.length}
          />
        </section>

        <CatalogState loading={loading} error={error} onRetry={onRetry} />

        {!loading && !error ? (
          <>
            {themeConfig.show_offers && (offers.length > 0 || offerProducts.length > 0) ? (
              <OfferCarousel offers={offers} products={offerProducts} onViewDetail={onViewDetail} />
            ) : null}
            {themeConfig.show_featured && featuredProducts?.length > 0 ? (
              <FeaturedSection products={featuredProducts} onViewDetail={onViewDetail} />
            ) : null}
            <ProductGridSection
              title="Catálogo Completo"
              products={filteredProducts}
              onViewDetail={onViewDetail}
            />
          </>
        ) : null}
      </div>
    </main>
  );
}

export function LuxeMinimalTheme(props) {
  const {
    slug,
    storeName,
    themeConfig,
    categories,
    selectedCategoryId,
    onSelectCategoryId,
    searchQuery,
    onSearchQueryChange,
    availableAttributeFilters,
    attributeFilters,
    onAttributeFilterChange,
    onClearAttributeFilters,
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
    <main className="catalog-shell luxe-minimal">
      <div className="catalog-container">
        {themeConfig.hero_image_url ? (
          <ThemeHeader
            storeName={storeName}
            slug={slug}
            heroImageUrl={themeConfig.hero_image_url}
            config={themeConfig}
          />
        ) : (
          <header className="luxe-editorial-hero">
            <span className="luxe-kicker">{themeConfig.hero_kicker || "NUEVA COLECCIÓN"}</span>
            <h1 className="luxe-title">{storeName || "Boutique"}</h1>
            <p className="luxe-subtitle">
              {themeConfig.hero_subtitle || "Prendas y piezas seleccionadas con estética impecable y diseño contemporáneo."}
            </p>
          </header>
        )}

        <section className="catalog-section toolbar luxe-toolbar">
          <SearchBar value={searchQuery} onChange={onSearchQueryChange} />
          <CategoryNav
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategoryId={onSelectCategoryId}
            style={themeConfig.category_style || "chips"}
            categoryImages={themeConfig.category_images}
          />
          <AttributeFilters
            filters={availableAttributeFilters}
            values={attributeFilters}
            onChange={onAttributeFilterChange}
            onClear={onClearAttributeFilters}
            totalResults={filteredProducts?.length}
          />
        </section>

        <CatalogState loading={loading} error={error} onRetry={onRetry} />

        {!loading && !error ? (
          <>
            {themeConfig.show_offers && (offers.length > 0 || offerProducts.length > 0) ? (
              <OfferCarousel offers={offers} products={offerProducts} onViewDetail={onViewDetail} />
            ) : null}

            {themeConfig.show_featured && featuredProducts?.length > 0 ? (
              <FeaturedSection products={featuredProducts} onViewDetail={onViewDetail} />
            ) : null}

            <ProductGridSection
              title="Colección Completa"
              products={filteredProducts}
              onViewDetail={onViewDetail}
            />
          </>
        ) : null}
      </div>
    </main>
  );
}

export function UrbanStreetTheme(props) {
  const {
    slug,
    storeName,
    themeConfig,
    categories,
    selectedCategoryId,
    onSelectCategoryId,
    searchQuery,
    onSearchQueryChange,
    availableAttributeFilters,
    attributeFilters,
    onAttributeFilterChange,
    onClearAttributeFilters,
    filteredProducts,
    featuredProducts,
    offerProducts,
    offers,
    loading,
    error,
    onRetry,
    onViewDetail,
  } = props;

  const tickerText = themeConfig.hero_offer_text || "• NUEVOS DROPS • STOCK LIMITADO • ENVÍO RÁPIDO • EXCLUSIVO EN LÍNEA •";

  return (
    <main className="catalog-shell urban-street">
      {/* Ticker continuo superior */}
      <div className="urban-ticker-bar" aria-hidden="true">
        <div className="urban-ticker-track">
          <span>{tickerText}</span>
          <span>{tickerText}</span>
          <span>{tickerText}</span>
        </div>
      </div>

      <div className="catalog-container">
        {themeConfig.hero_image_url ? (
          <ThemeHeader
            storeName={storeName}
            slug={slug}
            heroImageUrl={themeConfig.hero_image_url}
            config={themeConfig}
          />
        ) : (
          <header className="urban-header-hero">
            <div className="urban-badge-row">
              <span className="urban-tag">{themeConfig.hero_kicker || "DROP 2026"}</span>
              <span className="urban-pulse-dot">● EN VIVO</span>
            </div>
            <h1 className="urban-main-title">{themeConfig.hero_title || storeName || "STREETWEAR STUDIO"}</h1>
            <p className="urban-sub">
              {themeConfig.hero_subtitle || "Prendas urbanas, calzado y accesorios seleccionados con actitud y tendencia."}
            </p>
          </header>
        )}

        <section className="catalog-section toolbar urban-toolbar">
          <SearchBar value={searchQuery} onChange={onSearchQueryChange} />
          <CategoryNav
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategoryId={onSelectCategoryId}
            style={themeConfig.category_style || "chips"}
            categoryImages={themeConfig.category_images}
          />
          <AttributeFilters
            filters={availableAttributeFilters}
            values={attributeFilters}
            onChange={onAttributeFilterChange}
            onClear={onClearAttributeFilters}
            totalResults={filteredProducts?.length}
          />
        </section>

        <CatalogState loading={loading} error={error} onRetry={onRetry} />

        {!loading && !error ? (
          <>
            {themeConfig.show_offers && (offers.length > 0 || offerProducts.length > 0) ? (
              <OfferCarousel offers={offers} products={offerProducts} onViewDetail={onViewDetail} />
            ) : null}

            {themeConfig.show_featured && featuredProducts?.length > 0 ? (
              <FeaturedSection products={featuredProducts} onViewDetail={onViewDetail} />
            ) : null}

            <ProductGridSection
              title="Catálogo & Drops"
              products={filteredProducts}
              onViewDetail={onViewDetail}
            />
          </>
        ) : null}
      </div>
    </main>
  );
}

export function TechModernTheme(props) {
  const {
    slug,
    storeName,
    themeConfig,
    categories,
    selectedCategoryId,
    onSelectCategoryId,
    searchQuery,
    onSearchQueryChange,
    availableAttributeFilters,
    attributeFilters,
    onAttributeFilterChange,
    onClearAttributeFilters,
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
    <main className="catalog-shell tech-modern">
      <div className="catalog-container">
        {themeConfig.hero_image_url ? (
          <ThemeHeader
            storeName={storeName}
            slug={slug}
            heroImageUrl={themeConfig.hero_image_url}
            config={themeConfig}
          />
        ) : (
          <header className="tech-hero-card">
            <div className="tech-hero-content">
              <span className="tech-chip">{themeConfig.hero_kicker || "TECH & INNOVACIÓN"}</span>
              <h1 className="tech-title">{themeConfig.hero_title || storeName || "Tech Store"}</h1>
              <p className="tech-desc">
                {themeConfig.hero_subtitle || "Gadgets de última generación, accesorios inteligentes y catálogo especializado."}
              </p>
            </div>
          </header>
        )}

        <section className="catalog-section toolbar tech-toolbar">
          <SearchBar value={searchQuery} onChange={onSearchQueryChange} />
          <CategoryNav
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategoryId={onSelectCategoryId}
            style={themeConfig.category_style || "chips"}
            categoryImages={themeConfig.category_images}
          />
          <AttributeFilters
            filters={availableAttributeFilters}
            values={attributeFilters}
            onChange={onAttributeFilterChange}
            onClear={onClearAttributeFilters}
            totalResults={filteredProducts?.length}
          />
        </section>

        <CatalogState loading={loading} error={error} onRetry={onRetry} />

        {!loading && !error ? (
          <>
            {themeConfig.show_offers && (offers.length > 0 || offerProducts.length > 0) ? (
              <OfferCarousel offers={offers} products={offerProducts} onViewDetail={onViewDetail} />
            ) : null}

            {themeConfig.show_featured && featuredProducts?.length > 0 ? (
              <FeaturedSection products={featuredProducts} onViewDetail={onViewDetail} />
            ) : null}

            <ProductGridSection
              title="Dispositivos & Catálogo"
              products={filteredProducts}
              onViewDetail={onViewDetail}
            />
          </>
        ) : null}
      </div>
    </main>
  );
}

export function HomeDecoTheme(props) {
  const {
    slug,
    storeName,
    themeConfig,
    categories,
    selectedCategoryId,
    onSelectCategoryId,
    searchQuery,
    onSearchQueryChange,
    availableAttributeFilters,
    attributeFilters,
    onAttributeFilterChange,
    onClearAttributeFilters,
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
    <main className="catalog-shell home-deco">
      <div className="catalog-container">
        {themeConfig.hero_image_url ? (
          <ThemeHeader
            storeName={storeName}
            slug={slug}
            heroImageUrl={themeConfig.hero_image_url}
            config={themeConfig}
          />
        ) : (
          <header className="deco-hero">
            <span className="deco-kicker">{themeConfig.hero_kicker || "ESPACIOS CON ALMA"}</span>
            <h1 className="deco-title">{themeConfig.hero_title || storeName || "Casa & Diseño"}</h1>
            <p className="deco-subtitle">
              {themeConfig.hero_subtitle || "Muebles, iluminación y detalles cálidos que transforman cada rincón de tu hogar."}
            </p>
          </header>
        )}

        <section className="catalog-section toolbar deco-toolbar">
          <SearchBar value={searchQuery} onChange={onSearchQueryChange} />
          <CategoryNav
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategoryId={onSelectCategoryId}
            style={themeConfig.category_style || "chips"}
            categoryImages={themeConfig.category_images}
          />
          <AttributeFilters
            filters={availableAttributeFilters}
            values={attributeFilters}
            onChange={onAttributeFilterChange}
            onClear={onClearAttributeFilters}
            totalResults={filteredProducts?.length}
          />
        </section>

        <CatalogState loading={loading} error={error} onRetry={onRetry} />

        {!loading && !error ? (
          <>
            {themeConfig.show_offers && (offers.length > 0 || offerProducts.length > 0) ? (
              <OfferCarousel offers={offers} products={offerProducts} onViewDetail={onViewDetail} />
            ) : null}

            {themeConfig.show_featured && featuredProducts?.length > 0 ? (
              <FeaturedSection products={featuredProducts} onViewDetail={onViewDetail} />
            ) : null}

            <ProductGridSection
              title="Colección Destacada"
              products={filteredProducts}
              onViewDetail={onViewDetail}
            />
          </>
        ) : null}
      </div>
    </main>
  );
}

export function GourmetFoodTheme(props) {
  const {
    slug,
    storeName,
    themeConfig,
    categories,
    selectedCategoryId,
    onSelectCategoryId,
    searchQuery,
    onSearchQueryChange,
    availableAttributeFilters,
    attributeFilters,
    onAttributeFilterChange,
    onClearAttributeFilters,
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
    <main className="catalog-shell gourmet-food">
      <div className="catalog-container">
        {themeConfig.hero_image_url ? (
          <ThemeHeader
            storeName={storeName}
            slug={slug}
            heroImageUrl={themeConfig.hero_image_url}
            config={themeConfig}
          />
        ) : (
          <header className="gourmet-hero">
            <span className="gourmet-tag">{themeConfig.hero_kicker || "SABOR ARTESANAL"}</span>
            <h1 className="gourmet-title">{storeName || "Cafetería & Gourmet"}</h1>
            <p className="gourmet-subtitle">
              {themeConfig.hero_subtitle || "Preparaciones hechas con dedicación, ingredientes seleccionados y frescura inigualable."}
            </p>
          </header>
        )}

        <section className="catalog-section toolbar gourmet-toolbar">
          <SearchBar value={searchQuery} onChange={onSearchQueryChange} />
          <CategoryNav
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategoryId={onSelectCategoryId}
            style={themeConfig.category_style || "round_icons"}
            categoryImages={themeConfig.category_images}
          />
          <AttributeFilters
            filters={availableAttributeFilters}
            values={attributeFilters}
            onChange={onAttributeFilterChange}
            onClear={onClearAttributeFilters}
            totalResults={filteredProducts?.length}
          />
        </section>

        <CatalogState loading={loading} error={error} onRetry={onRetry} />

        {!loading && !error ? (
          <>
            {themeConfig.show_offers && (offers.length > 0 || offerProducts.length > 0) ? (
              <OfferCarousel offers={offers} products={offerProducts} onViewDetail={onViewDetail} />
            ) : null}

            {themeConfig.show_featured && featuredProducts?.length > 0 ? (
              <FeaturedSection products={featuredProducts} onViewDetail={onViewDetail} />
            ) : null}

            <ProductGridSection
              title="Nuestra Carta"
              products={filteredProducts}
              onViewDetail={onViewDetail}
            />
          </>
        ) : null}
      </div>
    </main>
  );
}

