import React, { useMemo } from "react";
import { getImageSrc } from "../../../utils";


export default function CatalogPdfSmartPreview({ options, store, products, categoryCount }) {
  const previewCount = options.template === "editorial" ? 3 : Number(options.products_per_page);
  const overrides = useMemo(() => new Map((options.product_overrides || []).map((item) => [String(item.product_id), item])), [options.product_overrides]);
  return (
    <div className={`catalog-pdf-page-preview catalog-pdf-advanced-preview is-${options.template} background-${options.background_style}`} style={{
      "--pdf-primary": options.primary_color,
      "--pdf-secondary": options.secondary_color,
      "--pdf-background": options.background_color,
      "--pdf-background-end": options.gradient_end_color,
      "--pdf-text": options.text_color,
      "--pdf-price": options.price_color,
    }}>
      <span className="catalog-pdf-preview-orb orb-one" /><span className="catalog-pdf-preview-orb orb-two" />
      <div className="catalog-pdf-preview-brand">{store?.nombre_tienda || "MI TIENDA"}</div>
      <h3>{options.title || "Catálogo de productos"}</h3>
      <div className={`catalog-pdf-preview-grid is-${previewCount}`}>
        {products.slice(0, previewCount).map((product, index) => {
          const override = overrides.get(String(product.id_producto)) || {};
          const priceDisplay = override.price_display || "badge";
          return (
            <article key={product.id_producto} className={index === 0 ? "is-featured" : ""}>
              <div className={`shape-${options.image_shape}`}>
                {product.imagen_url ? <img src={getImageSrc(product.imagen_url)} alt="" style={{ objectFit: override.image_fit === "cover" ? "cover" : "contain", objectPosition: `${override.image_position_x ?? 50}% ${100 - (override.image_position_y ?? 50)}%`, transform: `scale(${(override.image_zoom || 100) / 100})` }} /> : <span>Sin imagen</span>}
              </div>
              {override.show_name !== false ? <strong>{product.nombre}</strong> : null}
              {priceDisplay !== "hidden" ? <small className={priceDisplay === "plain" ? "price-plain" : `price-${options.price_style}`}>{store?.currency_symbol || "Bs"} {Number(product.precio_venta || 0).toFixed(2)}</small> : null}
              {options.show_description && override.show_description !== false && product.descripcion ? <p>{product.descripcion}</p> : null}
            </article>
          );
        })}
      </div>
      <footer>{categoryCount > 0 ? "Organizado por categorías" : "Catálogo de productos"}</footer>
    </div>
  );
}
