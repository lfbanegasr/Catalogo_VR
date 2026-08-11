import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getImageSrc } from "../../utils";

export default function ProductPicker({
  open,
  products = [],
  categoryOptions = [],
  selectedIds = [],
  onSelect,
  onClose,
  title = "Agregar producto al set",
}) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const searchRef = useRef(null);
  const selectedSet = useMemo(() => new Set(selectedIds.filter(Boolean)), [selectedIds]);
  const categoryMap = useMemo(
    () => new Map(categoryOptions.map((category) => [String(category.id_categoria), category.label || category.nombre])),
    [categoryOptions],
  );

  const availableCategories = useMemo(() => {
    const ids = new Set(products.map((product) => String(
      product.id_categoria_principal || product.id_categoria || "",
    )).filter(Boolean));
    return categoryOptions.filter((category) => ids.has(String(category.id_categoria)));
  }, [products, categoryOptions]);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return products.filter((product) => {
      if (selectedSet.has(product.id_producto)) return false;
      const productCategoryId = String(product.id_categoria_principal || product.id_categoria || "");
      if (categoryId && productCategoryId !== categoryId) return false;
      if (!normalized) return true;
      return [product.nombre, product.descripcion, product.id_producto]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [products, selectedSet, categoryId, query]);

  useEffect(() => {
    if (!open) return undefined;
    setQuery("");
    setCategoryId("");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 80);
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="product-picker-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="product-picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-picker-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="product-picker-head">
          <div>
            <h3 id="product-picker-title">{title}</h3>
            <p>Busca por nombre, descripcion o identificador.</p>
          </div>
          <button type="button" className="icon-close-btn" onClick={onClose} aria-label="Cerrar selector">×</button>
        </header>

        <div className="product-picker-filters">
          <label>
            Buscar producto
            <div className="smart-search product-picker-search">
              <span aria-hidden="true">⌕</span>
              <input
                ref={searchRef}
                value={query}
                autoComplete="off"
                placeholder="Ej. Anillo Pandora..."
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && results.length > 0) {
                    event.preventDefault();
                    onSelect(results[0]);
                  }
                }}
              />
              {query ? (
                <button type="button" onClick={() => setQuery("")} aria-label="Limpiar busqueda">×</button>
              ) : null}
            </div>
          </label>
          <label>
            Categoria
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Todas las categorias</option>
              {availableCategories.map((category) => (
                <option key={category.id_categoria} value={category.id_categoria}>
                  {category.label || category.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="product-picker-summary">
          <span>{results.length} {results.length === 1 ? "resultado" : "resultados"}</span>
          <small>Los productos ya incluidos no se muestran.</small>
        </div>

        <div className="product-picker-results">
          {results.length === 0 ? (
            <div className="product-picker-empty">
              <strong>No encontramos productos disponibles</strong>
              <span>Prueba otra busqueda o categoria.</span>
            </div>
          ) : results.map((product) => {
            const productCategoryId = product.id_categoria_principal || product.id_categoria;
            const imageUrl = product.imagen_url || product.imagenes?.[0] || "";
            return (
              <button
                type="button"
                className="product-picker-item"
                key={product.id_producto}
                onClick={() => onSelect(product)}
              >
                <span className="product-picker-thumb">
                  {imageUrl ? (
                    <img src={getImageSrc(imageUrl)} alt="" />
                  ) : (
                    <span>{String(product.nombre || "P").slice(0, 1).toUpperCase()}</span>
                  )}
                </span>
                <span className="product-picker-copy">
                  <strong>{product.nombre}</strong>
                  <small>{categoryMap.get(String(productCategoryId || "")) || "Sin categoria"}</small>
                </span>
                <span className="product-picker-stock">
                  <strong>{Number(product.stock_actual || 0)}</strong>
                  <small>{product.tiene_variantes ? "entre variantes" : "en stock"}</small>
                </span>
                <span className="product-picker-add">Agregar</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>,
    document.body,
  );
}
