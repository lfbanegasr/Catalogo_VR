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
        className={"fit-" + (config.hero_image_fit || "cover")}
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
                  <img src={buildAssetUrl(categoryImage)} alt={category.nombre} />
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
        <ThemeHeader
          storeName={storeName}
          slug={slug}
          title={storeName}
          subtitle="Coleccion destacada, categorias visuales y ofertas activas."
          heroImageUrl={themeConfig.hero_image_url}
          config={themeConfig}
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
    availableAttributeFilters,
    attributeFilters,
    onAttributeFilterChange,
    onClearAttributeFilters,
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
          heroImageUrl={themeConfig.hero_image_url}
          config={themeConfig}
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
    availableAttributeFilters,
    attributeFilters,
    onAttributeFilterChange,
    onClearAttributeFilters,
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
        {themeConfig.hero_image_url ? (
          <ThemeHeader
            storeName={storeName}
            slug={slug}
            title={storeName}
            subtitle=""
            heroImageUrl={themeConfig.hero_image_url}
            config={{ ...themeConfig, hero_layout: "image_only" }}
            compact
          />
        ) : null}
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
        <AttributeFilters
          filters={availableAttributeFilters}
          values={attributeFilters}
          onChange={onAttributeFilterChange}
          onClear={onClearAttributeFilters}
          totalResults={filteredProducts?.length}
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
