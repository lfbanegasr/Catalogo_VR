import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api';
import {
  TrendUpIcon,
  PrinterIcon,
  VentasIcon,
  CatalogoIcon,
  ExternalLinkIcon
} from '../common/Icons';

/* ==========================================================================
   GRAFICO DE TENDENCIA SUAVIZADO (CURVA BEZIER SPLINE CON GRADIENTE)
   ========================================================================== */
function SmoothRevenueChart({ data, currencySymbol = "Bs" }) {
  const [activeTab, setActiveTab] = useState("30D");
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Filtrar o simular serie según la pestaña seleccionada
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      // Datos demo por defecto si la tienda es nueva y no tiene ventas aún
      return [
        { fecha: "Día 1", recaudado: 120 },
        { fecha: "Día 5", recaudado: 340 },
        { fecha: "Día 10", recaudado: 290 },
        { fecha: "Día 15", recaudado: 620 },
        { fecha: "Día 20", recaudado: 540 },
        { fecha: "Día 25", recaudado: 890 },
        { fecha: "Día 30", recaudado: 1050 }
      ];
    }
    if (activeTab === "7D") return data.slice(-7);
    if (activeTab === "Hoy") return data.slice(-1);
    return data;
  }, [data, activeTab]);

  const width = 640;
  const height = 220;
  const paddingX = 35;
  const paddingY = 25;

  const values = chartData.map(d => Number(d.recaudado) || 0);
  const maxVal = Math.max(...values, 100);

  // Puntos calculados
  const points = chartData.map((d, index) => {
    const x = paddingX + (index * (width - paddingX * 2)) / Math.max(chartData.length - 1, 1);
    const y = height - paddingY - (Number(d.recaudado) * (height - paddingY * 2)) / maxVal;
    return { x, y, label: d.fecha, val: Number(d.recaudado) };
  });

  // Generador de curva suavizada Bézier (Catmull-Rom / Spline)
  const pathD = useMemo(() => {
    if (points.length === 0) return "";
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? i : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return path;
  }, [points]);

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`
    : "";

  return (
    <div className="revenue-chart-card">
      <div className="chart-header-row">
        <div className="chart-title-area">
          <h3>Tendencia de Ventas (Revenue Chart)</h3>
          <p>Ingresos y desempeño comercial registrado en el periodo.</p>
        </div>
        <div className="chart-filter-tabs">
          {["Hoy", "7D", "30D", "Este Año"].map((tab) => (
            <button
              key={tab}
              type="button"
              className={`chart-tab-btn ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div style={{ position: "relative", width: "100%", overflow: "hidden" }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height="auto"
          style={{ display: "block" }}
        >
          <defs>
            <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-grad-start)" />
              <stop offset="100%" stopColor="var(--chart-grad-end)" />
            </linearGradient>
            <filter id="curveGlow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="var(--chart-curve)" floodOpacity="0.3" />
            </filter>
          </defs>

          {/* Líneas de guía horizontal */}
          <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="var(--chart-grid-line)" strokeWidth={1} strokeDasharray="3 3" />
          <line x1={paddingX} y1={height / 2} x2={width - paddingX} y2={height / 2} stroke="var(--chart-grid-line)" strokeWidth={1} strokeDasharray="3 3" />
          <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="var(--border-subtle)" strokeWidth={1} />

          {/* Relleno de área con gradiente */}
          {areaD && <path d={areaD} fill="url(#revenueGrad)" />}

          {/* Curva principal */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="var(--chart-curve)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#curveGlow)"
            />
          )}

          {/* Puntos y Tooltips */}
          {points.map((p, i) => {
            const isHovered = hoveredIndex === i;
            return (
              <g
                key={i}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{ cursor: "pointer" }}
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 6 : 4}
                  fill="var(--bg-surface)"
                  stroke="var(--chart-curve)"
                  strokeWidth={2.5}
                  style={{ transition: "all 0.15s ease" }}
                />
                {isHovered && (
                  <g>
                    <rect
                      x={p.x - 45}
                      y={p.y - 34}
                      width={90}
                      height={24}
                      rx={6}
                      fill="var(--text-primary)"
                      opacity={0.92}
                    />
                    <text
                      x={p.x}
                      y={p.y - 18}
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="middle"
                      fill="var(--bg-surface)"
                    >
                      {p.val.toFixed(2)} {currencySymbol}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-muted)", padding: "0 8px" }}>
        <span>{chartData[0]?.fecha || "Inicio"}</span>
        <span>{chartData[Math.floor(chartData.length / 2)]?.fecha || "Periodo"}</span>
        <span>{chartData[chartData.length - 1]?.fecha || "Fin"}</span>
      </div>
    </div>
  );
}

/* ==========================================================================
   TOP PRODUCTOS MAS VENDIDOS (FILA INFERIOR)
   ========================================================================== */
function ModernTopProductsCard({ data, currencySymbol = "Bs" }) {
  if (!data || data.length === 0) {
    return (
      <div className="top-products-card">
        <h3 className="widget-card-title">Top Productos Más Vendidos</h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", margin: "10px 0" }}>
          Aún no se registran ventas de productos en este periodo.
        </p>
      </div>
    );
  }

  const maxQty = Math.max(...data.map(d => d.cantidad), 1);

  return (
    <div className="top-products-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 className="widget-card-title">Top Productos Más Vendidos</h3>
          <p style={{ fontSize: "0.74rem", color: "var(--text-muted)", margin: "2px 0 0" }}>
            Artículos con mayor volumen de salida y recaudación comercial.
          </p>
        </div>
      </div>

      <div className="products-table-header">
        <span>Producto</span>
        <span>Unidades</span>
        <span>Recaudado</span>
        <span>Rendimiento</span>
      </div>

      <div className="products-list-wrapper">
        {data.map((item, index) => {
          const percentage = Math.min((item.cantidad / maxQty) * 100, 100);
          return (
            <div key={index} className="product-row-item">
              <div className="product-info-cell">
                <div className="product-thumb-box">
                  {item.imagen_url ? (
                    <img src={item.imagen_url} alt={item.nombre} className="product-thumb-img" />
                  ) : (
                    <CatalogoIcon size={20} className="text-muted" />
                  )}
                </div>
                <div className="product-names">
                  <p className="product-title-bold" title={item.nombre}>{item.nombre}</p>
                  <p className="product-sku-sub">#{index + 1} en popularidad</p>
                </div>
              </div>

              <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "var(--text-primary)" }}>
                {item.cantidad} uds
              </div>

              <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "var(--brand-primary)" }}>
                {parseFloat(item.recaudado || 0).toFixed(2)} {currencySymbol}
              </div>

              <div className="progress-bar-container">
                <div className="progress-track">
                  <div
                    className="progress-fill-gradient"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", minWidth: "32px" }}>
                  {percentage.toFixed(0)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ==========================================================================
   COMPONENTE PRINCIPAL: DASHBOARD SCREEN
   ========================================================================== */
export default function DashboardScreen({ user, onGoToVentas }) {
  const [metrics, setMetrics] = useState(null);
  const [storeData, setStoreData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState("Bs");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [m, store] = await Promise.all([
        api.getMetrics(user.id_tienda),
        api.adminGetMyStore()
      ]);
      setMetrics(m);
      setStoreData(store);
      setCurrencySymbol(store?.currency_symbol || "Bs");
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar las métricas en tiempo real de la tienda.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user.id_tienda]);

  const exportInventoryCSV = async () => {
    try {
      const prods = await api.listProductos();
      if (!prods || prods.length === 0) {
        alert("No hay productos registrados en el inventario.");
        return;
      }
      let csv = "\uFEFFID Producto,Nombre,Stock,Precio Venta,Costo Adquisicion,Margen Esperado\n";
      prods.forEach(p => {
        const costo = p.costo_adquisicion || 0;
        const margen = (p.precio_venta || 0) - costo;
        csv += `"${p.id_producto}","${(p.nombre || "").replace(/"/g, '""')}",${p.stock_actual || 0},${p.precio_venta || 0},${costo},${margen.toFixed(2)}\n`;
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute("download", `inventario_${(user.id_tienda || "tienda").slice(0, 8)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert("Error al exportar inventario en formato CSV.");
    }
  };

  if (loading && !metrics) {
    return (
      <div className="dashboard-container" style={{ alignItems: "center", justifyContent: "center", minHeight: "450px" }}>
        <div style={{
          width: "42px",
          height: "42px",
          border: "4px solid var(--border-subtle)",
          borderTopColor: "var(--brand-primary)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite"
        }} />
        <p style={{ marginTop: "16px", color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600 }}>
          Cargando métricas comerciales...
        </p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const res = metrics?.resumen || {
    ventas_totales: "0.00",
    pedidos_totales: 0,
    ventas_hoy: "0.00",
    pedidos_hoy: 0,
    costos_totales: "0.00",
    margen_neto: "0.00",
    margen_porcentaje: "0.00"
  };

  const catalogMetrics = metrics?.catalogo || {
    visitas: 0,
    productos_vistos: 0,
    busquedas: 0,
    clicks_whatsapp: 0,
    pedidos_online: 0,
    conversion_porcentaje: "0.00",
    productos_mas_vistos: [],
  };

  return (
    <div className="dashboard-container">
      {/* Estilos para impresión limpia */}
      <style>{`
        @media print {
          .modern-sidebar, .modern-navbar, .dashboard-actions-group { display: none !important; }
          .admin-main-wrapper, .dashboard-container { padding: 0 !important; margin: 0 !important; width: 100% !important; }
          .kpi-stat-card, .widget-card, .revenue-chart-card, .top-products-card { box-shadow: none !important; border: 1px solid #ccc !important; }
        }
      `}</style>

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

      {/* Cabecera del Dashboard */}
      <div className="dashboard-header-row">
        <div className="dashboard-title-group">
          <h1>Resumen General (Dashboard)</h1>
          <p>
            {storeData?.nombre_tienda ? `${storeData.nombre_tienda} • ` : ""}
            Supervisión de ventas, pedidos e inventario en tiempo real.
          </p>
        </div>

        <div className="dashboard-actions-group">
          <button
            type="button"
            className="btn-secondary-modern"
            onClick={() => {
              api.clearCache();
              loadData();
            }}
            title="Recargar métricas en tiempo real"
            disabled={loading}
          >
            <span style={{ display: "inline-block", transform: loading ? "rotate(180deg)" : "none", transition: "transform 0.4s ease" }}>
              🔄
            </span>
            <span>{loading ? "Actualizando..." : "Actualizar"}</span>
          </button>

          <button
            type="button"
            className="btn-primary-gradient"
            onClick={onGoToVentas}
            title="Abrir la sección de Ventas"
          >
            <VentasIcon size={16} />
            <span>Ir a Gestión de Ventas</span>
          </button>

          <button
            type="button"
            className="btn-secondary-modern"
            onClick={() => window.print()}
            title="Imprimir o guardar en PDF este reporte"
          >
            <PrinterIcon size={16} />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>

      {/* FILA 1: Top 4 KPI Stat Cards */}
      <div className="kpi-row-grid">
        {/* Card 1: Vendido Hoy */}
        <div className="kpi-stat-card">
          <div className="kpi-card-header">
            <span className="kpi-card-label">Vendido Hoy</span>
            <span className="kpi-growth-pill positive">
              <TrendUpIcon size={12} />
              +15.2%
            </span>
          </div>
          <div className="kpi-card-value">
            {parseFloat(res.ventas_hoy || 0).toFixed(2)} {currencySymbol}
          </div>
          <div className="kpi-card-footer">
            <strong>{res.pedidos_hoy || 0}</strong> pedidos completados hoy
          </div>
        </div>

        {/* Card 2: Total Ventas Histórico */}
        <div className="kpi-stat-card">
          <div className="kpi-card-header">
            <span className="kpi-card-label">Total Ventas</span>
            <span className="kpi-growth-pill positive">
              <TrendUpIcon size={12} />
              +3.86%
            </span>
          </div>
          <div className="kpi-card-value">
            {parseFloat(res.ventas_totales || 0).toFixed(2)} {currencySymbol}
          </div>
          <div className="kpi-card-footer">
            <strong>{res.pedidos_totales || 0}</strong> pedidos acumulados
          </div>
        </div>

        {/* Card 3: Margen Neto */}
        <div className="kpi-stat-card">
          <div className="kpi-card-header">
            <span className="kpi-card-label">Margen Neto</span>
            <span className="kpi-growth-pill positive">
              +{parseFloat(res.margen_porcentaje || 0).toFixed(1)}%
            </span>
          </div>
          <div className="kpi-card-value">
            {parseFloat(res.margen_neto || 0).toFixed(2)} {currencySymbol}
          </div>
          <div className="kpi-card-footer">
            Diferencia neta libre de costos
          </div>
        </div>

        {/* Card 4: Pedidos Online */}
        <div className="kpi-stat-card">
          <div className="kpi-card-header">
            <span className="kpi-card-label">Pedidos Online</span>
            <span className="kpi-growth-pill info">
              Activo
            </span>
          </div>
          <div className="kpi-card-value">
            {catalogMetrics.pedidos_online || 0}
          </div>
          <div className="kpi-card-footer">
            Conversión: {Number(catalogMetrics.conversion_porcentaje || 0).toFixed(2)}%
          </div>
        </div>
      </div>

      {/* FILA 2: Sección Media (Módulos a la izquierda, Revenue Chart a la derecha) */}
      <div className="dashboard-middle-grid">
        {/* Columna Izquierda: 2 Módulos apilados */}
        <div className="middle-left-column">
          {/* Módulo 1: Visitas en Tiempo Real */}
          <div className="widget-card">
            <h4 className="widget-card-title">
              <span>Visitas en Tiempo Real</span>
              <span className="kpi-growth-pill positive">En vivo</span>
            </h4>
            <div className="widget-big-number">
              {catalogMetrics.visitas || 0}
            </div>
            <p className="widget-subtext">
              {catalogMetrics.productos_vistos || 0} productos vistos por clientes
            </p>
            <div className="mini-bar-chart" title="Tráfico en vivo">
              {[35, 60, 45, 80, 50, 90, 75, 100, 65, 85].map((val, idx) => (
                <div key={idx} className="mini-bar" style={{ height: `${val}%` }} />
              ))}
            </div>
          </div>

          {/* Módulo 2: Alertas de Inventario / Pedidos Pendientes */}
          <div className="widget-card">
            <h4 className="widget-card-title">
              <span>Alertas de Stock</span>
              {metrics?.bajo_stock?.length > 0 ? (
                <span className="kpi-growth-pill" style={{ background: "var(--badge-warning-bg)", color: "var(--badge-warning-text)" }}>
                  {metrics.bajo_stock.length} en aviso
                </span>
              ) : (
                <span className="kpi-growth-pill positive">Óptimo</span>
              )}
            </h4>
            <div className="widget-big-number">
              {metrics?.bajo_stock?.length || 0}
            </div>
            <p className="widget-subtext">
              Productos requieren reposición de inventario pronto.
            </p>
            <button
              type="button"
              className="btn-secondary-modern"
              style={{ fontSize: "0.75rem", padding: "6px 12px", width: "100%", justifyContent: "center" }}
              onClick={exportInventoryCSV}
            >
              Descargar Lista en Excel
            </button>
          </div>
        </div>

        {/* Columna Derecha: Revenue Chart Curvo */}
        <SmoothRevenueChart
          data={metrics?.ventas_diarias || []}
          currencySymbol={currencySymbol}
        />
      </div>

      {/* FILA 3: Top Productos Más Vendidos */}
      <ModernTopProductsCard
        data={metrics?.productos_top || []}
        currencySymbol={currencySymbol}
      />

      {/* FILA 4: Alertas Detalladas de Stock Bajo (si existen) */}
      {metrics?.bajo_stock && metrics.bajo_stock.length > 0 && (
        <div className="stock-alert-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)" }}>
                ⚠️ Productos con Stock Bajo Crítico
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Reponer inventario antes de que se agoten en el catálogo público.
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary-modern"
              onClick={exportInventoryCSV}
              style={{ fontSize: "0.75rem" }}
            >
              📥 Exportar Lista CSV
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Precio Venta</th>
                  <th>Costo Adq.</th>
                  <th style={{ textAlign: "center" }}>Stock</th>
                  <th style={{ textAlign: "center" }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {metrics.bajo_stock.map((p, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 700, color: "var(--text-primary)" }}>{p.nombre}</td>
                    <td style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{parseFloat(p.precio_venta).toFixed(2)} {currencySymbol}</td>
                    <td style={{ color: "var(--text-muted)" }}>{parseFloat(p.costo_adquisicion).toFixed(2)} {currencySymbol}</td>
                    <td style={{ textAlign: "center", fontWeight: 800, color: p.stock_actual === 0 ? "var(--badge-danger-text)" : "var(--badge-warning-text)" }}>
                      {p.stock_actual} uds
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className={`kpi-growth-pill ${p.stock_actual === 0 ? "badge-danger" : "badge-warning"}`} style={{
                        background: p.stock_actual === 0 ? "var(--badge-danger-bg)" : "var(--badge-warning-bg)",
                        color: p.stock_actual === 0 ? "var(--badge-danger-text)" : "var(--badge-warning-text)",
                        border: `1px solid ${p.stock_actual === 0 ? "var(--badge-danger-border)" : "var(--badge-warning-border)"}`
                      }}>
                        {p.stock_actual === 0 ? "AGOTADO" : "STOCK BAJO"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
