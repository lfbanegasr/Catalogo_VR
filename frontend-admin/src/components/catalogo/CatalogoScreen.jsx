import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api';
import { Card } from '../Card';
import StoreRefPicker from '../StoreRefPicker';
import ImageDropZone from '../ImageDropZone';
import { getImageSrc } from '../../utils';

export default function CatalogoScreen({ isSuperadmin }) {
  const [tab, setTab] = useState("categorias");
  const [stores, setStores] = useState([]);
  const [rows, setRows] = useState([]);
  const [categoriasDisponibles, setCategoriasDisponibles] = useState([]);
  const [tenantId, setTenantId] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [pendingImageFile, setPendingImageFile] = useState(null);
  const [busyImageProductId, setBusyImageProductId] = useState("");
  const [uploadMetaByProduct, setUploadMetaByProduct] = useState({});
  const [productQuery, setProductQuery] = useState("");
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [form, setForm] = useState(tab === "categorias" ? { nombre: "", activa: true } : { nombre: "", descripcion: "", precio_venta: 0, stock_actual: 0, nombre_categoria: "", activo: true });
  const categoriaMap = useMemo(
    () => new Map(categoriasDisponibles.map((c) => [c.id_categoria, c.nombre])),
    [categoriasDisponibles],
  );
  const selectedStore = useMemo(
    () => stores.find((store) => store.id_tienda === tenantId) || null,
    [stores, tenantId],
  );
  const selectedStoreRef = isSuperadmin
    ? selectedStore?.slug || selectedStore?.nombre_tienda || ""
    : undefined;
  const filteredProductRows = useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    return rows.filter((product) => {
      if (categoriaFiltro) {
        const categoriaId = String(product.id_categoria || "");
        if (categoriaId !== categoriaFiltro) return false;
      }
      if (!query) return true;
      const haystack = [
        product.nombre,
        product.descripcion,
        product.id_producto,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [rows, productQuery, categoriaFiltro]);
  const productSuggestions = useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    if (!query) return [];
    const unique = new Set();
    const matches = [];
    for (const product of rows) {
      const label = String(product.nombre || "").trim();
      if (!label) continue;
      if (label.toLowerCase().includes(query) && !unique.has(label.toLowerCase())) {
        unique.add(label.toLowerCase());
        matches.push(label);
      }
      if (matches.length >= 6) break;
    }
    return matches;
  }, [rows, productQuery]);
  const assertStoreSelected = () => {
    if (isSuperadmin && !selectedStoreRef) {
      throw new Error("Selecciona una tienda");
    }
  };

  const resetFormForTab = (nextTab) =>
    setForm(
      nextTab === "categorias"
        ? { nombre: "", activa: true }
        : { nombre: "", descripcion: "", precio_venta: 0, stock_actual: 0, nombre_categoria: "", activo: true },
    );

  const loadStores = async () => {
    if (!isSuperadmin) return;
    const data = await api.adminListTiendas();
    setStores(data);
    if (!tenantId && data[0]?.id_tienda) {
      setTenantId(data[0].id_tienda);
    }
  };

  const load = async () => {
    if (isSuperadmin && !selectedStoreRef) {
      setRows([]);
      setCategoriasDisponibles([]);
      return;
    }
    const data = tab === "categorias"
      ? await api.listCategorias(selectedStoreRef)
      : await api.listProductos(selectedStoreRef);
    setRows(data);
    if (tab === "categorias") {
      setCategoriasDisponibles(data);
      return;
    }
    const categorias = await api.listCategorias(selectedStoreRef);
    setCategoriasDisponibles(categorias);
  };

  const handleReload = async () => {
    setError("");
    if (isSuperadmin) {
      await loadStores();
    }
    await load();
  };

  const uploadImage = async (idProducto, file) => {
    if (!file || !idProducto) return;
    setBusyImageProductId(idProducto);
    setUploadMetaByProduct((prev) => ({
      ...prev,
      [idProducto]: {
        fileName: file.name,
        status: "Subiendo imagen...",
        error: "",
      },
    }));
    try {
      const payload = await api.uploadProductoImage(idProducto, file);
      await load();
      setUploadMetaByProduct((prev) => ({
        ...prev,
        [idProducto]: {
          fileName: file.name,
          status: "Imagen guardada",
          error: "",
        },
      }));
      return payload;
    } finally {
      setBusyImageProductId("");
    }
  };

  useEffect(() => {
    loadStores().catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [tab, selectedStoreRef]);
  useEffect(() => {
    resetFormForTab(tab);
    setEditing(null);
    setPendingImageFile(null);
    setProductQuery("");
    setCategoriaFiltro("");
    if (tab !== "productos") {
      setProductSearchOpen(false);
    }
  }, [tab, selectedStoreRef]);

  return (
    <Card title="Catálogo privado" className="catalog-compact">
      <div className="catalog-toolbar">
        <div className="catalog-tabs">
          <button className={`tab-btn ${tab === "categorias" ? "active" : ""}`} onClick={() => setTab("categorias")}>Categorías</button>
          <button className={`tab-btn ${tab === "productos" ? "active" : ""}`} onClick={() => setTab("productos")}>Productos</button>
        </div>
        <div className="catalog-controls">
          {isSuperadmin ? (
            <StoreRefPicker
              stores={stores}
              value={tenantId}
              onChange={setTenantId}
              required
            />
          ) : <div className="catalog-controls-spacer" />}
          <button className="btn btn-ghost catalog-refresh" onClick={() => handleReload().catch((e) => setError(e.message))}>Recargar</button>
        </div>
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      {tab === "productos" ? (
        <div className="product-filters">
          <label>
            Buscar producto
            <div className="smart-search">
              <input
                value={productQuery}
                autoComplete="off"
                placeholder="Nombre, descripción o ID..."
                onFocus={() => setProductSearchOpen(true)}
                onBlur={() => window.setTimeout(() => setProductSearchOpen(false), 120)}
                onChange={(event) => setProductQuery(event.target.value)}
              />
              {productSearchOpen && productSuggestions.length > 0 ? (
                <div className="smart-search-list">
                  {productSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="smart-search-item"
                      onClick={() => {
                        setProductQuery(suggestion);
                        setProductSearchOpen(false);
                      }}
                    >
                      <span>{suggestion}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </label>
          <label>
            Categoría
            <select
              value={categoriaFiltro}
              onChange={(event) => setCategoriaFiltro(event.target.value)}
            >
              <option value="">Todas</option>
              {categoriasDisponibles.map((c) => (
                <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setProductQuery("");
              setCategoriaFiltro("");
            }}
          >
            Limpiar filtros
          </button>
        </div>
      ) : null}

      {/* --- VISTA DESKTOP: TABLA --- */}
      <div className="table-wrap desktop-only">
        <table>
          <thead>
            {tab === "categorias"
              ? <tr><th>ID</th><th>Nombre</th><th>Activa</th><th>Acciones</th></tr>
              : <tr><th>ID</th><th>Nombre</th><th>Precio</th><th>Stock</th><th>Activo</th><th>Imagen</th><th>Acciones</th></tr>}
          </thead>
          <tbody>
            {(tab === "productos" ? filteredProductRows : rows).map((r) => {
              if (tab === "categorias") {
                if (!r.id_categoria) return null;
                return (
                  <tr key={r.id_categoria}>
                    <td className="small-id">{r.id_categoria.substring(0, 8)}...</td>
                    <td className="font-semibold">{r.nombre}</td>
                    <td>
                      <span className={`status-badge ${r.activa ? "active" : "inactive"}`}>
                        {r.activa ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button className="btn btn-ghost" onClick={() => setEditing({ mode: "categoria", row: r })}>Editar</button>
                      <button className={`btn ${r.activa ? "btn-danger-ghost" : "btn-success-ghost"}`} onClick={async () => { try { assertStoreSelected(); await api.updateCategoria(r.id_categoria, { activa: !r.activa }, selectedStoreRef); await load(); } catch (e) { setError(e.message); } }}>{r.activa ? "Desactivar" : "Activar"}</button>
                    </td>
                  </tr>
                );
              } else {
                if (!r.id_producto) return null;
                return (
                  <tr key={r.id_producto}>
                    <td className="small-id">{r.id_producto.substring(0, 8)}...</td>
                    <td className="font-semibold">{r.nombre}</td>
                    <td className="price-cell">{r.precio_venta} Bs.</td>
                    <td>
                      <span className={`stock-badge ${r.stock_actual <= 5 ? "low" : ""}`}>
                        {r.stock_actual}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${r.activo ? "active" : "inactive"}`}>
                        {r.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td>
                      {r.imagen_url ? (
                        <div className="table-img-wrapper">
                          <img src={getImageSrc(r.imagen_url)} alt="" className="table-thumb" />
                        </div>
                      ) : (
                        <span className="no-image-text">Sin imagen</span>
                      )}
                    </td>
                    <td className="actions-cell">
                      <button className="btn btn-ghost" onClick={() => setEditing({ mode: "producto", row: { ...r, nombre_categoria: r.id_categoria ? (categoriaMap.get(r.id_categoria) || "") : "" } })}>Editar</button>
                      <button className={`btn ${r.activo ? "btn-danger-ghost" : "btn-success-ghost"}`} onClick={async () => { try { assertStoreSelected(); await api.updateProducto(r.id_producto, { activo: !r.activo }, selectedStoreRef); await load(); } catch (e) { setError(e.message); } }}>{r.activo ? "Desactivar" : "Activar"}</button>
                      <ImageDropZone
                        compact
                        title={busyImageProductId === r.id_producto ? "Subiendo..." : "Imagen"}
                        subtitle="Arrastra o selecciona"
                        selectedFileName={uploadMetaByProduct[r.id_producto]?.fileName || ""}
                        statusText={uploadMetaByProduct[r.id_producto]?.status || ""}
                        errorText={uploadMetaByProduct[r.id_producto]?.error || ""}
                        disabled={busyImageProductId === r.id_producto}
                        onFileSelected={async (file) => {
                          try {
                            await uploadImage(r.id_producto, file);
                          } catch (err) {
                            const message = err.message || "No se pudo subir la imagen";
                            setError(message);
                            setUploadMetaByProduct((prev) => ({
                              ...prev,
                              [r.id_producto]: {
                                fileName: file?.name || "",
                                status: "",
                                error: message,
                              },
                            }));
                          }
                        }}
                      />
                    </td>
                  </tr>
                );
              }
            })}
          </tbody>
        </table>
      </div>

      {/* --- VISTA MOBILE: TARJETAS --- */}
      <div className="mobile-only mobile-cards-grid">
        {tab === "categorias" ? (
          rows.map((r) => {
            if (!r.id_categoria) return null;
            return (
              <div key={r.id_categoria} className="admin-card category-card">
                <div className="card-info">
                  <span className="card-id">ID: {r.id_categoria.substring(0, 8)}...</span>
                  <h4 className="card-name">{r.nombre}</h4>
                  <span className={`status-badge ${r.activa ? "active" : "inactive"}`}>
                    {r.activa ? "Activa" : "Inactiva"}
                  </span>
                </div>
                <div className="card-actions">
                  <button className="btn btn-ghost" onClick={() => setEditing({ mode: "categoria", row: r })}>Editar</button>
                  <button 
                    className={`btn ${r.activa ? "btn-danger-ghost" : "btn-success-ghost"}`} 
                    onClick={async () => { 
                      try { 
                        assertStoreSelected(); 
                        await api.updateCategoria(r.id_categoria, { activa: !r.activa }, selectedStoreRef); 
                        await load(); 
                      } catch (e) { 
                        setError(e.message); 
                      } 
                    }}
                  >
                    {r.activa ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          filteredProductRows.map((r) => {
            if (!r.id_producto) return null;
            return (
              <div key={r.id_producto} className="admin-card product-card">
                <div className="product-card-header">
                  <div className="product-card-img">
                    {r.imagen_url ? (
                      <img src={getImageSrc(r.imagen_url)} alt={r.nombre} />
                    ) : (
                      <div className="placeholder-img"><span className="icon">🛍️</span></div>
                    )}
                  </div>
                  <div className="product-card-main">
                    <span className="card-id">ID: {r.id_producto.substring(0, 8)}...</span>
                    <h4 className="card-name">{r.nombre}</h4>
                    <div className="product-card-metrics">
                      <span className="price-tag">{r.precio_venta} Bs.</span>
                      <span className={`stock-tag ${r.stock_actual <= 5 ? "low" : ""}`}>{r.stock_actual} en stock</span>
                    </div>
                  </div>
                </div>
                
                <div className="product-card-footer">
                  <span className={`status-badge ${r.activo ? "active" : "inactive"}`}>
                    {r.activo ? "Activo" : "Inactivo"}
                  </span>
                  <div className="card-actions">
                    <button className="btn btn-ghost" onClick={() => setEditing({ mode: "producto", row: { ...r, nombre_categoria: r.id_categoria ? (categoriaMap.get(r.id_categoria) || "") : "" } })}>
                      Editar
                    </button>
                    <button 
                      className={`btn ${r.activo ? "btn-danger-ghost" : "btn-success-ghost"}`} 
                      onClick={async () => { 
                        try { 
                          assertStoreSelected(); 
                          await api.updateProducto(r.id_producto, { activo: !r.activo }, selectedStoreRef); 
                          await load(); 
                        } catch (e) { 
                          setError(e.message); 
                        } 
                      }}
                    >
                      {r.activo ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </div>
                
                <div className="product-card-image-upload">
                  <ImageDropZone
                    compact
                    title={busyImageProductId === r.id_producto ? "Subiendo..." : "Imagen"}
                    subtitle="Arrastra o selecciona"
                    selectedFileName={uploadMetaByProduct[r.id_producto]?.fileName || ""}
                    statusText={uploadMetaByProduct[r.id_producto]?.status || ""}
                    errorText={uploadMetaByProduct[r.id_producto]?.error || ""}
                    disabled={busyImageProductId === r.id_producto}
                    onFileSelected={async (file) => {
                      try {
                        await uploadImage(r.id_producto, file);
                      } catch (err) {
                        const message = err.message || "No se pudo subir la imagen";
                        setError(message);
                        setUploadMetaByProduct((prev) => ({
                          ...prev,
                          [r.id_producto]: {
                            fileName: file?.name || "",
                            status: "",
                            error: message,
                          },
                        }));
                      }
                    }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="inline-editor">
        <h4>{editing ? `Editar ${editing.mode}` : `Crear ${tab === "categorias" ? "categoría" : "producto"}`}</h4>
        {editing ? (
          <div className="grid-form">
            <label>Nombre<input value={editing.row.nombre || ""} onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, nombre: e.target.value } }))} /></label>
            {editing.mode === "categoria" ? (
              <label className="check-row"><input type="checkbox" checked={!!editing.row.activa} onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, activa: e.target.checked } }))} />Activa</label>
            ) : (
              <>
                <label>Descripción<textarea value={editing.row.descripcion || ""} onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, descripcion: e.target.value } }))} /></label>
                <label>Precio<input type="number" step="0.01" value={editing.row.precio_venta || 0} onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, precio_venta: e.target.value } }))} /></label>
                <label>Stock<input type="number" value={editing.row.stock_actual || 0} onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, stock_actual: e.target.value } }))} /></label>
                <label>Categoría<select value={editing.row.nombre_categoria || ""} onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, nombre_categoria: e.target.value } }))}><option value="">Sin categoría</option>{categoriasDisponibles.map((c) => <option key={c.id_categoria} value={c.nombre}>{c.nombre}</option>)}</select></label>
                <div className="current-image-card">
                  <p className="current-image-label">Imagen actual</p>
                  {editing.row.imagen_url ? (
                    <div className="current-image-content">
                      <img
                        src={getImageSrc(editing.row.imagen_url)}
                        alt={editing.row.nombre || "Producto"}
                        className="current-image-preview"
                      />
                      <a href={getImageSrc(editing.row.imagen_url)} target="_blank" rel="noreferrer" className="current-image-link">
                        Ver imagen
                      </a>
                    </div>
                  ) : (
                    <p className="muted small">Este producto aún no tiene imagen.</p>
                  )}
                </div>
                <ImageDropZone
                  title="Actualizar imagen"
                  subtitle="Arrastra y suelta o selecciona archivo"
                  statusText={editing.row.imagen_url ? "Imagen guardada en catálogo" : ""}
                  disabled={busyImageProductId === editing.row.id_producto}
                  onFileSelected={async (file) => {
                    try {
                      const result = await uploadImage(editing.row.id_producto, file);
                      if (result?.imagen_url) {
                        setEditing((prev) => ({
                          ...prev,
                          row: { ...prev.row, imagen_url: result.imagen_url },
                        }));
                      }
                    } catch (err) {
                      setError(err.message);
                    }
                  }}
                />
                <label className="check-row"><input type="checkbox" checked={!!editing.row.activo} onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, activo: e.target.checked } }))} />Activo</label>
              </>
            )}
            <div className="row">
              <button className="btn btn-primary" onClick={async () => {
                try {
                  assertStoreSelected();
                  if (editing.mode === "categoria") {
                    await api.updateCategoria(editing.row.id_categoria, { nombre: editing.row.nombre, activa: editing.row.activa }, selectedStoreRef);
                  } else {
                    await api.updateProducto(editing.row.id_producto, {
                      nombre: editing.row.nombre,
                      descripcion: editing.row.descripcion || "",
                      precio_venta: Number(editing.row.precio_venta || 0),
                      stock_actual: Number(editing.row.stock_actual || 0),
                      nombre_categoria: editing.row.nombre_categoria || null,
                      activo: editing.row.activo,
                    }, selectedStoreRef);
                  }
                  setEditing(null);
                  await load();
                } catch (e) { setError(e.message); }
              }}>Guardar</button>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>
            </div>
          </div>
        ) : (
          <form className="grid-form" onSubmit={async (e) => {
            e.preventDefault();
            try {
              assertStoreSelected();
              if (tab === "categorias") {
                await api.createCategoria(form, selectedStoreRef);
              } else {
                const created = await api.createProducto({
                  ...form,
                  precio_venta: Number(form.precio_venta || 0),
                  stock_actual: Number(form.stock_actual || 0),
                  nombre_categoria: form.nombre_categoria || null,
                }, selectedStoreRef);
                if (pendingImageFile && created?.id_producto) {
                  await uploadImage(created.id_producto, pendingImageFile);
                }
              }
              resetFormForTab(tab);
              setPendingImageFile(null);
              await load();
            } catch (err) { setError(err.message); }
          }}>
            <label>Nombre<input value={form.nombre} onChange={(e) => setForm((s) => ({ ...s, nombre: e.target.value }))} required /></label>
            {tab === "categorias" ? (
              <label className="check-row"><input type="checkbox" checked={form.activa} onChange={(e) => setForm((s) => ({ ...s, activa: e.target.checked }))} />Activa</label>
            ) : (
              <>
                <label>Descripción<textarea value={form.descripcion} onChange={(e) => setForm((s) => ({ ...s, descripcion: e.target.value }))} /></label>
                <label>Precio<input type="number" step="0.01" value={form.precio_venta} onChange={(e) => setForm((s) => ({ ...s, precio_venta: e.target.value }))} required /></label>
                <label>Stock<input type="number" value={form.stock_actual} onChange={(e) => setForm((s) => ({ ...s, stock_actual: e.target.value }))} /></label>
                <label>Categoría<select value={form.nombre_categoria} onChange={(e) => setForm((s) => ({ ...s, nombre_categoria: e.target.value }))}><option value="">Sin categoría</option>{categoriasDisponibles.map((c) => <option key={c.id_categoria} value={c.nombre}>{c.nombre}</option>)}</select></label>
                <ImageDropZone
                  title="Imagen del producto"
                  subtitle="La imagen se sube al guardar el producto"
                  selectedFileName={pendingImageFile?.name || ""}
                  onFileSelected={setPendingImageFile}
                />
                <label className="check-row"><input type="checkbox" checked={form.activo} onChange={(e) => setForm((s) => ({ ...s, activo: e.target.checked }))} />Activo</label>
              </>
            )}
            <button className="btn btn-primary">Crear</button>
          </form>
        )}
      </div>
    </Card>
  );
}
