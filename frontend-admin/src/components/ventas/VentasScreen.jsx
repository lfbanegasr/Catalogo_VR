import React, { useState, useEffect, useMemo, Fragment } from 'react';
import { api, buildAssetUrl } from '../../api';
import {
  VentasIcon,
  SearchIcon,
  PlusIcon,
  PrinterIcon,
  FilterIcon,
  WhatsAppIcon,
  TrashIcon,
  ReceiptIcon,
  CloseIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CatalogoIcon,
  CheckIcon
} from '../common/Icons';

const ORDER_STATUS_LABELS = {
  generada_whatsapp: "Recibido WhatsApp",
  pendiente: "Pendiente",
  confirmada: "Confirmado",
  preparando: "Preparando",
  lista: "Listo",
  enviada: "Enviado",
  completada: "Completado",
  cancelada: "Cancelado",
};

const ORDER_STATUS_OPTIONS = [
  "pendiente",
  "confirmada",
  "preparando",
  "lista",
  "enviada",
  "completada",
  "cancelada",
];

export default function VentasScreen({ user }) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState("Bs");

  // Detalle expandido
  const [expandedSaleId, setExpandedSaleId] = useState(null);
  const [saleDetails, setSaleDetails] = useState({});
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Filtros
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal venta fisica / POS
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [allProducts, setAllProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [quantitiesByProduct, setQuantitiesByProduct] = useState({});
  const [selectedVariantByProduct, setSelectedVariantByProduct] = useState({});
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [saleItems, setSaleItems] = useState([]);
  const [savingSale, setSavingSale] = useState(false);

  const loadSales = async () => {
    setLoading(true);
    setError("");
    try {
      const [salesData, storeData] = await Promise.all([
        api.listVentas(user.id_tienda),
        api.adminGetMyStore()
      ]);
      setSales(salesData || []);
      setCurrencySymbol(storeData?.currency_symbol || "Bs");
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
    if (saleDetails[idVenta]) return;

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
    const label = ORDER_STATUS_LABELS[nextEstado] || nextEstado;
    if (!window.confirm(`¿Confirmas cambiar el estado del pedido #${idVenta.slice(0, 8)} a '${label}'?`)) return;
    const nota = window.prompt("Nota opcional para registrar en el historial:") || null;
    try {
      await api.updateVentaEstado(idVenta, nextEstado, user.id_tienda, nota);
      loadSales();
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
    setSelectedVariantByProduct({});
    setShowSaleModal(true);
    setLoadingProducts(true);
    try {
      const [prodList, catList, variantList] = await Promise.all([
        api.listProductos(),
        api.listCategorias(),
        api.listVariantesTienda(),
      ]);
      const variantsByProduct = {};
      (variantList || []).forEach((variant) => {
        if (!variantsByProduct[variant.id_producto]) variantsByProduct[variant.id_producto] = [];
        variantsByProduct[variant.id_producto].push(variant);
      });
      const productsWithVariants = (prodList || []).map((product) => ({
        ...product,
        variantes: variantsByProduct[product.id_producto] || [],
      }));
      setAllProducts(productsWithVariants);
      setCategories(catList || []);

      const qtys = {};
      (prodList || []).forEach(p => {
        qtys[p.id_producto] = 1;
      });
      setQuantitiesByProduct(qtys);
      const defaults = {};
      productsWithVariants.forEach((product) => {
        const activeVariants = product.variantes.filter((variant) => variant.activa);
        const selected = activeVariants.find((variant) => variant.es_predeterminada)
          || activeVariants[0];
        if (selected) defaults[product.id_producto] = selected.id_variante;
      });
      setSelectedVariantByProduct(defaults);
    } catch (err) {
      console.error("Error al cargar catálogo para POS:", err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleAddProductToSale = (prod, qty, variant = null) => {
    if (!prod) return;
    const availableStock = Number(variant?.stock_actual ?? prod.stock_actual ?? 0);
    if (availableStock < qty) {
      alert(`Stock insuficiente para '${prod.nombre}'. Disponible: ${availableStock}`);
      return;
    }

    const cartKey = String(prod.id_producto) + "::" + (variant?.id_variante || "simple");
    const existing = saleItems.find(item => item.cart_key === cartKey);
    if (existing) {
      const nextQty = existing.cantidad + qty;
      if (availableStock < nextQty) {
        alert(`Stock insuficiente. Ya agregaste ${existing.cantidad}. Disponible total: ${availableStock}`);
        return;
      }
      setSaleItems(saleItems.map(item =>
        item.cart_key === cartKey
          ? { ...item, cantidad: nextQty, subtotal: nextQty * item.precio_unitario }
          : item
      ));
    } else {
      const price = Number(variant?.precio_venta ?? prod.precio_venta);
      setSaleItems([
        ...saleItems,
        {
          cart_key: cartKey,
          id_producto: prod.id_producto,
          id_variante: variant?.id_variante || null,
          nombre_variante: (variant?.atributos || []).map((item) => item.valor).join(" / "),
          nombre: prod.nombre,
          imagen_url: prod.imagen_url,
          cantidad: qty,
          precio_unitario: price,
          subtotal: qty * price,
        }
      ]);
    }

    setQuantitiesByProduct(prev => ({
      ...prev,
      [prod.id_producto]: 1
    }));
  };

  const handleUpdateItemQty = (cartKey, delta) => {
    setSaleItems(prev => {
      return prev.map(item => {
        if (item.cart_key === cartKey) {
          const nextQty = item.cantidad + delta;
          if (nextQty <= 0) return null;
          return {
            ...item,
            cantidad: nextQty,
            subtotal: nextQty * item.precio_unitario
          };
        }
        return item;
      }).filter(Boolean);
    });
  };

  const handleRemoveItem = (cartKey) => {
    setSaleItems(saleItems.filter(item => item.cart_key !== cartKey));
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
          id_variante: item.id_variante || null,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario
        }))
      });
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
    link.setAttribute("download", `ventas_${(user.id_tienda || "tienda").slice(0, 8)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtrado reactivo de ventas
  const filteredSales = useMemo(() => {
    return sales.filter(v => {
      if (filterStatus !== "all") {
        if (filterStatus === "pendiente" && v.estado === "generada_whatsapp") return true;
        if (v.estado !== filterStatus) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const code = (v.id_venta || "").toLowerCase();
        const clientName = (v.cliente?.nombre_completo || "").toLowerCase();
        const clientPhone = (v.cliente?.telefono || "").toLowerCase();
        if (!code.includes(q) && !code.slice(0, 8).includes(q) && !clientName.includes(q) && !clientPhone.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [sales, filterStatus, searchQuery]);

  // Contadores para pestañas y métricas
  const statusCounts = useMemo(() => {
    const counts = { all: sales.length, pendiente: 0, confirmada: 0, preparando: 0, completada: 0, cancelada: 0 };
    sales.forEach(s => {
      if (s.estado === "pendiente" || s.estado === "generada_whatsapp") counts.pendiente++;
      else if (s.estado === "confirmada") counts.confirmada++;
      else if (s.estado === "preparando" || s.estado === "lista" || s.estado === "enviada") counts.preparando++;
      else if (s.estado === "completada") counts.completada++;
      else if (s.estado === "cancelada") counts.cancelada++;
    });
    return counts;
  }, [sales]);

  const totalFilteredRevenue = useMemo(() => {
    return filteredSales.reduce((acc, s) => acc + (parseFloat(s.total_venta) || 0), 0);
  }, [filteredSales]);

  // Helper de badges por estado
  const getStatusBadgeStyle = (estado) => {
    switch (estado) {
      case "completada":
        return {
          bg: "var(--badge-success-bg)",
          color: "var(--badge-success-text)",
          border: "var(--badge-success-border)"
        };
      case "cancelada":
        return {
          bg: "var(--badge-danger-bg)",
          color: "var(--badge-danger-text)",
          border: "var(--badge-danger-border)"
        };
      case "pendiente":
      case "generada_whatsapp":
        return {
          bg: "var(--badge-warning-bg)",
          color: "var(--badge-warning-text)",
          border: "var(--badge-warning-border)"
        };
      default:
        return {
          bg: "var(--badge-info-bg)",
          color: "var(--badge-info-text)",
          border: "var(--badge-info-border)"
        };
    }
  };

  return (
    <div className="sales-container">
      {/* Estilos para impresión de ticket limpio */}
      <style>{`
        @media print {
          .modern-sidebar, .modern-navbar, .sales-header-row, .sales-stats-grid, .sales-filter-card, .btn, .logout-icon-btn { display: none !important; }
          .admin-main-wrapper, .sales-container { padding: 0 !important; margin: 0 !important; width: 100% !important; }
          .sales-table-card { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      {/* Cabecera Principal */}
      <div className="sales-header-row">
        <div>
          <h1 style={{ margin: 0, fontSize: "1.45rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Gestión de Ventas y Pedidos
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
            Control de caja en punto de venta (POS) y seguimiento a pedidos online de WhatsApp.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn-primary-gradient"
            onClick={openSaleModal}
          >
            <PlusIcon size={16} />
            <span> Registrar Venta en Caja (POS)</span>
          </button>

          <button
            type="button"
            className="btn-secondary-modern"
            onClick={exportSalesCSV}
          >
            <ReceiptIcon size={16} />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: "12px 16px",
          background: "var(--badge-danger-bg)",
          color: "var(--badge-danger-text)",
          border: "1px solid var(--badge-danger-border)",
          borderRadius: "12px",
          fontSize: "0.85rem",
          fontWeight: 600
        }}>
          {error}
        </div>
      )}

      {/* KPI Stats de Ventas */}
      <div className="sales-stats-grid">
        <div className="kpi-stat-card">
          <span className="kpi-card-label">Total Pedidos</span>
          <div className="kpi-card-value">{sales.length}</div>
          <div className="kpi-card-footer">
            Órdenes registradas en la tienda
          </div>
        </div>

        <div className="kpi-stat-card">
          <span className="kpi-card-label">Recaudación Filtrada</span>
          <div className="kpi-card-value">
            {totalFilteredRevenue.toFixed(2)} {currencySymbol}
          </div>
          <div className="kpi-card-footer">
            Monto acumulado en la vista actual
          </div>
        </div>

        <div className="kpi-stat-card">
          <span className="kpi-card-label">Pedidos Pendientes</span>
          <div className="kpi-card-value" style={{ color: "var(--badge-warning-text)" }}>
            {statusCounts.pendiente}
          </div>
          <div className="kpi-card-footer">
            Requieren atención o confirmación
          </div>
        </div>

        <div className="kpi-stat-card">
          <span className="kpi-card-label">Completados</span>
          <div className="kpi-card-value" style={{ color: "var(--badge-success-text)" }}>
            {statusCounts.completada}
          </div>
          <div className="kpi-card-footer">
            Ventas finalizadas con éxito
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="sales-filter-card">
        <div className="sales-filter-top">
          <div className="sales-search-box">
            <SearchIcon size={16} />
            <input
              type="text"
              className="sales-search-input"
              placeholder="Buscar por ticket (#dc8405), nombre de cliente o teléfono..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Pestañas de estado con contador */}
        <div className="sales-status-tabs">
          {[
            { key: "all", label: "Todos", count: statusCounts.all },
            { key: "pendiente", label: "Pendientes", count: statusCounts.pendiente },
            { key: "confirmada", label: "Confirmados", count: statusCounts.confirmada },
            { key: "preparando", label: "En Proceso", count: statusCounts.preparando },
            { key: "completada", label: "Completados", count: statusCounts.completada },
            { key: "cancelada", label: "Cancelados", count: statusCounts.cancelada },
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              className={`sales-tab-pill ${filterStatus === tab.key ? "active" : ""}`}
              onClick={() => setFilterStatus(tab.key)}
            >
              <span>{tab.label}</span>
              <span className="sales-tab-count">{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tabla Principal de Ventas */}
      <div className="sales-table-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "0.98rem", fontWeight: 800, color: "var(--text-primary)" }}>
              Pedidos y Transacciones ({filteredSales.length})
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Haz clic en "Ver Detalle" para inspeccionar los productos y notas del pedido.
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Cargando historial de pedidos...
          </div>
        ) : filteredSales.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-muted)" }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "0.92rem", color: "var(--text-primary)" }}>
              No se encontraron pedidos
            </p>
            <p style={{ margin: "4px 0 0", fontSize: "0.8rem" }}>
              Prueba cambiando los filtros o registra una nueva venta en caja física.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto", width: "100%" }}>
            <table className="sales-modern-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Cliente & Canal</th>
                  <th>Fecha y Hora</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th style={{ textAlign: "center" }}>Detalle</th>
                  <th style={{ textAlign: "center" }}>Cambiar Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((v) => {
                  const isExpanded = expandedSaleId === v.id_venta;
                  const badgeStyle = getStatusBadgeStyle(v.estado);
                  const isWhatsApp = v.origen === "whatsapp" || Boolean(v.cliente);

                  const dtStr = v.fecha_venta.endsWith('Z') ? v.fecha_venta : v.fecha_venta + 'Z';
                  const dt = new Date(dtStr);
                  const formattedDate = !isNaN(dt.getTime())
                    ? `${dt.toLocaleDateString("es-BO")} ${dt.toLocaleTimeString("es-BO", { hour: '2-digit', minute: '2-digit' })}`
                    : v.fecha_venta;

                  return (
                    <Fragment key={v.id_venta}>
                      <tr>
                        {/* Ticket ID */}
                        <td style={{ fontFamily: "monospace", fontWeight: 800, color: "var(--text-secondary)" }}>
                          <span style={{
                            padding: "3px 8px",
                            background: "var(--bg-surface-elevated)",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: "8px",
                            fontSize: "0.78rem"
                          }}>
                            #{v.id_venta.slice(0, 8)}
                          </span>
                        </td>

                        {/* Cliente / Canal */}
                        <td>
                          {v.cliente ? (
                            <div>
                              <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: "0.85rem" }}>
                                {v.cliente.nombre_completo}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                {v.cliente.telefono && <span>📱 {v.cliente.telefono}</span>}
                                <span style={{ color: "#10b981", fontWeight: 700 }}>• Pedido WhatsApp</span>
                              </div>
                            </div>
                          ) : isWhatsApp ? (
                            <span style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              color: "#10b981",
                              fontWeight: 700,
                              fontSize: "0.78rem"
                            }}>
                              <WhatsAppIcon size={14} />
                              Pedido WhatsApp
                            </span>
                          ) : (
                            <span style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              color: "var(--text-muted)",
                              fontWeight: 600,
                              fontSize: "0.78rem"
                            }}>
                              <VentasIcon size={14} />
                              Venta en Caja
                            </span>
                          )}
                        </td>

                        {/* Fecha */}
                        <td style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                          {formattedDate}
                        </td>

                        {/* Total */}
                        <td>
                          <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)" }}>
                            {parseFloat(v.total_venta).toFixed(2)} {currencySymbol}
                          </span>
                        </td>

                        {/* Estado */}
                        <td>
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "3px 10px",
                            borderRadius: "999px",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            background: badgeStyle.bg,
                            color: badgeStyle.color,
                            border: `1px solid ${badgeStyle.border}`
                          }}>
                            {ORDER_STATUS_LABELS[v.estado] || v.estado}
                          </span>
                        </td>

                        {/* Detalle Toggle */}
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            className="btn-secondary-modern"
                            style={{ padding: "4px 10px", fontSize: "0.75rem", borderRadius: "10px" }}
                            onClick={() => toggleDetails(v.id_venta)}
                          >
                            {isExpanded ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
                            <span>{isExpanded ? "Ocultar" : "Detalles"}</span>
                          </button>
                        </td>

                        {/* Selector de Estado */}
                        <td style={{ textAlign: "center" }}>
                          <select
                            value={v.estado}
                            onChange={(e) => {
                              if (e.target.value !== v.estado) {
                                handleStatusChange(v.id_venta, e.target.value);
                              }
                            }}
                            style={{
                              padding: "5px 8px",
                              border: "1px solid var(--border-subtle)",
                              borderRadius: "10px",
                              fontSize: "0.75rem",
                              background: "var(--bg-surface-elevated)",
                              color: "var(--text-primary)",
                              outline: "none",
                              cursor: "pointer",
                              fontWeight: 600
                            }}
                          >
                            {v.estado === "generada_whatsapp" ? (
                              <option value="generada_whatsapp">Recibido WhatsApp</option>
                            ) : null}
                            {(v.estado === "cancelada"
                              ? ["cancelada", "pendiente"]
                              : ORDER_STATUS_OPTIONS.filter((status) =>
                                status === "cancelada"
                                || ORDER_STATUS_OPTIONS.indexOf(status)
                                >= Math.max(0, ORDER_STATUS_OPTIONS.indexOf(v.estado))))
                              .map((status) => (
                                <option key={status} value={status}>
                                  {ORDER_STATUS_LABELS[status]}
                                </option>
                              ))}
                          </select>
                        </td>
                      </tr>

                      {/* Fila Expandida de Detalles */}
                      {isExpanded && (
                        <tr className="sale-expanded-row">
                          <td colSpan="7" style={{ padding: "16px 20px" }}>
                            <div className="sale-expanded-card">
                              {saleDetails[v.id_venta] ? (
                                <>
                                  {/* Información de Envío y Cliente */}
                                  <div style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                                    gap: "14px",
                                    paddingBottom: "14px",
                                    borderBottom: "1px dashed var(--border-subtle)"
                                  }}>
                                    <div>
                                      <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", display: "block" }}>
                                        Seguimiento / Código
                                      </span>
                                      <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>
                                        #{saleDetails[v.id_venta].codigo_seguimiento || v.id_venta.slice(0, 8)}
                                      </strong>
                                    </div>

                                    <div>
                                      <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", display: "block" }}>
                                        Método de Entrega
                                      </span>
                                      <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>
                                        {saleDetails[v.id_venta].metodo_entrega === "delivery" ? "🛵 Delivery a domicilio" : "🏬 Retiro en tienda física"}
                                      </strong>
                                    </div>

                                    {saleDetails[v.id_venta].metodo_pago && (
                                      <div>
                                        <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", display: "block" }}>
                                          Forma de Pago
                                        </span>
                                        <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>
                                          {saleDetails[v.id_venta].metodo_pago}
                                        </strong>
                                      </div>
                                    )}

                                    {saleDetails[v.id_venta].cliente?.telefono && (
                                      <div>
                                        <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", display: "block" }}>
                                          WhatsApp del Cliente
                                        </span>
                                        <a
                                          href={`https://wa.me/${saleDetails[v.id_venta].cliente.telefono.replace(/\D/g, '')}?text=Hola%20${encodeURIComponent(saleDetails[v.id_venta].cliente.nombre_completo || '')},%20te%20contactamos%20sobre%20tu%20pedido%20%23${v.id_venta.slice(0, 8)}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "5px",
                                            fontSize: "0.8rem",
                                            fontWeight: 700,
                                            color: "#10b981",
                                            textDecoration: "none",
                                            marginTop: "3px"
                                          }}
                                        >
                                          <WhatsAppIcon size={14} />
                                          <span>{saleDetails[v.id_venta].cliente.telefono} (Enviar Mensaje)</span>
                                        </a>
                                      </div>
                                    )}
                                  </div>

                                  {/* Dirección y Notas */}
                                  {(saleDetails[v.id_venta].direccion_snapshot || saleDetails[v.id_venta].notas_cliente) && (
                                    <div style={{
                                      fontSize: "0.8rem",
                                      color: "var(--text-secondary)",
                                      paddingBottom: "12px",
                                      borderBottom: "1px dashed var(--border-subtle)",
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "6px"
                                    }}>
                                      {saleDetails[v.id_venta].direccion_snapshot && (
                                        <div>
                                          <strong style={{ color: "var(--text-primary)" }}>Dirección de Envío: </strong>
                                          {saleDetails[v.id_venta].direccion_snapshot.linea1}, {saleDetails[v.id_venta].direccion_snapshot.ciudad}
                                          {saleDetails[v.id_venta].direccion_snapshot.referencia ? ` (Ref: ${saleDetails[v.id_venta].direccion_snapshot.referencia})` : ""}
                                        </div>
                                      )}
                                      {saleDetails[v.id_venta].notas_cliente && (
                                        <div>
                                          <strong style={{ color: "var(--text-primary)" }}>Notas del Cliente: </strong>
                                          {saleDetails[v.id_venta].notas_cliente}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Tabla de Productos del Ticket */}
                                  <div>
                                    <h4 style={{ margin: "0 0 10px 0", fontSize: "0.82rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
                                      Artículos del Pedido:
                                    </h4>

                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                                      <thead>
                                        <tr style={{ borderBottom: "1px solid var(--border-subtle)", textAlign: "left", color: "var(--text-muted)" }}>
                                          <th style={{ padding: "6px 8px" }}>Producto</th>
                                          <th style={{ padding: "6px 8px", textAlign: "center" }}>Cantidad</th>
                                          <th style={{ padding: "6px 8px", textAlign: "right" }}>Precio Unitario</th>
                                          <th style={{ padding: "6px 8px", textAlign: "right" }}>Subtotal</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {saleDetails[v.id_venta].detalles?.map((d, idx) => (
                                          <tr key={idx} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                                            <td style={{ padding: "8px", fontWeight: 700, color: "var(--text-primary)" }}>
                                              {d.producto?.nombre || "Producto eliminado"}
                                              {d.nombre_variante && (
                                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: "normal" }}>
                                                  {d.nombre_variante}
                                                </div>
                                              )}
                                            </td>
                                            <td style={{ padding: "8px", textAlign: "center", color: "var(--text-secondary)" }}>
                                              {d.cantidad} uds
                                            </td>
                                            <td style={{ padding: "8px", textAlign: "right", color: "var(--text-secondary)" }}>
                                              {parseFloat(d.precio_unitario).toFixed(2)} {currencySymbol}
                                            </td>
                                            <td style={{ padding: "8px", textAlign: "right", fontWeight: 800, color: "var(--brand-primary)" }}>
                                              {parseFloat(d.subtotal).toFixed(2)} {currencySymbol}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>

                                  {/* Historial de eventos / estados */}
                                  {(saleDetails[v.id_venta].historial_estados || []).length > 0 && (
                                    <div style={{ paddingTop: "8px" }}>
                                      <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                                        Historial de Cambios:
                                      </span>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                        {[...saleDetails[v.id_venta].historial_estados].reverse().map((event, eventIdx) => (
                                          <span
                                            key={eventIdx}
                                            style={{
                                              fontSize: "0.72rem",
                                              padding: "3px 8px",
                                              background: "var(--bg-surface)",
                                              border: "1px solid var(--border-subtle)",
                                              borderRadius: "8px",
                                              color: "var(--text-secondary)"
                                            }}
                                          >
                                            <strong>{ORDER_STATUS_LABELS[event.estado_nuevo] || event.estado_nuevo}</strong> • {new Date(event.fecha_evento).toLocaleTimeString("es-BO", { hour: '2-digit', minute: '2-digit' })}
                                            {event.nota ? ` (${event.nota})` : ""}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </>
                              ) : loadingDetails ? (
                                <div style={{ textAlign: "center", padding: "16px", color: "var(--text-muted)", fontSize: "0.82rem" }}>
                                  Cargando detalle del ticket #{v.id_venta.slice(0, 8)}...
                                </div>
                              ) : (
                                <div style={{ color: "var(--badge-danger-text)", fontSize: "0.82rem" }}>
                                  No se pudieron cargar los detalles adicionales de este pedido.
                                </div>
                              )}
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

      {/* =====================================================================
          MODAL DE PUNTO DE VENTA (POS / VENTA FISICA EN CAJA)
          ===================================================================== */}
      {showSaleModal && (
        <div className="pos-modal-overlay">
          <div className="pos-window">
            {/* Cabecera del POS */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "14px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "var(--text-primary)" }}>
                  Punto de Venta (Caja Física)
                </h2>
                <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Selecciona productos del inventario y confirma el ticket al instante.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowSaleModal(false)}
                className="logout-icon-btn"
                aria-label="Cerrar modal de venta"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            {/* Cuerpo del POS: Catálogo a la izquierda, Carrito a la derecha */}
            <div className="pos-grid-layout">
              {/* Columna Izquierda: Buscador y Productos */}
              <div className="pos-catalog-pane">
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <div className="sales-search-box" style={{ minWidth: "180px", flex: 2 }}>
                    <SearchIcon size={15} />
                    <input
                      type="text"
                      className="sales-search-input"
                      placeholder="Buscar por nombre o descripción..."
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                    />
                  </div>

                  <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "12px",
                      border: "1px solid var(--border-subtle)",
                      background: "var(--bg-surface-elevated)",
                      color: "var(--text-primary)",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      outline: "none",
                      flex: 1,
                      minWidth: "150px"
                    }}
                  >
                    <option value="all">Todas las categorías</option>
                    {categories.map(c => (
                      <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Grid de Productos con Scroll */}
                <div className="pos-product-scroll">
                  {loadingProducts ? (
                    <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                      Cargando inventario...
                    </div>
                  ) : (
                    (() => {
                      const filtered = allProducts.filter(p => {
                        const productCategoryId = p.id_categoria_principal || p.id_categoria;
                        const matchesCat = selectedCategoryId === "all" || String(productCategoryId) === String(selectedCategoryId);
                        const matchesQ = p.nombre.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
                          (p.descripcion && p.descripcion.toLowerCase().includes(productSearchQuery.toLowerCase()));
                        return matchesCat && matchesQ && p.activo;
                      });

                      if (filtered.length === 0) {
                        return (
                          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px", color: "var(--text-muted)", fontSize: "0.82rem" }}>
                            No se encontraron productos disponibles.
                          </div>
                        );
                      }

                      return filtered.map(p => {
                        const curQty = quantitiesByProduct[p.id_producto] || 1;
                        const activeVariants = (p.variantes || []).filter((v) => v.activa);
                        const selectedVariantId = selectedVariantByProduct[p.id_producto];
                        const selectedVariant = activeVariants.find(
                          (v) => v.id_variante === selectedVariantId,
                        ) || null;
                        const availableStock = Number(selectedVariant?.stock_actual ?? p.stock_actual ?? 0);
                        const effectivePrice = Number(selectedVariant?.precio_venta ?? p.precio_venta);
                        const isOutOfStock = availableStock <= 0;

                        return (
                          <div key={p.id_producto} className="pos-item-card" style={{ opacity: isOutOfStock ? 0.6 : 1 }}>
                            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                              <div style={{
                                width: "42px",
                                height: "42px",
                                borderRadius: "10px",
                                background: "var(--bg-surface-hover)",
                                border: "1px solid var(--border-subtle)",
                                overflow: "hidden",
                                display: "grid",
                                placeItems: "center",
                                flexShrink: 0
                              }}>
                                {p.imagen_url ? (
                                  <img src={buildAssetUrl(p.imagen_url)} alt={p.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : (
                                  <CatalogoIcon size={20} className="text-muted" />
                                )}
                              </div>

                              <div style={{ minWidth: 0, flex: 1 }}>
                                <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)" }} className="truncate" title={p.nombre}>
                                  {p.nombre}
                                </p>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                                  <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--brand-primary)" }}>
                                    {effectivePrice.toFixed(2)} {currencySymbol}
                                  </span>
                                  <span style={{
                                    fontSize: "0.68rem",
                                    fontWeight: 700,
                                    color: isOutOfStock ? "var(--badge-danger-text)" : "var(--badge-success-text)"
                                  }}>
                                    {isOutOfStock ? "Agotado" : `${availableStock} disp.`}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {activeVariants.length > 0 && (
                              <select
                                value={selectedVariantId || ""}
                                onChange={(e) => {
                                  setSelectedVariantByProduct((current) => ({
                                    ...current,
                                    [p.id_producto]: e.target.value,
                                  }));
                                  setQuantitiesByProduct((current) => ({
                                    ...current,
                                    [p.id_producto]: 1,
                                  }));
                                }}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: "8px",
                                  border: "1px solid var(--border-subtle)",
                                  fontSize: "0.74rem",
                                  background: "var(--bg-surface)",
                                  color: "var(--text-primary)",
                                  width: "100%",
                                  outline: "none"
                                }}
                              >
                                {activeVariants.map((v) => (
                                  <option key={v.id_variante} value={v.id_variante}>
                                    {(v.atributos || []).map((i) => i.valor).join(" / ") || v.sku} • Stock {v.stock_actual}
                                  </option>
                                ))}
                              </select>
                            )}

                            {!isOutOfStock && (
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "auto" }}>
                                <input
                                  type="number"
                                  min="1"
                                  max={availableStock}
                                  value={curQty}
                                  onChange={(e) => {
                                    const val = Math.max(1, Math.min(availableStock, parseInt(e.target.value) || 1));
                                    setQuantitiesByProduct(prev => ({ ...prev, [p.id_producto]: val }));
                                  }}
                                  style={{
                                    width: "48px",
                                    padding: "6px 4px",
                                    borderRadius: "8px",
                                    border: "1px solid var(--border-subtle)",
                                    fontSize: "0.82rem",
                                    textAlign: "center",
                                    background: "var(--bg-surface)",
                                    color: "var(--text-primary)",
                                    outline: "none"
                                  }}
                                />

                                <button
                                  type="button"
                                  className="btn-primary-gradient"
                                  style={{ flex: 1, padding: "6px 10px", fontSize: "0.78rem", justifyContent: "center" }}
                                  onClick={() => handleAddProductToSale(p, curQty, selectedVariant)}
                                >
                                  + Agregar
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()
                  )}
                </div>
              </div>

              {/* Columna Derecha: Canasta de Compra / Ticket */}
              <div className="pos-cart-pane">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)" }}>
                    Ticket de Caja
                  </h3>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>
                    {saleItems.length} artículos
                  </span>
                </div>

                <div className="pos-cart-scroll">
                  {saleItems.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "50px 10px", color: "var(--text-muted)" }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: "0.88rem", color: "var(--text-primary)" }}>
                        Ticket vacío
                      </p>
                      <p style={{ margin: "4px 0 0", fontSize: "0.75rem" }}>
                        Selecciona artículos del catálogo a la izquierda para cargarlos al ticket.
                      </p>
                    </div>
                  ) : (
                    saleItems.map(item => (
                      <div key={item.cart_key} className="pos-cart-item">
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ margin: 0, fontSize: "0.84rem", fontWeight: 700, color: "var(--text-primary)" }} className="truncate">
                            {item.nombre}
                          </p>
                          {item.nombre_variante && (
                            <p style={{ margin: "2px 0 0", fontSize: "0.7rem", color: "var(--text-muted)" }}>
                              {item.nombre_variante}
                            </p>
                          )}
                          <p style={{ margin: "2px 0 0", fontSize: "0.74rem", color: "var(--text-secondary)" }}>
                            {item.precio_unitario.toFixed(2)} {currencySymbol} x {item.cantidad}
                          </p>
                        </div>

                        {/* Controles de Cantidad (+ / -) y Eliminar */}
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div style={{ display: "flex", alignItems: "center", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "8px" }}>
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQty(item.cart_key, -1)}
                              style={{ padding: "4px 8px", background: "transparent", border: "none", color: "var(--text-primary)", cursor: "pointer", fontWeight: 800 }}
                            >
                              -
                            </button>
                            <span style={{ fontSize: "0.8rem", fontWeight: 700, minWidth: "22px", textAlign: "center" }}>
                              {item.cantidad}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQty(item.cart_key, 1)}
                              style={{ padding: "4px 8px", background: "transparent", border: "none", color: "var(--text-primary)", cursor: "pointer", fontWeight: 800 }}
                            >
                              +
                            </button>
                          </div>

                          <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--brand-primary)", minWidth: "65px", textAlign: "right" }}>
                            {item.subtotal.toFixed(2)} {currencySymbol}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.cart_key)}
                            className="logout-icon-btn"
                            title="Eliminar artículo"
                            style={{ padding: "6px" }}
                          >
                            <TrashIcon size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Totalizador y Acción de Confirmación */}
                <div style={{
                  background: "var(--bg-surface-elevated)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "18px",
                  padding: "18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  marginTop: "auto"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                      Total a Cobrar:
                    </span>
                    <strong style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                      {saleItems.reduce((acc, i) => acc + i.subtotal, 0).toFixed(2)} {currencySymbol}
                    </strong>
                  </div>

                  <button
                    type="button"
                    className="btn-primary-gradient"
                    onClick={handleRegisterSale}
                    disabled={savingSale || saleItems.length === 0}
                    style={{
                      width: "100%",
                      padding: "12px",
                      justifyContent: "center",
                      fontSize: "0.92rem",
                      opacity: saleItems.length === 0 ? 0.5 : 1,
                      cursor: saleItems.length === 0 ? "not-allowed" : "pointer"
                    }}
                  >
                    <CheckIcon size={18} />
                    <span>{savingSale ? "Registrando en Caja..." : "Confirmar Venta en Físico"}</span>
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
