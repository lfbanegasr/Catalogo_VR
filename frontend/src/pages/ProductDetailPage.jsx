import { useState, useEffect } from "react";
import { buildAssetUrl } from "../api/api";
import { useCart } from "../context/CartContext";
import { useCurrency } from "../context/CurrencyContext";
import { formatPrice } from "../utils/price";

function normalizeWhatsappNumber(raw) {
  return String(raw || "").replace(/[^\d]/g, "");
}

function ProductDetailPage({
  product,
  slug,
  storeName,
  whatsappNumber,
  productUrl,
  onWhatsappClick,
  onBack,
  onOpenCart,
  previousProduct,
  nextProduct,
  onPreviousProduct,
  onNextProduct,
}) {
  const currencySymbol = useCurrency();
  const { addToCart, cartCount } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [failedImageSrc, setFailedImageSrc] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [variantError, setVariantError] = useState("");
  const [isZoomed, setIsZoomed] = useState(false);
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState("description");

  const variants = Array.isArray(product.variantes) ? product.variantes : [];
  const selectedVariant = variants.find(
    (variant) => String(variant.id_variante) === String(selectedVariantId),
  ) || null;

  const nombre = product.nombre || product.name || "Producto";
  const imagenUrl = product.imagen_url || product.imageUrl || "";
  const variantImageUrl = selectedVariant?.imagen_url || "";
  const imageListRaw = Array.isArray(product.imagenes)
    ? product.imagenes
    : Array.isArray(product.images)
      ? product.images
      : [];
  const imageList = Array.from(new Set([
    variantImageUrl,
    ...(imageListRaw.length > 0 ? imageListRaw : (imagenUrl ? [imagenUrl] : [])),
  ].filter(Boolean)));

  const currentImageUrl = imageList[selectedImageIndex] || imagenUrl;
  const currentImageSrc = buildAssetUrl(currentImageUrl);
  const currentImageFailed = Boolean(currentImageSrc) && failedImageSrc === currentImageSrc;

  const descripcion = product.descripcion || product.description || "";
  const precio = product.precio ?? product.price ?? 0;
  const precioOriginal = product.precio_original ?? product.originalPrice ?? precio;
  const precioFinal = product.precio_final ?? product.finalPrice ?? precio;
  const descuentoPct = product.descuento_pct ?? product.discountPct ?? null;
  const badgeText = product.badge_text ?? product.badgeText ?? null;

  const attributes = Array.isArray(product.atributos) ? product.atributos : [];
  const variantAttributeIds = new Set(
    variants.flatMap((variant) => (
      Array.isArray(variant.atributos)
        ? variant.atributos.map((attribute) => String(attribute.id_atributo))
        : []
    )),
  );
  const displayAttributes = [
    ...attributes.filter(
      (attribute) => !variantAttributeIds.has(String(attribute.id_atributo)),
    ),
    ...(selectedVariant?.atributos || []),
  ];

  const displayPrice = selectedVariant?.precio ?? precio;
  const displayOriginalPrice = selectedVariant?.precio_original ?? precioOriginal;
  const displayFinalPrice = selectedVariant?.precio_final ?? precioFinal;
  const displayDiscount = selectedVariant?.descuento_pct ?? descuentoPct;
  const selectedStock = selectedVariant?.stock ?? product.stock;

  const hasLimit = selectedStock !== null && selectedStock !== undefined;
  const numStock = hasLimit ? Number(selectedStock) : null;
  const isOutOfStock = hasLimit && numStock <= 0;
  const isLowStock = hasLimit && numStock > 0 && numStock <= 3;

  let stockLabel = "Disponible";
  if (isOutOfStock) {
    stockLabel = "Agotado";
  } else if (hasLimit) {
    stockLabel = product.es_set
      ? `${numStock} sets disponibles`
      : `${numStock} disponibles`;
  }

  useEffect(() => {
    setSelectedImageIndex(0);
    setFailedImageSrc("");
    setQuantity(1);
    setVariantError("");
    setAddedSuccess(false);
    const defaultVariant = variants.find((variant) => variant.es_predeterminada)
      || (variants.length === 1 ? variants[0] : null);
    setSelectedVariantId(defaultVariant?.id_variante || "");
  }, [product.id, product.id_producto]);

  useEffect(() => {
    const requestedVariantId = product.catalog_variant_id;
    if (
      requestedVariantId
      && variants.some((variant) => String(variant.id_variante) === String(requestedVariantId))
    ) {
      setSelectedVariantId(String(requestedVariantId));
    }
  }, [product.catalog_variant_id, product.id]);

  useEffect(() => {
    setSelectedImageIndex(0);
    setFailedImageSrc("");
  }, [selectedVariantId]);

  const handleAddToCart = () => {
    if (variants.length > 0 && !selectedVariant) {
      setVariantError("Por favor selecciona una opción antes de agregar.");
      return;
    }
    if (isOutOfStock) {
      setVariantError("Esta opción no tiene stock disponible.");
      return;
    }
    const safeQty = hasLimit ? Math.min(quantity, Math.max(1, numStock)) : quantity;
    addToCart({
      ...product,
      id: product.id || product.id_producto,
      id_producto: product.id || product.id_producto,
      id_variante: selectedVariant?.id_variante || null,
      nombre_variante: selectedVariant?.nombre || "",
      precio_final: selectedVariant?.precio_final ?? product.precio_final,
      precio: selectedVariant?.precio ?? product.precio,
      imagen_url: selectedVariant?.imagen_url || product.imagen_url,
      stock: selectedStock,
    }, safeQty);

    setAddedSuccess(true);
    setTimeout(() => setAddedSuccess(false), 2400);

    if (onOpenCart) {
      onOpenCart();
    }
  };

  const handleWhatsappInquiry = () => {
    if (onWhatsappClick) {
      onWhatsappClick(product.id || product.id_producto);
    }
    const cleanPhone = normalizeWhatsappNumber(whatsappNumber);
    if (!cleanPhone) return;
    const currentVariantText = selectedVariant ? ` (${selectedVariant.nombre || selectedVariant.sku})` : "";
    const currentUrl = productUrl || window.location.href;
    const message = `¡Hola! Me gustaría consultar sobre este producto de ${storeName || "la tienda"}:\n\n*${nombre}*${currentVariantText}\nPrecio: ${formatPrice(displayFinalPrice, currencySymbol)}\n\nLink: ${currentUrl}`;
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <main className="pdp-page-shell">
      <div className="pdp-container">
        {/* Barra superior de navegación: Atrás a la izquierda, Tienda al centro, Carrito a la derecha */}
        <nav className="pdp-navbar" aria-label="Navegación del producto">
          <button
            type="button"
            className="pdp-back-button"
            onClick={onBack}
            aria-label="Volver al catálogo"
            title="Volver al catálogo"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            <span>Volver</span>
          </button>

          <div className="pdp-navbar-brand">
            <span className="pdp-navbar-brand-name">{storeName || "Tienda Virtual"}</span>
          </div>

          <div className="pdp-navbar-actions">
            {onOpenCart && (
              <button
                type="button"
                className="pdp-navbar-cart-btn"
                onClick={onOpenCart}
                aria-label={`Ver pedido (${cartCount} productos)`}
                title="Ver pedido"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
                {cartCount > 0 && <span className="pdp-navbar-cart-badge">{cartCount}</span>}
              </button>
            )}
          </div>
        </nav>

        {/* Tarjeta principal unificada del producto */}
        <article className="pdp-card">
          <div className="pdp-layout">
            {/* Columna de Galería e Imágenes */}
            <div className="pdp-gallery-col">
              <div className="pdp-image-stage">
                {currentImageUrl && !currentImageFailed ? (
                  <img
                    key={currentImageSrc}
                    className="pdp-main-image"
                    src={currentImageSrc}
                    alt={nombre}
                    loading="eager"
                    decoding="async"
                    onError={() => setFailedImageSrc(currentImageSrc)}
                    onClick={() => setIsZoomed(true)}
                  />
                ) : (
                  <div className="pdp-image-fallback">
                    <span>Imagen no disponible</span>
                  </div>
                )}

                {/* Badges Flotantes sobre la Imagen */}
                <div className="pdp-badges-overlay">
                  {product.es_set && <span className="pdp-badge pdp-badge-set">Set / Pack</span>}
                  {badgeText && <span className="pdp-badge pdp-badge-custom">{badgeText}</span>}
                  {displayOriginalPrice > displayFinalPrice && (
                    <span className="pdp-badge pdp-badge-discount">
                      -{Math.round(displayDiscount || ((displayOriginalPrice - displayFinalPrice) / displayOriginalPrice * 100))}% OFF
                    </span>
                  )}
                </div>

                {/* Botón flotante para ampliar imagen */}
                {currentImageUrl && !currentImageFailed && (
                  <button
                    type="button"
                    className="pdp-zoom-trigger"
                    onClick={() => setIsZoomed(true)}
                    aria-label="Ver imagen completa"
                    title="Ampliar imagen"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                      <line x1="11" y1="8" x2="11" y2="14"></line>
                      <line x1="8" y1="11" x2="14" y2="11"></line>
                    </svg>
                  </button>
                )}
              </div>

              {/* Tira de Miniaturas */}
              {imageList.length > 1 && (
                <div className="pdp-thumbnails-strip" role="tablist" aria-label="Galería de imágenes">
                  {imageList.map((url, index) => {
                    const isSelected = index === selectedImageIndex;
                    return (
                      <button
                        key={`${url}-${index}`}
                        type="button"
                        role="tab"
                        aria-selected={isSelected}
                        className={`pdp-thumb-item ${isSelected ? "is-selected" : ""}`}
                        onClick={() => setSelectedImageIndex(index)}
                        title={`Ver foto ${index + 1}`}
                      >
                        <img
                          src={buildAssetUrl(url)}
                          alt={`Miniatura ${index + 1} de ${nombre}`}
                          loading="lazy"
                          decoding="async"
                          onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Columna de Información y Compra */}
            <div className="pdp-info-col">
              {/* Marca / Categoría y Estado de Stock */}
              <div className="pdp-eyebrow-row">
                <span className="pdp-eyebrow-text">{storeName || "Catálogo Oficial"}</span>
                <div className={`pdp-stock-status ${isOutOfStock ? "out" : isLowStock ? "low" : "available"}`}>
                  <span className="pdp-stock-dot"></span>
                  <span className="pdp-stock-text">{stockLabel}</span>
                </div>
              </div>

              {/* Título Principal */}
              <h1 className="pdp-heading">{nombre}</h1>

              {/* Tarjeta de Precios */}
              <div className="pdp-pricing-card">
                {displayOriginalPrice > displayFinalPrice ? (
                  <div className="pdp-price-group-sale">
                    <div className="pdp-current-price">{formatPrice(displayFinalPrice, currencySymbol)}</div>
                    <div className="pdp-original-price">{formatPrice(displayOriginalPrice, currencySymbol)}</div>
                    <span className="pdp-savings-pill">
                      Ahorras {formatPrice(displayOriginalPrice - displayFinalPrice, currencySymbol)}
                    </span>
                  </div>
                ) : (
                  <div className="pdp-current-price">{formatPrice(displayPrice, currencySymbol)}</div>
                )}
              </div>

              {/* Contenido si es Set / Pack */}
              {product.es_set && Array.isArray(product.componentes) && product.componentes.length > 0 && (
                <div className="pdp-bundle-card">
                  <div className="pdp-bundle-header">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                      <line x1="12" y1="22.08" x2="12" y2="12"></line>
                    </svg>
                    <span>Componentes de este Set</span>
                  </div>
                  <ul className="pdp-bundle-items">
                    {product.componentes.map((component, idx) => (
                      <li key={String(component.id_producto || idx) + String(component.id_variante || "")} className="pdp-bundle-item">
                        <span className="pdp-bundle-qty">{component.cantidad}x</span>
                        <div className="pdp-bundle-details">
                          <span className="pdp-bundle-item-name">{component.nombre}</span>
                          {component.variante && <span className="pdp-bundle-item-var">({component.variante})</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Selector de Variantes */}
              {variants.length > 0 && (
                <div className="pdp-variants-container">
                  <div className="pdp-variants-header">
                    <span className="pdp-variants-label">Seleccionar opción:</span>
                    {selectedVariant && (
                      <span className="pdp-variants-selected-name">{selectedVariant.nombre || selectedVariant.sku}</span>
                    )}
                  </div>
                  <div className="pdp-variants-grid" role="radiogroup" aria-label="Variantes disponibles">
                    {variants.map((variant) => {
                      const isSelected = String(variant.id_variante) === String(selectedVariantId);
                      const varStock = variant.stock !== null && variant.stock !== undefined ? Number(variant.stock) : null;
                      const hasVarStock = varStock === null || varStock > 0;

                      return (
                        <button
                          key={variant.id_variante}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          className={`pdp-variant-chip ${isSelected ? "selected" : ""} ${!hasVarStock ? "disabled" : ""}`}
                          disabled={!hasVarStock}
                          onClick={() => {
                            setSelectedVariantId(variant.id_variante);
                            setQuantity(1);
                            setVariantError("");
                          }}
                        >
                          <span className="pdp-variant-name">{variant.nombre || variant.sku}</span>
                          {varStock !== null && (
                            <span className="pdp-variant-stock">
                              {hasVarStock ? `${varStock} disp.` : "Agotado"}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {variantError && (
                    <div className="pdp-error-banner" role="alert">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                      <span>{variantError}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Controles de Compra y Acciones */}
              <div className="pdp-cta-card">
                <div className="pdp-cta-top-row">
                  <div className="pdp-stepper-label">Cantidad</div>
                  <div className="pdp-stepper">
                    <button
                      type="button"
                      className="pdp-stepper-btn"
                      onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                      disabled={quantity <= 1 || isOutOfStock}
                      aria-label="Disminuir cantidad"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      className="pdp-stepper-input"
                      value={quantity}
                      disabled={isOutOfStock}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        const max = hasLimit ? Math.max(1, numStock) : 999;
                        setQuantity(Number.isFinite(next) && next > 0 ? Math.min(next, max) : 1);
                      }}
                    />
                    <button
                      type="button"
                      className="pdp-stepper-btn"
                      onClick={() => setQuantity((prev) => {
                        return hasLimit ? Math.min(prev + 1, numStock) : prev + 1;
                      })}
                      disabled={isOutOfStock || (hasLimit && quantity >= numStock)}
                      aria-label="Aumentar cantidad"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="pdp-cta-buttons">
                  <button
                    type="button"
                    className={`pdp-primary-add-btn ${addedSuccess ? "added" : ""}`}
                    onClick={handleAddToCart}
                    disabled={isOutOfStock}
                  >
                    {addedSuccess ? (
                      <>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        <span>¡Agregado al Pedido!</span>
                      </>
                    ) : (
                      <>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                          <line x1="3" y1="6" x2="21" y2="6" />
                          <path d="M16 10a4 4 0 0 1-8 0" />
                        </svg>
                        <span>{isOutOfStock ? "Sin Stock Disponible" : "Agregar al Pedido"}</span>
                      </>
                    )}
                  </button>

                  {whatsappNumber && (
                    <button
                      type="button"
                      className="pdp-whatsapp-btn"
                      onClick={handleWhatsappInquiry}
                      title="Consultar disponibilidad o detalles directamente por WhatsApp"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.52 3.48A11.93 11.93 0 0012.06 0C5.46 0 .09 5.37.09 11.97c0 2.11.55 4.16 1.6 5.97L0 24l6.23-1.63a11.92 11.92 0 005.83 1.51h.01c6.6 0 11.97-5.37 11.97-11.97 0-3.2-.1-6.25-1.25-3.52-5.43zM12.06 21.91h-.01a9.92 9.92 0 01-5.06-1.39l-.36-.21-3.76.99 1-3.66-.23-.38a9.92 9.92 0 01-1.52-5.29c0-5.5 4.47-9.97 9.97-9.97 2.66 0 5.16 1.04 7.04 2.92a9.92 9.92 0 012.92 7.05c0 5.5-4.48 9.94-9.99 9.94zm5.46-7.47c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.09 4.49.71.31 1.27.49 1.7.63.72.23 1.37.2 1.88.12.58-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35z"/>
                      </svg>
                      <span>Consultar por WhatsApp</span>
                    </button>
                  )}
                </div>

                {/* Sellos de Confianza */}
                <div className="pdp-trust-strip">
                  <div className="pdp-trust-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    <span>Compra Segura</span>
                  </div>
                  <div className="pdp-trust-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    <span>Respuesta Rápida</span>
                  </div>
                  <div className="pdp-trust-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                    <span>Coordinación Directa</span>
                  </div>
                </div>
              </div>

              {/* Pestañas de Información (Descripción / Especificaciones) */}
              <div className="pdp-tabs-container">
                <div className="pdp-tab-headers" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "description"}
                    className={`pdp-tab-btn ${activeTab === "description" ? "active" : ""}`}
                    onClick={() => setActiveTab("description")}
                  >
                    Descripción
                  </button>
                  {displayAttributes.length > 0 && (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === "specs"}
                      className={`pdp-tab-btn ${activeTab === "specs" ? "active" : ""}`}
                      onClick={() => setActiveTab("specs")}
                    >
                      Especificaciones ({displayAttributes.length})
                    </button>
                  )}
                </div>

                <div className="pdp-tab-content">
                  {activeTab === "description" && (
                    <div className="pdp-description-text">
                      {String(descripcion).trim()
                        ? descripcion
                        : "Este producto no posee descripción adicional por el momento."}
                    </div>
                  )}

                  {activeTab === "specs" && displayAttributes.length > 0 && (
                    <dl className="pdp-specs-grid">
                      {displayAttributes.map((attribute) => (
                        <div key={String(attribute.id_atributo) + String(attribute.valor)} className="pdp-spec-row">
                          <dt className="pdp-spec-key">{attribute.nombre}</dt>
                          <dd className="pdp-spec-val">
                            {attribute.tipo_dato === "BOOLEAN"
                              ? (attribute.valor ? "Sí" : "No")
                              : <>{attribute.valor}{attribute.unidad ? " " + attribute.unidad : ""}</>}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </div>
            </div>
          </div>
        </article>

        {/* Navegación entre Productos (Anterior / Siguiente) */}
        {(previousProduct || nextProduct) && (
          <nav className="pdp-navigation-strip" aria-label="Navegación entre productos">
            <button
              type="button"
              className="pdp-nav-tile pdp-nav-prev"
              onClick={onPreviousProduct}
              disabled={!previousProduct}
            >
              <div className="pdp-nav-tile-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
              </div>
              <div className="pdp-nav-tile-text">
                <span className="pdp-nav-tile-sub">Producto anterior</span>
                <span className="pdp-nav-tile-name">{previousProduct?.nombre || "No disponible"}</span>
              </div>
            </button>

            <button
              type="button"
              className="pdp-nav-tile pdp-nav-next"
              onClick={onNextProduct}
              disabled={!nextProduct}
            >
              <div className="pdp-nav-tile-text">
                <span className="pdp-nav-tile-sub">Siguiente producto</span>
                <span className="pdp-nav-tile-name">{nextProduct?.nombre || "Fin del catálogo"}</span>
              </div>
              <div className="pdp-nav-tile-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </div>
            </button>
          </nav>
        )}
      </div>

      {/* Modal / Lightbox de Zoom para imagen completa */}
      {isZoomed && (
        <div
          className="fullscreen-image-modal"
          onClick={() => setIsZoomed(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Vista de imagen completa"
        >
          <button
            type="button"
            className="fullscreen-close-btn"
            onClick={() => setIsZoomed(false)}
            aria-label="Cerrar vista completa"
          >
            ✕
          </button>
          <img
            src={currentImageSrc}
            alt={nombre}
            decoding="async"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </main>
  );
}

export default ProductDetailPage;
