import React from "react";


export default function PdfContentPanel({
  allCategories,
  setAllCategories,
  labeledCategories,
  products,
  selectedCategoryIds,
  toggleCategory,
  options,
  updateOption,
}) {
  return (
    <section className="catalog-pdf-panel">
      <div className="catalog-pdf-panel-title">
        <span>1</span>
        <div><strong>Contenido</strong><small>Productos que aparecerán en el archivo</small></div>
      </div>
      <div className="catalog-pdf-scope">
        <button type="button" className={allCategories ? "is-selected" : ""} onClick={() => setAllCategories(true)}>
          <strong>Todo el catálogo</strong>
          <span>Separado automáticamente por categoría</span>
        </button>
        <button type="button" className={!allCategories ? "is-selected" : ""} onClick={() => setAllCategories(false)}>
          <strong>Elegir categorías</strong>
          <span>Solo las colecciones seleccionadas</span>
        </button>
      </div>
      {!allCategories ? (
        <div className="catalog-pdf-category-list">
          {labeledCategories.filter((category) => category.activa || !options.only_active_products).map((category) => {
            const categoryId = String(category.id_categoria);
            const directCount = products.filter((product) => (
              String(product.id_categoria_principal || product.id_categoria || "") === categoryId
              && (!options.only_active_products || product.activo)
            )).length;
            return (
              <label key={categoryId}>
                <input type="checkbox" checked={selectedCategoryIds.includes(categoryId)} onChange={() => toggleCategory(categoryId)} />
                <span><strong>{category.label}</strong><small>{directCount} productos directos</small></span>
              </label>
            );
          })}
        </div>
      ) : null}
      <div className="catalog-pdf-checks">
        <label><input type="checkbox" checked={options.include_descendants} onChange={(event) => updateOption("include_descendants", event.target.checked)} /> Incluir subcategorías</label>
        <label><input type="checkbox" checked={options.include_uncategorized} onChange={(event) => updateOption("include_uncategorized", event.target.checked)} /> Incluir productos sin categoría</label>
        <label><input type="checkbox" checked={options.only_active_products} onChange={(event) => updateOption("only_active_products", event.target.checked)} /> Solo productos activos</label>
      </div>
    </section>
  );
}
