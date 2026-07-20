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

  const handleAddToCart = () => {
    addToCart(product, quantity);
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

  const handleBuyByWhatsapp = async () => {
    const phone = normalizeWhatsappNumber(whatsappNumber);
    if (!phone) {
      window.alert("Esta tienda aun no configuro su numero de WhatsApp.");
      return;
    }

    const message = [
      "Hola, quiero comprar este producto:",
      `${nombre}`,
      `Cantidad: ${quantity}`,
      `Precio: ${formatPrice(precioFinal)}`,
      `Tienda: ${storeName || slug || "-"}`,
      productUrl ? `Enlace: ${productUrl}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    if (onWhatsappClick) {
      await onWhatsappClick(product.id || product.id_producto || null);
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const stockText =
    product.stock == null ? "Stock no disponible" : `Stock: ${product.stock}`;

  useEffect(() => {
    setSelectedImageIndex(0);
    setFailedImageSrc("");
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
              {precioOriginal > precioFinal ? (
                <>
                  <p className="detail-price-original">{formatPrice(precioOriginal)}</p>
                  <p className="detail-price">{formatPrice(precioFinal)}</p>
                  {descuentoPct != null ? <p className="detail-discount">-{Math.round(Number(descuentoPct))}%</p> : null}
                </>
              ) : (
                <p className="detail-price">{formatPrice(precio)}</p>
              )}
            </div>
            <p className="detail-stock">{stockText}</p>

            <div className="detail-block">
              <h2 className="detail-subtitle">Descripcion</h2>
              <p className="detail-description">
                {String(descripcion).trim()
                  ? descripcion
                  : "Este producto aun no tiene descripcion publica."}
              </p>
            </div>

            <div className="detail-actions">
              <label className="qty-field">
                <span>Cantidad</span>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setQuantity(Number.isFinite(next) && next > 0 ? next : 1);
                  }}
                />
              </label>

              <button
                className="btn btn-primary add-btn"
                type="button"
                onClick={handleAddToCart}
                style={{ backgroundColor: "#059669", borderColor: "#059669", color: "#ffffff" }}
              >
                Agregar al Pedido
              </button>

              <button
                className="btn btn-ghost"
                type="button"
                onClick={handleBuyByWhatsapp}
                style={{ marginLeft: "10px" }}
              >
                Comprar de inmediato
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default ProductDetailPage;
