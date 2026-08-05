import { useEffect, useState } from "react";
import { buildAssetUrl } from "../api/api";
import { useCart } from "../context/CartContext";

function formatPrice(value) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function normalizeWhatsappNumber(raw) {
  return String(raw || "").replace(/[^\d]/g, "");
}

function ProductDetailPage({ product, slug, storeName, whatsappNumber, productUrl, onWhatsappClick, onBack }) {
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [failedImageSrc, setFailedImageSrc] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [variantError, setVariantError] = useState("");

  const handleAddToCart = () => {
    if (variants.length > 0 && !selectedVariant) {
      setVariantError("Selecciona una variante antes de agregar el producto.");
      return;
    }
    const availableStock = Number(selectedVariant?.stock ?? product.stock ?? 0);
    if (availableStock <= 0) {
      setVariantError("Esta opcion no tiene stock disponible.");
      return;
    }
    addToCart({
      ...product,
      id_variante: selectedVariant?.id_variante || null,
      nombre_variante: selectedVariant?.nombre || "",
      precio_final: selectedVariant?.precio_final ?? product.precio_final,
      precio: selectedVariant?.precio ?? product.precio,
      imagen_url: selectedVariant?.imagen_url || product.imagen_url,
      stock: availableStock,
    }, Math.min(quantity, availableStock));
    onBack();
  };

  const nombre = product.nombre || product.name || "Producto";
  const imagenUrl = product.imagen_url || product.imageUrl || "";
  const imageListRaw = Array.isArray(product.imagenes)
    ? product.imagenes
    : Array.isArray(product.images)
      ? product.images
      : [];
  const imageList = imageListRaw.length > 0 ? imageListRaw : (imagenUrl ? [imagenUrl] : []);
  const currentImageUrl = imageList[selectedImageIndex] || imagenUrl;
  const currentImageSrc = buildAssetUrl(currentImageUrl);
  const currentImageFailed =
    Boolean(currentImageSrc) && failedImageSrc === currentImageSrc;
  const descripcion = product.descripcion || product.description || "";
  const precio = product.precio ?? product.price ?? 0;
  const precioOriginal = product.precio_original ?? product.originalPrice ?? precio;
  const precioFinal = product.precio_final ?? product.finalPrice ?? precio;
  const descuentoPct = product.descuento_pct ?? product.discountPct ?? null;
  const badgeText = product.badge_text ?? product.badgeText ?? null;
  const attributes = Array.isArray(product.atributos) ? product.atributos : [];
  const variants = Array.isArray(product.variantes) ? product.variantes : [];
  const selectedVariant = variants.find(
    (variant) => String(variant.id_variante) === String(selectedVariantId),
  ) || null;
  const displayPrice = selectedVariant?.precio ?? precio;
  const displayOriginalPrice = selectedVariant?.precio_original ?? precioOriginal;
  const displayFinalPrice = selectedVariant?.precio_final ?? precioFinal;
  const displayDiscount = selectedVariant?.descuento_pct ?? descuentoPct;
  const selectedStock = selectedVariant?.stock ?? product.stock;
  const stockText =
    selectedStock == null ? "Stock no disponible" : "Stock: " + selectedStock;

  useEffect(() => {
    setSelectedImageIndex(0);
    setFailedImageSrc("");
    setQuantity(1);
    setVariantError("");
    const defaultVariant = variants.find((variant) => variant.es_predeterminada)
      || (variants.length === 1 ? variants[0] : null);
    setSelectedVariantId(defaultVariant?.id_variante || "");
  }, [product.id, product.id_producto]);

  return (
    <main className="page-shell">
      <div className="container">
        <button className="btn btn-ghost back-btn" type="button" onClick={onBack}>
          Volver al catalogo
        </button>

        <section className="panel detail-layout">
          <div className="detail-image-wrap">
            {currentImageUrl && !currentImageFailed ? (
              <img
                key={currentImageSrc}
                className="detail-image"
                src={currentImageSrc}
                alt={nombre}
                onError={() => setFailedImageSrc(currentImageSrc)}
              />
            ) : (
              <div
                className="image-fallback detail-image-fallback"
                role="img"
                aria-label={`${nombre}: imagen no disponible`}
              >
                Imagen no disponible
              </div>
            )}
            {!currentImageUrl || currentImageFailed ? null : (
              <div className="image-fallback-overlay" aria-hidden="true">
                Vista previa
              </div>
            )}
            {imageList.length > 1 ? (
              <div className="thumb-row">
                {imageList.map((url, index) => (
                  <button
                    key={`${url}-${index}`}
                    type="button"
                    className={`thumb-btn ${index === selectedImageIndex ? "active" : ""}`}
                    onClick={() => setSelectedImageIndex(index)}
                  >
                    <img
                      src={buildAssetUrl(url)}
                      alt={`Imagen ${index + 1} de ${nombre}`}
                      onError={(event) => {
                        event.currentTarget.style.visibility = "hidden";
                      }}
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="detail-content">
            <p className="detail-store">{storeName || "Tienda"}</p>
            <h1 className="detail-title">{nombre}</h1>
            {badgeText ? <span className="offer-badge detail-badge">{badgeText}</span> : null}
            <div className="detail-price-block">
              {displayOriginalPrice > displayFinalPrice ? (
                <>
                  <p className="detail-price-original">{formatPrice(displayOriginalPrice)}</p>
                  <p className="detail-price">{formatPrice(displayFinalPrice)}</p>
                  {displayDiscount != null ? <p className="detail-discount">-{Math.round(Number(displayDiscount))}%</p> : null}
                </>
              ) : (
                <p className="detail-price">{formatPrice(displayPrice)}</p>
              )}
            </div>
            <p className="detail-stock">{stockText}</p>

            {variants.length > 0 ? (
              <div className="detail-block">
                <h2 className="detail-subtitle">Elige una opcion</h2>
                <div className="variant-options" role="radiogroup" aria-label="Variantes del producto">
                  {variants.map((variant) => {
                    const isSelected = String(variant.id_variante) === String(selectedVariantId);
                    const hasStock = Number(variant.stock || 0) > 0;
                    return (
                      <button
                        key={variant.id_variante}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        className={"variant-option " + (isSelected ? "active" : "")}
                        disabled={!hasStock}
                        onClick={() => {
                          setSelectedVariantId(variant.id_variante);
                          setQuantity(1);
                          setVariantError("");
                        }}
                      >
                        <span>{variant.nombre || variant.sku}</span>
                        <small>{hasStock ? variant.stock + " disponibles" : "Sin stock"}</small>
                      </button>
                    );
                  })}
                </div>
                {variantError ? <p className="form-error" role="alert">{variantError}</p> : null}
              </div>
            ) : null}

            <div className="detail-block">
              <h2 className="detail-subtitle">Descripcion</h2>
              <p className="detail-description">
                {String(descripcion).trim()
                  ? descripcion
                  : "Este producto aun no tiene descripcion publica."}
              </p>
            </div>

            {attributes.length > 0 ? (
              <div className="detail-block">
                <h2 className="detail-subtitle">Caracteristicas</h2>
                <dl className="product-attributes">
                  {attributes.map((attribute) => (
                    <div key={String(attribute.id_atributo) + String(attribute.valor)} className="product-attribute-row">
                      <dt>{attribute.nombre}</dt>
                      <dd>
                        {attribute.tipo_dato === "BOOLEAN"
                          ? (attribute.valor ? "Si" : "No")
                          : <>{attribute.valor}{attribute.unidad ? " " + attribute.unidad : ""}</>}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}

            <div className="detail-actions">
              <div className="qty-field-container">
                <span className="qty-label">Cantidad</span>
                <div className="qty-selector">
                  <button
                    type="button"
                    className="qty-btn qty-btn-minus"
                    onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                  >
                    —
                  </button>
                  <input
                    type="number"
                    min="1"
                    className="qty-input"
                    value={quantity}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      const max = Number(selectedStock || 1);
                      setQuantity(Number.isFinite(next) && next > 0 ? Math.min(next, max) : 1);
                    }}
                  />
                  <button
                    type="button"
                    className="qty-btn qty-btn-plus"
                    onClick={() => setQuantity((prev) => Math.min(prev + 1, Number(selectedStock || 1)))}
                    disabled={Number(selectedStock || 0) <= quantity}
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                className="btn btn-primary add-btn"
                type="button"
                onClick={handleAddToCart}
                disabled={Number(selectedStock || 0) <= 0}
                style={{ backgroundColor: "var(--color-primary)", borderColor: "var(--color-primary)", color: "#ffffff" }}
              >
                Agregar al Pedido
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default ProductDetailPage;
