import { buildAssetUrl } from "../api/api";

function formatPrice(value) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function ProductImage({ src, alt }) {
  if (!src) {
    return <div className="product-image-fallback">Sin imagen</div>;
  }

  return (
    <img
      className="product-image"
      src={src}
      alt={alt}
      loading="lazy"
      onError={(event) => {
        event.currentTarget.style.display = "none";
        const fallback = event.currentTarget.nextElementSibling;
        if (fallback) fallback.style.display = "grid";
      }}
    />
  );
}

function ProductCard({ product, onViewDetail, compact = false }) {
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

  const stockLabel =
    stock == null
      ? "Disponibilidad no informada"
      : stock > 0
        ? `Disponible: ${stock}`
        : "Agotado";
  const stockClass =
    stock == null ? "is-unknown" : stock > 0 ? "is-available" : "is-out";

  return (
    <article className={`product-card ${compact ? "compact" : ""}`.trim()}>
      <div className="product-media">
        <ProductImage src={imageSrc} alt={nombre} />
        <div className="product-image-fallback hidden">Imagen no disponible</div>
        {badgeText ? <span className="product-badge">{badgeText}</span> : null}
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
              <p className="product-price-original">{formatPrice(precioOriginal)}</p>
              <p className="product-price">{formatPrice(precioFinal)}</p>
              {descuentoPct != null ? (
                <p className="product-discount">-{Math.round(Number(descuentoPct))}%</p>
              ) : null}
            </>
          ) : (
            <p className="product-price">{formatPrice(precio)}</p>
          )}
        </div>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => onViewDetail(product)}
        >
          Ver detalle
        </button>
      </div>
    </article>
  );
}

export default ProductCard;
