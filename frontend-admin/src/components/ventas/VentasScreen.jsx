import React, { useState, useEffect, Fragment } from 'react';
import { api, buildAssetUrl } from '../../api';
import { Card } from '../Card';

export default function VentasScreen({ user }) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Detalle expandido
  const [expandedSaleId, setExpandedSaleId] = useState(null);
  const [saleDetails, setSaleDetails] = useState({});
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Filtros
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal venta fisica
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [allProducts, setAllProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [quantitiesByProduct, setQuantitiesByProduct] = useState({});
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [saleItems, setSaleItems] = useState([]);
  const [savingSale, setSavingSale] = useState(false);

  const loadSales = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.listVentas(user.id_tienda);
      setSales(data || []);
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar el historial de ventas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, [user.id_tienda]);

  const toggleDetails = async (idVenta) => {
    if (expandedSaleId === idVenta) {
      setExpandedSaleId(null);
      return;
    }

    setExpandedSaleId(idVenta);
    if (saleDetails[idVenta]) return; // ya cargados

    setLoadingDetails(true);
    try {
      const data = await api.getVenta(idVenta, user.id_tienda);
      setSaleDetails(prev => ({
        ...prev,
        [idVenta]: data
      }));
    } catch (err) {
      console.error("Error al cargar detalles de la venta:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleStatusChange = async (idVenta, nextEstado) => {
    if (!window.confirm(`¿Estás seguro de cambiar el estado de este pedido a '${nextEstado}'?`)) return;
    try {
      await api.updateVentaEstado(idVenta, nextEstado);
      alert("¡Estado del pedido actualizado!");
      loadSales();
      // Limpiar detalle en cache para forzar recarga si se expande
      setSaleDetails(prev => {
        const copy = { ...prev };
        delete copy[idVenta];
        return copy;
      });
    } catch (err) {
      console.error(err);
      alert("Error al cambiar estado: " + err.message);
    }
  };

  const openSaleModal = async () => {
    setSaleItems([]);
    setSelectedCategoryId("all");
    setProductSearchQuery("");
    setQuantitiesByProduct({});
    setShowSaleModal(true);
    setLoadingProducts(true);
    try {
      const [prodList, catList] = await Promise.all([
        api.listProductos(),
        api.listCategorias()
      ]);
      setAllProducts(prodList || []);
      setCategories(catList || []);
      
      const qtys = {};
      (prodList || []).forEach(p => {
        qtys[p.id_producto] = 1;
      });
      setQuantitiesByProduct(qtys);
    } catch (err) {
      console.error("Error al cargar datos para venta física:", err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleAddProductToSale = (prod, qty) => {
    if (!prod) return;
    if (prod.stock_actual < qty) {
      alert(`Stock insuficiente para '${prod.nombre}'. Disponible: ${prod.stock_actual}`);
      return;
    }

    const existing = saleItems.find(item => item.id_producto === prod.id_producto);
    if (existing) {
      const nextQty = existing.cantidad + qty;
      if (prod.stock_actual < nextQty) {
        alert(`Stock insuficiente. Ya agregaste ${existing.cantidad}. Disponible total: ${prod.stock_actual}`);
        return;
      }
      setSaleItems(saleItems.map(item => 
        item.id_producto === prod.id_producto 
          ? { ...item, cantidad: nextQty, subtotal: nextQty * item.precio_unitario }
          : item
      ));
    } else {
      setSaleItems([
        ...saleItems,
        {
          id_producto: prod.id_producto,
          nombre: prod.nombre,
          cantidad: qty,
          precio_unitario: Number(prod.precio_venta),
          subtotal: qty * Number(prod.precio_venta)
        }
      ]);
    }
    
    setQuantitiesByProduct(prev => ({
      ...prev,
      [prod.id_producto]: 1
    }));
  };

  const handleRemoveItem = (id) => {
    setSaleItems(saleItems.filter(item => item.id_producto !== id));
  };

  const handleRegisterSale = async () => {
    if (saleItems.length === 0) {
      alert("Agrega al menos un producto a la venta.");
      return;
    }
    setSavingSale(true);
    try {
      await api.createVentaDirecta({
        id_cliente: null,
        cliente_nuevo: null,
        estado: "completada",
        detalles: saleItems.map(item => ({
          id_producto: item.id_producto,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario
        }))
      });
      alert("¡Venta directa registrada con éxito!");
      setShowSaleModal(false);
      loadSales();
    } catch (err) {
      console.error(err);
      alert("Error al registrar la venta: " + err.message);
    } finally {
      setSavingSale(false);
    }
  };

  const exportSalesCSV = () => {
    const listToExport = filteredSales;
    if (listToExport.length === 0) {
      alert("No hay ventas en la lista actual para exportar.");
      return;
    }

    let csv = "\uFEFFID Venta,Fecha,Estado,Cliente,Total Venta,ID Producto,Nombre Producto,Costo Adquisicion,Precio Unitario,Cantidad,Subtotal,Ganancia\n";
    listToExport.forEach(v => {
      const dStr = v.fecha_venta ? (v.fecha_venta.endsWith('Z') ? v.fecha_venta : v.fecha_venta + 'Z') : "";
      const fecha = dStr ? new Date(dStr).toLocaleString("es-BO") : "";
      const estado = v.estado || "";
      const cliente = v.cliente ? v.cliente.nombre_completo : "Venta Directa";
      const totalVenta = v.total_venta || 0;

      if (v.detalles && v.detalles.length > 0) {
        v.detalles.forEach(d => {
          const prodId = d.id_producto || "";
          const prodNombre = d.producto ? d.producto.nombre : "Producto Eliminado";
          const costoUnit = d.producto && d.producto.costo_adquisicion !== null ? d.producto.costo_adquisicion : 0;
          const precioUnit = d.precio_unitario || 0;
          const cantidad = d.cantidad || 0;
          const subtotal = d.subtotal || (precioUnit * cantidad);
          const ganancia = (precioUnit - costoUnit) * cantidad;

          csv += `"${v.id_venta}","${fecha}","${estado}","${cliente.replace(/"/g, '""')}",${totalVenta},"${prodId}","${prodNombre.replace(/"/g, '""')}",${costoUnit},${precioUnit},${cantidad},${subtotal},${ganancia}\n`;
        });
      } else {
        csv += `"${v.id_venta}","${fecha}","${estado}","${cliente.replace(/"/g, '""')}",${totalVenta},"","","","","","",""\n`;
      }
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `ventas_detallado_${user.id_tienda.slice(0, 8)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredSales = sales.filter(v => {
    // filtro por estado
    if (filterStatus !== "all" && v.estado !== filterStatus) return false;
    // filtro por ticket/código
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const code = v.id_venta.toLowerCase();
      // busca si empieza por el ticket (primeros 8 caracteres) o contiene el uuid completo
      if (!code.includes(q) && !code.slice(0, 8).includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="stack sales-management-view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '8px' }}>
        <div>
          <h2 className="section-title" style={{ margin: 0, fontSize: '18px', fontWeight: 'extrabold', color: '#1f2937' }}>Gestión de Ventas y Pedidos</h2>
          <p className="text-gray-400" style={{ margin: '2px 0 0 0', fontSize: '11px' }}>Registra ventas en caja física y haz seguimiento a los pedidos generados por WhatsApp.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', width: 'auto' }}>
          <button className="btn btn-primary" onClick={openSaleModal} style={{ background: '#059669', borderColor: '#059669', color: '#ffffff', fontSize: '12px', fontWeight: 'bold', flex: '1 1 auto' }}>
            + Registrar Venta Física
          </button>
          <button className="btn btn-secondary text-xs" onClick={exportSalesCSV} style={{ fontSize: '12px', fontWeight: 'bold', flex: '1 1 auto' }}>
            📥 Exportar Ventas a Excel
          </button>
        </div>
      </div>

      <Card title="Filtros y Búsqueda">
        <div style={{ padding: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }} className="filter-block">
          <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '9px', fontWeight: 'extrabold', textTransform: 'uppercase', color: '#6b7280' }}>Buscar por Ticket</label>
            <input
              type="text"
              placeholder="Escribe el código del ticket (ej: dc8405b0)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '12px', outline: 'none', width: '100%' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '9px', fontWeight: 'extrabold', textTransform: 'uppercase', color: '#6b7280' }}>Filtrar por Estado</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '12px', outline: 'none', background: '#ffffff', width: '100%' }}
            >
              <option value="all">Todos los estados</option>
              <option value="pendiente">Pendiente WhatsApp</option>
              <option value="generada_whatsapp">Pendiente WhatsApp (Legacy)</option>
              <option value="completada">Completado</option>
              <option value="cancelada">Cancelado</option>
            </select>
          </div>
        </div>
      </Card>

      <Card title={`Ventas Registradas (${filteredSales.length})`}>
        <div style={{ padding: '16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#9ca3af', fontSize: '12px' }}>Cargando ventas...</div>
          ) : error ? (
            <div className="error-text" style={{ padding: '12px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '12px', fontSize: '12px' }}>{error}</div>
          ) : filteredSales.length === 0 ? (
            <p className="muted text-center py-6">No se encontraron ventas con los filtros aplicados.</p>
          ) : (
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
              <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left', color: '#6b7280' }}>
                    <th style={{ padding: '8px' }}>Ticket</th>
                    <th style={{ padding: '8px' }}>Cliente / Canal</th>
                    <th style={{ padding: '8px' }}>Fecha y Hora</th>
                    <th style={{ padding: '8px' }}>Monto Total</th>
                    <th style={{ padding: '8px' }}>Estado</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Detalle</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((v) => {
                    const isExpanded = expandedSaleId === v.id_venta;
                    return (
                      <Fragment key={v.id_venta}>
                        <tr style={{ borderBottom: '1px solid #f3f4f6', background: isExpanded ? '#f9fafb' : 'transparent' }}>
                          <td style={{ padding: '8px', fontFamily: 'monospace', fontWeight: 'bold', color: '#4b5563' }}>
                            #{v.id_venta.slice(0, 8)}
                          </td>
                          <td style={{ padding: '8px', fontWeight: 'bold', color: '#374151' }}>
                            {v.cliente ? (
                              <div>
                                <div style={{ fontSize: '11px', color: '#1f2937' }}>{v.cliente.nombre_completo}</div>
                                {v.cliente.telefono && <div style={{ fontSize: '9px', color: '#6b7280', fontWeight: 'normal' }}>📱 {v.cliente.telefono}</div>}
                              </div>
                            ) : v.origen === 'whatsapp' ? (
                              <span style={{ color: '#059669', fontWeight: 'bold', fontSize: '10px' }}>📱 Pedido WhatsApp</span>
                            ) : (
                              <span style={{ color: '#9ca3af', fontWeight: 'normal', fontSize: '10px' }}>📦 Venta Física (Caja)</span>
                            )}
                          </td>
                          <td style={{ padding: '8px' }}>
                            {(() => {
                              const dtStr = v.fecha_venta.endsWith('Z') ? v.fecha_venta : v.fecha_venta + 'Z';
                              const dt = new Date(dtStr);
                              return `${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                            })()}
                          </td>
                          <td style={{ padding: '8px', fontWeight: 'bold', color: '#111827' }}>
                            {parseFloat(v.total_venta).toFixed(2)} Bs
                          </td>
                          <td style={{ padding: '8px' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '8px',
                              fontWeight: 'bold',
                              color: '#ffffff',
                              background: v.estado === 'completada' ? '#059669' : v.estado === 'cancelada' ? '#dc2626' : v.estado === 'pendiente' ? '#d97706' : '#2563eb'
                            }}>
                              {v.estado === 'completada' ? 'Completado' : v.estado === 'cancelada' ? 'Cancelado' : v.estado === 'pendiente' ? 'Pendiente' : 'Pedido WhatsApp'}
                            </span>
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <button
                              onClick={() => toggleDetails(v.id_venta)}
                              className="btn btn-secondary"
                              style={{ padding: '2px 8px', fontSize: '9px', fontWeight: 'bold' }}
                            >
                              {isExpanded ? '▲ Ocultar' : '👁 Ver Productos'}
                            </button>
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '4px' }}>
                            {v.estado !== 'completada' && (
                              <button
                                onClick={() => handleStatusChange(v.id_venta, "completada")}
                                className="btn"
                                style={{ padding: '3px 8px', background: '#059669', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer' }}
                              >
                                ✔ Completar
                              </button>
                            )}
                            {v.estado !== 'cancelada' && (
                              <button
                                onClick={() => handleStatusChange(v.id_venta, "cancelada")}
                                className="btn"
                                style={{ padding: '3px 8px', background: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer' }}
                              >
                                ✖ Cancelar
                              </button>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr style={{ background: '#f9fafb' }}>
                            <td colSpan="7" style={{ padding: '12px 24px', borderBottom: '1px solid #e5e7eb' }}>
                              <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {saleDetails[v.id_venta]?.cliente && (
                                  <div style={{ paddingBottom: '8px', borderBottom: '1px dashed #e5e7eb', display: 'flex', flexWrap: 'wrap', gap: '20px', fontSize: '10px', color: '#374151' }}>
                                    <div><strong>Cliente:</strong> {saleDetails[v.id_venta].cliente.nombre_completo}</div>
                                    {saleDetails[v.id_venta].cliente.telefono && <div><strong>Teléfono:</strong> {saleDetails[v.id_venta].cliente.telefono}</div>}
                                    {saleDetails[v.id_venta].cliente.ciudad_region && <div><strong>Ciudad / Región:</strong> {saleDetails[v.id_venta].cliente.ciudad_region}</div>}
                                  </div>
                                )}
                                <div>
                                  <h5 style={{ margin: '0 0 8px 0', fontSize: '10px', fontWeight: 'extrabold', color: '#4b5563', textTransform: 'uppercase' }}>Productos del Pedido:</h5>
                                  {loadingDetails && !saleDetails[v.id_venta] ? (
                                    <div style={{ fontSize: '10px', color: '#9ca3af' }}>Cargando productos del ticket...</div>
                                  ) : saleDetails[v.id_venta] ? (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                                      <thead>
                                        <tr style={{ borderBottom: '1px solid #f3f4f6', textAlign: 'left', color: '#9ca3af' }}>
                                          <th style={{ padding: '4px' }}>Producto</th>
                                          <th style={{ padding: '4px', textAlign: 'center' }}>Cantidad</th>
                                          <th style={{ padding: '4px', textAlign: 'right' }}>Precio Unit.</th>
                                          <th style={{ padding: '4px', textAlign: 'right' }}>Subtotal</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {saleDetails[v.id_venta].detalles.map((d, idx) => (
                                          <tr key={idx} style={{ borderBottom: '1px solid #fafafa' }}>
                                            <td style={{ padding: '6px 4px', fontWeight: 'bold', color: '#374151' }}>{d.producto?.nombre || 'Producto eliminado'}</td>
                                            <td style={{ padding: '6px 4px', textAlign: 'center' }}>{d.cantidad} u.</td>
                                            <td style={{ padding: '6px 4px', textAlign: 'right' }}>{parseFloat(d.precio_unitario).toFixed(2)} Bs</td>
                                            <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 'bold', color: '#059669' }}>{parseFloat(d.subtotal).toFixed(2)} Bs</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  ) : (
                                    <div style={{ fontSize: '10px', color: '#ef4444' }}>Error al cargar los productos.</div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* Modal de Nueva Venta Física */}
      {showSaleModal && (
        <div className="pos-modal-backdrop">
          <style>{`
            .pos-modal-backdrop {
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: rgba(15, 23, 42, 0.65);
              backdrop-filter: blur(4px);
              display: flex;
              justify-content: center;
              align-items: flex-start;
              overflow-y: auto;
              z-index: 1000;
              padding: 20px 16px;
            }
            .pos-modal-container {
              background: #ffffff;
              border-radius: 24px;
              padding: 24px;
              width: 100%;
              max-width: 950px;
              box-shadow: 0 25px 50px -12px rgba(0,0,0,0.15);
              display: flex;
              flex-direction: column;
              gap: 16px;
              margin: auto;
            }
            .pos-modal-body {
              display: flex;
              gap: 20px;
              flex-direction: column;
            }
            .pos-modal-left {
              display: flex;
              flex-direction: column;
              gap: 12px;
            }
            .pos-modal-right {
              display: flex;
              flex-direction: column;
              gap: 12px;
              border-top: 1px solid #f3f4f6;
              padding-top: 16px;
            }
            .pos-product-list {
              max-height: 380px;
              overflow-y: auto;
              border: 1px solid #f3f4f6;
              border-radius: 16px;
              padding: 10px;
              background: #fafafa;
            }
            .pos-cart-list {
              max-height: 280px;
              overflow-y: auto;
              border: 1px solid #e5e7eb;
              border-radius: 16px;
              padding: 12px;
              background: #fafafa;
            }
            @media (min-width: 768px) {
              .pos-modal-body {
                flex-direction: row;
                height: 520px;
                overflow: hidden;
              }
              .pos-modal-left {
                flex: 3;
                height: 100%;
                overflow: hidden;
              }
              .pos-modal-right {
                flex: 2;
                height: 100%;
                overflow: hidden;
                border-top: none;
                border-left: 1px solid #f3f4f6;
                padding-top: 0;
                padding-left: 16px;
              }
              .pos-product-list {
                flex: 1;
                max-height: none;
              }
              .pos-cart-list {
                flex: 1;
                max-height: none;
              }
            }
          `}</style>
          <div className="pos-modal-container">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3f4f6', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'extrabold', color: '#1f2937' }}>Registrador de Ventas Directas (Física)</h3>
                <p className="text-gray-400" style={{ margin: '2px 0 0 0', fontSize: '10px' }}>Busca productos, filtra por categoría y regístralos al instante en caja.</p>
              </div>
              <button 
                onClick={() => setShowSaleModal(false)} 
                style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            {/* Layout de dos columnas */}
            <div className="pos-modal-body">
              
              {/* Columna Izquierda: Buscador de catálogo y selección */}
              <div className="pos-modal-left">
                
                {/* Controles de Filtros */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="🔍 Buscar por nombre o descripción..."
                    value={productSearchQuery}
                    onChange={(e) => setProductSearchQuery(e.target.value)}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px', outline: 'none' }}
                  />
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    style={{ padding: '10px', borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px', background: '#ffffff', minWidth: '150px', outline: 'none' }}
                  >
                    <option value="all">Todas las categorías</option>
                    {categories.map(c => (
                      <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Listado de Productos */}
                <div className="pos-product-list">
                  {loadingProducts ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#9ca3af', fontSize: '12px' }}>Cargando catálogo para ventas...</div>
                  ) : (
                    (() => {
                      const filtered = allProducts.filter(p => {
                        const matchesCategory = selectedCategoryId === "all" || String(p.id_categoria) === String(selectedCategoryId);
                        const matchesSearch = p.nombre.toLowerCase().includes(productSearchQuery.toLowerCase()) || 
                          (p.descripcion && p.descripcion.toLowerCase().includes(productSearchQuery.toLowerCase()));
                        return matchesCategory && matchesSearch && p.activo;
                      });

                      if (filtered.length === 0) {
                        return <div style={{ textAlign: 'center', padding: '30px', color: '#9ca3af', fontSize: '12px' }}>No se encontraron productos coincidentes.</div>;
                      }

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {filtered.map(p => {
                            const curQty = quantitiesByProduct[p.id_producto] || 1;
                            const isOutOfStock = p.stock_actual <= 0;
                            return (
                              <div key={p.id_producto} style={{
                                background: '#ffffff',
                                border: '1px solid #e5e7eb',
                                borderRadius: '14px',
                                padding: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                opacity: isOutOfStock ? 0.6 : 1
                              }}>
                                {/* Miniatura */}
                                <div style={{ width: '40px', height: '40px', background: '#f3f4f6', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {p.imagen_url ? (
                                    <img src={buildAssetUrl(p.imagen_url)} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    <span style={{ fontSize: '8px', color: '#9ca3af', fontWeight: 'bold' }}>Sin foto</span>
                                  )}
                                </div>

                                {/* Info del Producto */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <h4 style={{ margin: 0, fontSize: '11px', fontWeight: 'bold', color: '#1f2937' }} className="truncate">{p.nombre}</h4>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', fontSize: '9px', fontWeight: 'bold' }}>
                                    <span style={{ color: '#059669' }}>{p.precio_venta} Bs</span>
                                    <span style={{ color: isOutOfStock ? '#ef4444' : '#9ca3af' }}>
                                      {isOutOfStock ? 'Agotado' : `Stock: ${p.stock_actual}`}
                                    </span>
                                  </div>
                                </div>

                                {/* Acciones de agregar */}
                                {!isOutOfStock && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <input
                                      type="number"
                                      min="1"
                                      max={p.stock_actual}
                                      value={curQty}
                                      onChange={(e) => {
                                        const val = Math.max(1, Math.min(p.stock_actual, parseInt(e.target.value) || 1));
                                        setQuantitiesByProduct(prev => ({ ...prev, [p.id_producto]: val }));
                                      }}
                                      style={{ width: '45px', padding: '6px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '11px', textAlign: 'center', outline: 'none' }}
                                    />
                                    <button
                                      onClick={() => handleAddProductToSale(p, curQty)}
                                      style={{
                                        padding: '6px 12px',
                                        background: '#059669',
                                        color: '#ffffff',
                                        border: '1px solid #059669',
                                        borderRadius: '8px',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      + Agregar
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()
                  )}
                </div>
              </div>

              {/* Columna Derecha: Detalle de venta actual y totales */}
              <div className="pos-modal-right">
                <h4 style={{ margin: 0, fontSize: '12px', fontWeight: 'extrabold', color: '#374151' }}>Detalle de Transacción Actual</h4>
                
                {/* Lista de productos agregados */}
                <div className="pos-cart-list">
                  {saleItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 10px', color: '#9ca3af', fontSize: '11px' }}>
                      <p style={{ margin: 0 }}>El carrito de venta física está vacío.</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '9px' }}>Usa el buscador de la izquierda para agregar productos.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {saleItems.map(item => (
                        <div key={item.id_producto} style={{
                          background: '#ffffff',
                          border: '1px solid #f3f4f6',
                          borderRadius: '12px',
                          padding: '8px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          fontSize: '11px'
                        }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 'bold', color: '#1f2937' }} className="truncate">{item.nombre}</div>
                            <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '2px' }}>
                              {item.cantidad} x {item.precio_unitario.toFixed(2)} Bs
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontWeight: 'extrabold', color: '#059669' }}>{item.subtotal.toFixed(2)} Bs</span>
                            <button
                              onClick={() => handleRemoveItem(item.id_producto)}
                              style={{ border: 'none', background: '#fee2e2', color: '#ef4444', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Subtotal y Registrar */}
                <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '16px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'black', color: '#111827' }}>
                    <span>Total de la Venta:</span>
                    <span>{saleItems.reduce((acc, i) => acc + i.subtotal, 0).toFixed(2)} Bs</span>
                  </div>

                  <button
                    onClick={handleRegisterSale}
                    disabled={savingSale || saleItems.length === 0}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: saleItems.length === 0 ? '#9ca3af' : '#059669',
                      color: '#ffffff',
                      borderRadius: '12px',
                      border: saleItems.length === 0 ? '1px solid #9ca3af' : '1px solid #059669',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: saleItems.length === 0 ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {savingSale ? "Registrando en Caja..." : "Confirmar Venta en Físico"}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
