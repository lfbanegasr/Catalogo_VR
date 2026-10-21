import { useState } from "react";
import { buildAssetUrl } from "../api/api";
import { useCart } from "../context/CartContext";
import { useCurrency } from "../context/CurrencyContext";
import { useThemeConfig } from "../theme/theme";
import { formatPrice } from "../utils/price";

function ProductImage({ src, alt, adjustment, secondarySrc }) {
  const [autoFit, setAutoFit] = useState("cover");
  if (!src) {
    return <div className="product-image-fallback">Sin imagen</div>;
  }

  const requestedFit = adjustment?.fit || "cover";
  const resolvedFit = requestedFit === "auto" ? autoFit : requestedFit;
  const positionX = Number(adjustment?.positionX ?? 50);
  const positionY = Number(adjustment?.positionY ?? 30);
  const zoom = Number(adjustment?.zoom ?? 100);

  return (
    <div className="product-image-container">
      <img
        className={`product-image primary fit-${resolvedFit}`}
        src={src}
        alt={alt || "Imagen del producto"}
        loading="lazy"
        decoding="async"
        style={{
          objectFit: resolvedFit,
          objectPosition: `${positionX}% ${positionY}%`,
          transform: `scale(${zoom / 100})`,
          transformOrigin: `${positionX}% ${positionY}%`,
        }}
        onLoad={(event) => {
          if (requestedFit !== "auto") return;
          const ratio = event.currentTarget.naturalWidth / Math.max(1, event.currentTarget.naturalHeight);
          setAutoFit(ratio < 0.9 || ratio > 1.1 ? "contain" : "cover");
        }}
        onError={(event) => {
          event.currentTarget.style.display = "none";
          const fallback = event.currentTarget.nextElementSibling;
          if (fallback) {
            fallback.classList.remove("hidden");
            fallback.style.display = "grid";
          }
        }}
      />

      {secondarySrc && (
        <img
          className={`product-image secondary fit-${resolvedFit}`}
          src={secondarySrc}
          alt={alt ? `${alt} vista secundaria` : "Vista secundaria"}
          loading="lazy"
          decoding="async"
          style={{
            objectFit: resolvedFit,
            objectPosition: `${positionX}% ${positionY}%`,
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

function ProductCard({ product, onViewDetail, compact = false }) {
  const { addToCart } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const currencySymbol = useCurrency();
  const themeContext = useThemeConfig();
  const cardCfg = themeContext?.config || {};

  // Card configuration options from theme studio
  const cardStyle = cardCfg.card_style || "minimal_luxury";
  const cardActionType = cardCfg.card_action_type || "floating_plus";
  const cardShowStock = cardCfg.card_show_stock ?? true;
  const cardShowSpecs = cardCfg.card_show_specs ?? true;
  const cardShowDiscountBadge = cardCfg.card_show_discount_badge ?? true;
  const cardHoverSecondaryImg = cardCfg.card_hover_secondary_img ?? true;
  const cardHoverZoom = cardCfg.card_hover_zoom ?? true;
  const cardShadow = cardCfg.card_shadow || "soft";
  const cardBorder = cardCfg.card_border || "subtle";

  const nombre = product.nombre || product.name || "Producto sin nombre";
  const precio = product.precio ?? product.price ?? 0;
  const precioOriginal = product.precio_original ?? product.originalPrice ?? precio;
  const precioFinal = product.precio_final ?? product.finalPrice ?? precio;
  const descuentoPct = product.descuento_pct ?? product.discountPct ?? null;
  const badgeText = product.badge_text ?? product.badgeText ?? null;
  const stock = product.stock ?? null;
  const imagenUrl = product.imagen_url || product.imageUrl || "";
  const imageSrc = buildAssetUrl(imagenUrl);

  // Detección de imagen secundaria para hover elegante
  const imageListRaw = Array.isArray(product.imagenes)
    ? product.imagenes
    : Array.isArray(product.images)
      ? product.images
      : [];
  const secondaryUrl = imageListRaw.find((img) => img && img !== imagenUrl) || "";
  const secondarySrc = (cardHoverSecondaryImg && secondaryUrl) ? buildAssetUrl(secondaryUrl) : "";

  const imageAdjustment = {
    fit: product.imagen_fit || cardCfg.card_image_fit || "cover",
    positionX: product.imagen_posicion_x ?? 50,
    positionY: product.imagen_posicion_y ?? 30,
    zoom: product.imagen_zoom ?? 100,
    background: product.imagen_fondo || "",
  };

  const defaultVariant = (Array.isArray(product.variantes) ? product.variantes : [])
    .find((variant) => variant.es_predeterminada)
    || product.variantes?.[0]
    || null;

  // Manejo robusto de stock: si stock es null/undefined, significa stock ilimitado/no rastreado
  const rawStock = defaultVariant?.stock !== undefined && defaultVariant?.stock !== null
    ? defaultVariant.stock
    : (stock !== undefined && stock !== null ? stock : null);

  const hasStockLimit = rawStock !== null && rawStock !== undefined;
  const numericStock = hasStockLimit ? Number(rawStock) : null;
  const isAvailable = !hasStockLimit || (numericStock !== null && numericStock > 0);
  const isLowStock = hasStockLimit && numericStock !== null && numericStock > 0 && numericStock <= 3;

  const productId = product.id || product.id_producto;

  const quickProduct = {
    ...product,
    id: productId,
    id_producto: productId,
    ...(defaultVariant ? {
      id_variante: defaultVariant.id_variante,
      nombre_variante: defaultVariant.nombre,
      precio_final: defaultVariant.precio_final ?? defaultVariant.precio,
      precio: defaultVariant.precio,
      stock: defaultVariant.stock,
      imagen_url: defaultVariant.imagen_url || imagenUrl,
    } : {
      precio_final: precioFinal,
      precio: precio,
      stock: rawStock,
      imagen_url: imagenUrl,
    }),
  };

  const handleQuickAdd = (e) => {
    e.stopPropagation();
    if (!isAvailable) return;
    addToCart(quickProduct);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1200);
  };

  // Atributos destacados (ej. especificaciones técnicas o materiales)
  const topAttributes = Array.isArray(product.atributos)
    ? product.atributos.slice(0, 2)
    : [];

  return (
    <article
      className={`product-card ${compact ? "compact" : ""} ${secondarySrc ? "has-secondary-image" : ""} style-${cardStyle} shadow-${cardShadow} border-${cardBorder} action-${cardActionType} ${cardHoverZoom ? "hover-zoom" : "no-zoom"}`.trim()}
      data-product-id={String(product.catalog_card_id || product.id)}
    >
      {/* Zona Multimedia / Fotografía con clic directo a detalle */}
      <div
        className="product-media"
        onClick={() => onViewDetail && onViewDetail(product)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onViewDetail && onViewDetail(product);
          }
        }}
        aria-label={`Ver detalles de ${nombre}`}
        style={imageAdjustment.background ? { backgroundColor: imageAdjustment.background } : undefined}
      >
        <ProductImage
          src={imageSrc}
          alt={nombre}
          adjustment={imageAdjustment}
          secondarySrc={secondarySrc}
        />
        <div className="product-image-fallback hidden">Imagen no disponible</div>

        {/* Badges de Descuento Flotantes con Glassmorphism */}
        <div className="product-badges-overlay">
          {cardShowDiscountBadge && descuentoPct != null && Number(descuentoPct) > 0 ? (
            <span className="product-badge-discount">
              -{Math.round(Number(descuentoPct))}%
            </span>
          ) : null}

          {badgeText || product.es_set ? (
            <span className="product-badge-custom">
              {badgeText || "Set"}
            </span>
          ) : null}
        </div>

        {/* Botón Flotante Rápido de Carrito sobre la Imagen (solo si actionType === floating_plus) */}
        {cardActionType === "floating_plus" && (
          <button
            className={`product-quick-add-floating ${justAdded ? "added" : ""}`}
            type="button"
            onClick={handleQuickAdd}
            disabled={!isAvailable}
            aria-label={justAdded ? "Agregado al pedido" : "Añadir al pedido"}
            title={!isAvailable ? "Agotado" : "Añadir al pedido"}
          >
            {justAdded ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Cuerpo de la tarjeta */}
      <div className="product-body" onClick={() => onViewDetail && onViewDetail(product)}>
        {/* Atributos / Specs Chips si están activados */}
        {cardShowSpecs && topAttributes.length > 0 && (
          <div className="product-specs-chips">
            {topAttributes.map((attr, idx) => (
              <span key={idx} className="product-spec-pill">
                {attr.valor || attr.nombre}
              </span>
            ))}
          </div>
        )}

        <h3 className="product-name" title={nombre}>
          {nombre}
        </h3>

        {/* Píldora de disponibilidad moderna si está activada */}
        {cardShowStock && (
          <div className="product-stock-row">
            <span className={`product-stock-dot ${isAvailable ? (isLowStock ? "low" : "available") : "out"}`} />
            <span className={`product-stock-text ${isAvailable ? (isLowStock ? "low" : "available") : "out"}`}>
              {isAvailable ? (isLowStock ? `Últimas ${numericStock} uds.` : "En stock") : "Agotado"}
            </span>
          </div>
        )}
      </div>

      {/* Pie con Precios y Botones según cardActionType */}
      <div className={`product-footer action-${cardActionType}`}>
        <div className="product-price-block">
          {precioOriginal > precioFinal ? (
            <div className="product-price-dual">
              <span className="product-price-original">
                {formatPrice(precioOriginal, currencySymbol)}
              </span>
              <span className="product-price-current">
                {formatPrice(precioFinal, currencySymbol)}
              </span>
            </div>
          ) : (
            <span className="product-price-current">
              {formatPrice(precio, currencySymbol)}
            </span>
          )}
        </div>

        {/* Acción: Botón Píldora Alargado ("footer_pill") */}
        {cardActionType === "footer_pill" && (
          <button
            className={`product-btn-pill ${justAdded ? "added" : ""}`}
            type="button"
            onClick={handleQuickAdd}
            disabled={!isAvailable}
            aria-label={justAdded ? "Agregado al pedido" : "Añadir al pedido"}
          >
            {justAdded ? (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Añadido</span>
              </>
            ) : (
              <>
                <span>Añadir</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </>
            )}
          </button>
        )}

        {/* Acción: Doble Botón ("dual_action") */}
        {cardActionType === "dual_action" && (
          <div className="product-dual-actions">
            <button
              className="product-card-detail-btn"
              type="button"
              onClick={() => onViewDetail && onViewDetail(product)}
              title="Ver detalles"
            >
              <span>Ver</span>
            </button>
            <button
              className={`product-quick-add-sm ${justAdded ? "added" : ""}`}
              type="button"
              onClick={handleQuickAdd}
              disabled={!isAvailable}
              title={!isAvailable ? "Agotado" : "Añadir"}
            >
              {justAdded ? "✓" : "+ Añadir"}
            </button>
          </div>
        )}

        {/* Acción: Solo Ver o Botón Estándar ("floating_plus" o "view_only") */}
        {(cardActionType === "floating_plus" || cardActionType === "view_only") && (
          <button
            className="product-card-detail-btn"
            type="button"
            onClick={() => onViewDetail && onViewDetail(product)}
          >
            <span>{cardActionType === "view_only" ? "Ver detalles" : "Ver"}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
      </div>
    </article>
  );
}

export default ProductCard;
