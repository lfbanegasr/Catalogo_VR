import { useState } from "react";
import { buildAssetUrl } from "../api/api";
import { useCart } from "../context/CartContext";
import { useCurrency } from "../context/CurrencyContext";
import { formatPrice } from "../utils/price";

function ProductImage({ src, alt, adjustment }) {
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
    <img
      className={`product-image fit-${resolvedFit}`}
      src={src}
      alt={alt}
      loading="lazy"
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
        if (fallback) fallback.style.display = "grid";
      }}
    />
  );
}

function ProductCard({ product, onViewDetail, compact = false }) {
  const { addToCart } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const currencySymbol = useCurrency();
  const nombre = product.nombre || product.name || "Producto sin nombre";
  const descripcion =
    product.descripcion ||
    product.description ||
    "Producto disponible en catalogo publico.";
  const precio = product.precio ?? product.price ?? 0;
  const precioOriginal = product.precio_original ?? product.originalPrice ?? precio;
  const precioFinal = product.precio_final ?? product.finalPrice ?? precio;
  const descuentoPct = product.descuento_pct ?? product.discountPct ?? null;
  const badgeText = product.badge_text ?? product.badgeText ?? null;
  const stock = product.stock ?? null;
  const imagenUrl = product.imagen_url || product.imageUrl || "";
  const imageSrc = buildAssetUrl(imagenUrl);
  const imageAdjustment = {
    fit: product.imagen_fit || "cover",
    positionX: product.imagen_posicion_x ?? 50,
    positionY: product.imagen_posicion_y ?? 30,
    zoom: product.imagen_zoom ?? 100,
    background: product.imagen_fondo || "",
  };
  const defaultVariant = (Array.isArray(product.variantes) ? product.variantes : [])
    .find((variant) => variant.es_predeterminada)
    || product.variantes?.[0]
    || null;
  const quickStock = Number(defaultVariant?.stock ?? stock ?? 0);
  const quickProduct = defaultVariant ? {
    ...product,
    id_variante: defaultVariant.id_variante,
    nombre_variante: defaultVariant.nombre,
    precio_final: defaultVariant.precio_final,
    precio: defaultVariant.precio,
    stock: defaultVariant.stock,
    imagen_url: defaultVariant.imagen_url || imagenUrl,
  } : product;

  const handleQuickAdd = () => {
    if (quickStock <= 0) return;
    addToCart(quickProduct);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1200);
  };
  const stockLabel =
    stock == null
      ? "Disponibilidad no informada"
      : product.es_set && stock > 0
        ? "Sets disponibles: " + stock
      : stock > 0
        ? `Disponible: ${stock}`
        : "Agotado";
  const stockClass =
    stock == null ? "is-unknown" : stock > 0 ? "is-available" : "is-out";

  return (
    <article
      className={`product-card ${compact ? "compact" : ""}`.trim()}
      data-product-id={String(product.catalog_card_id || product.id)}
    >
      <div className="product-media" style={imageAdjustment.background ? { backgroundColor: imageAdjustment.background } : undefined}>
        <ProductImage src={imageSrc} alt={nombre} adjustment={imageAdjustment} />
        <div className="product-image-fallback hidden">Imagen no disponible</div>
        {badgeText || product.es_set ? <span className="product-badge">{badgeText || "Set"}</span> : null}
      </div>

      <div className="product-body">
        <h3 className="product-name">{nombre}</h3>
        <p className="product-description">
          {String(descripcion).trim() || "Producto disponible en catalogo publico."}
        </p>
        <p className={`product-stock ${stockClass}`}>{stockLabel}</p>
      </div>

      <div className="product-footer">
        <div className="product-price-block">
          {precioOriginal > precioFinal ? (
            <>
              <p className="product-price-original">{formatPrice(precioOriginal, currencySymbol)}</p>
              <p className="product-price">{formatPrice(precioFinal, currencySymbol)}</p>
              {descuentoPct != null ? (
                <p className="product-discount">-{Math.round(Number(descuentoPct))}%</p>
              ) : null}
            </>
          ) : (
            <p className="product-price">{formatPrice(precio, currencySymbol)}</p>
          )}
        </div>
        <div className="product-card-actions">
          <button
            className="btn btn-primary product-detail-btn"
            type="button"
            onClick={() => onViewDetail(product)}
          >
            Ver detalle
          </button>
          <button
            className="product-quick-add"
            type="button"
            onClick={handleQuickAdd}
            disabled={quickStock <= 0}
            aria-label={justAdded ? "Producto agregado" : "Agregar al carrito"}
            title={quickStock <= 0 ? "Producto agotado" : "Agregar al carrito"}
          >
            {justAdded ? (
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

export default ProductCard;
