import React, { useMemo, useState } from "react";
import { getImageSrc } from "../../../utils";


const KIND_LABELS = {
  product: "Producto",
  lifestyle: "Contexto",
  promotional: "Con texto",
  missing: "Sin imagen",
  invalid: "Inválida",
};


function categoryIdOf(product) {
  return String(product.id_categoria_principal || product.id_categoria || "");
}


function pageKey(categoryId, pageIndex) {
  return `${categoryId || "uncategorized"}:${pageIndex}`;
}


export function buildEditorPages(products, categories, capacity) {
  const labels = new Map(categories.map((category) => [String(category.id_categoria), category.label || category.nombre]));
  const groups = new Map();
  products.forEach((product) => {
    const categoryId = categoryIdOf(product);
    if (!groups.has(categoryId)) groups.set(categoryId, []);
    groups.get(categoryId).push(product);
  });
  const pages = [];
  groups.forEach((items, categoryId) => {
    for (let offset = 0; offset < items.length; offset += capacity) {
      const pageIndex = Math.floor(offset / capacity);
      pages.push({
        key: pageKey(categoryId, pageIndex),
        categoryId,
        categoryName: labels.get(categoryId) || "Sin categoría",
        pageIndex,
        products: items.slice(offset, offset + capacity),
      });
    }
  });
  return pages;
}


export default function PdfPageEditor({ products, categories, options, updateOption, analysisById }) {
  const [open, setOpen] = useState(false);
  const capacity = options.template === "editorial" ? 3 : Number(options.products_per_page);
  const overrides = options.product_overrides || [];
  const overridesById = useMemo(() => new Map(overrides.map((item) => [String(item.product_id), item])), [overrides]);
  const orderedProducts = useMemo(() => products.map((product, index) => ({
    product,
    order: overridesById.get(String(product.id_producto))?.order ?? index,
    index,
  })).sort((a, b) => a.order - b.order || a.index - b.index).map((item) => item.product), [products, overridesById]);
  const pages = useMemo(() => buildEditorPages(orderedProducts, categories, capacity), [orderedProducts, categories, capacity]);

  const baseOverride = (product) => ({
    product_id: product.id_producto,
    order: orderedProducts.findIndex((item) => String(item.id_producto) === String(product.id_producto)),
    image_fit: "auto",
    image_position_x: Number(product.imagen_posicion_x ?? 50),
    image_position_y: Number(product.imagen_posicion_y ?? 50),
    image_zoom: Number(product.imagen_zoom ?? 100),
    show_name: true,
    show_description: null,
    show_attributes: null,
    price_display: "badge",
    remove_background: false,
  });

  const updateProduct = (product, changes) => {
    const id = String(product.id_producto);
    const current = overridesById.get(id) || baseOverride(product);
    const next = [...overrides.filter((item) => String(item.product_id) !== id), { ...current, ...changes }];
    updateOption("product_overrides", next);
  };

  const moveProduct = (product, direction) => {
    const currentIndex = orderedProducts.findIndex((item) => String(item.id_producto) === String(product.id_producto));
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= orderedProducts.length) return;
    if (categoryIdOf(orderedProducts[targetIndex]) !== categoryIdOf(product)) return;
    const reordered = [...orderedProducts];
    [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];
    const currentMap = new Map(overrides.map((item) => [String(item.product_id), item]));
    updateOption("product_overrides", reordered.map((item, order) => ({
      ...(currentMap.get(String(item.id_producto)) || baseOverride(item)),
      order,
    })));
  };

  const updatePage = (page, changes) => {
    const current = (options.page_overrides || []).find((item) => (
      String(item.category_id || "") === page.categoryId && Number(item.page_index) === page.pageIndex
    )) || { category_id: page.categoryId || null, page_index: page.pageIndex };
    const remaining = (options.page_overrides || []).filter((item) => !(
      String(item.category_id || "") === page.categoryId && Number(item.page_index) === page.pageIndex
    ));
    updateOption("page_overrides", [...remaining, { ...current, ...changes }]);
  };

  return (
    <section className="catalog-pdf-panel catalog-pdf-page-editor">
      <div className="catalog-pdf-panel-title">
        <span>5</span>
        <div><strong>Editor de páginas</strong><small>Reordena productos y corrige cada imagen sin modificar el catálogo original</small></div>
      </div>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen((value) => !value)}>
        {open ? "Cerrar editor" : `Abrir editor de ${pages.length} páginas`}
      </button>
      {open ? (
        <div className="catalog-pdf-editor-pages">
          {pages.map((page) => {
            const pageOverride = (options.page_overrides || []).find((item) => String(item.category_id || "") === page.categoryId && Number(item.page_index) === page.pageIndex) || {};
            return (
              <article className="catalog-pdf-editor-page" key={page.key}>
                <header>
                  <div><strong>{page.categoryName}</strong><small>Página {page.pageIndex + 1} de la categoría</small></div>
                  <label>Fondo <input type="color" value={pageOverride.background_color || options.background_color} onChange={(event) => updatePage(page, { background_color: event.target.value })} /></label>
                  <select value={pageOverride.background_style || options.background_style} onChange={(event) => updatePage(page, { background_style: event.target.value })}>
                    <option value="solid">Sólido</option><option value="gradient">Degradado</option><option value="organic">Orgánico</option><option value="editorial">Editorial</option>
                  </select>
                </header>
                <div className="catalog-pdf-editor-products">
                  {page.products.map((product) => {
                    const override = overridesById.get(String(product.id_producto)) || baseOverride(product);
                    const analysis = analysisById.get(String(product.id_producto));
                    return (
                      <details className="catalog-pdf-editor-product" key={product.id_producto}>
                        <summary>
                          <span className="catalog-pdf-editor-image">{product.imagen_url ? <img src={getImageSrc(product.imagen_url)} alt="" /> : <i>Sin imagen</i>}</span>
                          <span><strong>{product.nombre}</strong><small>{KIND_LABELS[analysis?.kind] || "Sin analizar"}</small></span>
                          <span className="catalog-pdf-order-actions"><button type="button" onClick={(event) => { event.preventDefault(); moveProduct(product, -1); }}>←</button><button type="button" onClick={(event) => { event.preventDefault(); moveProduct(product, 1); }}>→</button></span>
                        </summary>
                        <div className="catalog-pdf-product-controls">
                          <label>Ajuste<select value={override.image_fit} onChange={(event) => updateProduct(product, { image_fit: event.target.value })}><option value="auto">Automático</option><option value="contain">Completa</option><option value="cover">Rellenar</option></select></label>
                          <label>Zoom <span>{override.image_zoom}%</span><input type="range" min="80" max="200" value={override.image_zoom} onChange={(event) => updateProduct(product, { image_zoom: Number(event.target.value) })} /></label>
                          <label>Horizontal <span>{override.image_position_x}%</span><input type="range" min="0" max="100" value={override.image_position_x} onChange={(event) => updateProduct(product, { image_position_x: Number(event.target.value) })} /></label>
                          <label>Vertical <span>{override.image_position_y}%</span><input type="range" min="0" max="100" value={override.image_position_y} onChange={(event) => updateProduct(product, { image_position_y: Number(event.target.value) })} /></label>
                          <label>Precio<select value={override.price_display} onChange={(event) => updateProduct(product, { price_display: event.target.value })}><option value="badge">Destacado</option><option value="plain">Texto</option><option value="hidden">Ocultar</option></select></label>
                          <label className="check-row"><input type="checkbox" checked={override.show_name} onChange={(event) => updateProduct(product, { show_name: event.target.checked })} /> Mostrar nombre</label>
                          <label className="check-row"><input type="checkbox" checked={override.remove_background} onChange={(event) => updateProduct(product, { remove_background: event.target.checked })} /> Quitar fondo</label>
                        </div>
                      </details>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
