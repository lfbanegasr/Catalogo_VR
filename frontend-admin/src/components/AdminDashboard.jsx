import { useState, useEffect } from "react";
import { api, buildAssetUrl } from "../api.js";

export function AdminDashboard({ tiendaRef }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Estado para guardar valores locales editados (para stock y precio rápido)
  const [editedValues, setEditedValues] = useState({});

  // Estado del formulario de nuevo producto
  const [newProduct, setNewProduct] = useState({
    nombre: "",
    descripcion: "",
    precio_venta: "",
    stock_actual: "",
    id_categoria: "",
  });
  const [categories, setCategories] = useState([]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [prodData, catData] = await Promise.all([
        api.listProductos(tiendaRef),
        api.listCategorias(tiendaRef),
      ]);
      setProducts(prodData || []);
      setCategories(catData || []);
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar la información del panel.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tiendaRef]);

  // Manejar edición local rápida
  const handleLocalChange = (productId, field, value) => {
    setEditedValues((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value,
      },
    }));
  };

  // Guardar cambio rápido en el servidor
  const handleQuickSave = async (productId) => {
    const changes = editedValues[productId];
    if (!changes) return;

    // Validar y construir payload de actualización
    const payload = {};
    if (changes.precio_venta !== undefined) payload.precio_venta = Number(changes.precio_venta);
    if (changes.stock_actual !== undefined) payload.stock_actual = Number(changes.stock_actual);

    try {
      await api.updateProducto(productId, payload, tiendaRef);
      // Limpiar cambios locales para este producto
      setEditedValues((prev) => {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      });
      // Recargar lista
      loadData();
      alert("¡Producto actualizado!");
    } catch (err) {
      console.error(err);
      alert("Error al actualizar producto: " + err.message);
    }
  };

  // Crear producto nuevo
  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!newProduct.nombre || !newProduct.precio_venta) {
      alert("Por favor, introduce al menos el nombre y el precio.");
      return;
    }

    const payload = {
      nombre: newProduct.nombre,
      descripcion: newProduct.descripcion,
      precio_venta: Number(newProduct.precio_venta),
      stock_actual: Number(newProduct.stock_actual || 0),
      id_categoria: newProduct.id_categoria || null,
    };

    try {
      await api.createProducto(payload, tiendaRef);
      setShowAddModal(false);
      setNewProduct({
        nombre: "",
        descripcion: "",
        precio_venta: "",
        stock_actual: "",
        id_categoria: "",
      });
      loadData();
      alert("¡Producto creado con éxito!");
    } catch (err) {
      console.error(err);
      alert("Error al crear producto: " + err.message);
    }
  };

  if (loading && products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-500 text-sm font-medium">Cargando inventario...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 relative">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-5 py-6 sticky top-0 z-30 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-gray-800">Panel de Control</h1>
          <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wider font-bold">Gestión de Stock rápido</p>
        </div>
        <button onClick={loadData} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition" title="Refrescar">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3m0 0l3 3m-3-3v12" />
          </svg>
        </button>
      </header>

      {/* Alertas o errores */}
      {error && (
        <div className="mx-5 mt-4 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Lista de productos Mobile-First (Formato lista compacto) */}
      <main className="px-5 mt-5">
        <div className="space-y-3">
          {products.map((product) => {
            const tempValues = editedValues[product.id_producto] || {};
            const localPrice = tempValues.precio_venta !== undefined ? tempValues.precio_venta : product.precio_venta;
            const localStock = tempValues.stock_actual !== undefined ? tempValues.stock_actual : product.stock_actual;
            const isModified = tempValues.precio_venta !== undefined || tempValues.stock_actual !== undefined;

            return (
              <div key={product.id_producto} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  {/* Foto de miniatura */}
                  <div className="w-12 h-12 bg-gray-100 rounded-xl overflow-hidden flex-none flex items-center justify-center">
                    {product.imagen_url ? (
                      <img src={buildAssetUrl(product.imagen_url)} alt={product.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-gray-400 font-bold">Sin foto</span>
                    )}
                  </div>
                  {/* Título e Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-gray-800 truncate">{product.nombre}</h3>
                    <p className="text-[10px] text-gray-400 truncate mt-0.5">{product.descripcion || "Sin descripción"}</p>
                  </div>
                </div>

                {/* Controles de edición rápida */}
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {/* Campo de precio */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Precio (Bs.)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={localPrice}
                      onChange={(e) => handleLocalChange(product.id_producto, "precio_venta", e.target.value)}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold bg-gray-50 focus:bg-white focus:border-indigo-500 transition duration-150"
                    />
                  </div>
                  {/* Campo de stock */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Stock Actual</label>
                    <input
                      type="number"
                      value={localStock}
                      onChange={(e) => handleLocalChange(product.id_producto, "stock_actual", e.target.value)}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold bg-gray-50 focus:bg-white focus:border-indigo-500 transition duration-150"
                    />
                  </div>
                </div>

                {/* Botón de guardar cambios rápidos */}
                {isModified && (
                  <button
                    onClick={() => handleQuickSave(product.id_producto)}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-xl shadow-xs transition"
                  >
                    Guardar Cambios
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* Floating Action Button (FAB) */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-6 right-6 bg-indigo-600 hover:bg-indigo-700 text-white p-4.5 rounded-full shadow-2xl active:scale-95 transition-transform duration-100 z-40"
        title="Añadir Producto"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Modal de añadir producto */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-[360px] rounded-3xl p-5 shadow-2xl flex flex-col gap-4 animate-scale-up">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-gray-800">Nuevo Producto</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded-full hover:bg-gray-100 transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Nombre del Producto</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Marcadores de Arte"
                  value={newProduct.nombre}
                  onChange={(e) => setNewProduct({ ...newProduct, nombre: e.target.value })}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-xs bg-gray-50 focus:bg-white focus:border-indigo-500 transition"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Descripción</label>
                <textarea
                  placeholder="Opcional..."
                  value={newProduct.descripcion}
                  onChange={(e) => setNewProduct({ ...newProduct, descripcion: e.target.value })}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-xs bg-gray-50 focus:bg-white focus:border-indigo-500 transition min-h-[60px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Precio (Bs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={newProduct.precio_venta}
                    onChange={(e) => setNewProduct({ ...newProduct, precio_venta: e.target.value })}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-xs bg-gray-50 focus:bg-white focus:border-indigo-500 transition"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Stock Inicial</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={newProduct.stock_actual}
                    onChange={(e) => setNewProduct({ ...newProduct, stock_actual: e.target.value })}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-xs bg-gray-50 focus:bg-white focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Categoría</label>
                <select
                  value={newProduct.id_categoria}
                  onChange={(e) => setNewProduct({ ...newProduct, id_categoria: e.target.value })}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-xs bg-gray-50 focus:bg-white focus:border-indigo-500 transition"
                >
                  <option value="">Ninguna</option>
                  {categories.map((cat) => (
                    <option key={cat.id_categoria} value={cat.id_categoria}>
                      {cat.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold mt-4 shadow-md transition"
              >
                Crear Producto
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
