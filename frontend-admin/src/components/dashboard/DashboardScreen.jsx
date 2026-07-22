import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { Card } from '../Card';

function SalesChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="muted text-center py-4" style={{ fontSize: '11px' }}>No hay suficientes datos de ventas para mostrar el gráfico.</p>;
  }

  const maxVal = Math.max(...data.map(d => Number(d.recaudado)), 100);
  const width = 500;
  const height = 150;
  const padding = 20;

  const points = data.map((d, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(data.length - 1, 1);
    const y = height - padding - (Number(d.recaudado) * (height - padding * 2)) / maxVal;
    return { x, y, label: d.fecha, val: Number(d.recaudado) };
  });

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, "");

  const areaD = points.length > 0 
    ? `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z` 
    : "";

  return (
    <div className="card chart-container" style={{ background: '#ffffff', borderRadius: '12px', padding: '16px', border: '1px solid #f3f4f6' }}>
      <h4 className="text-xs font-bold text-gray-500 mb-2" style={{ margin: '0 0 8px 0', fontSize: '11px' }}>Tendencia de Ventas (Últimos 30 días)</h4>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="auto" style={{ overflow: 'hidden' }}>
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#f3f4f6" strokeWidth={1} />
        <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#f3f4f6" strokeWidth={1} />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e5e7eb" strokeWidth={1} />

        {areaD && <path d={areaD} fill="url(#chartGrad)" />}
        {pathD && <path d={pathD} fill="none" stroke="#10B981" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}

        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3} fill="#10B981" stroke="#ffffff" strokeWidth={1} />
            {points.length <= 15 && p.val > 0 && (
              <text x={p.x} y={p.y - 8} fontSize="7" fontWeight="bold" textAnchor="middle" fill="#374151">
                {p.val.toFixed(0)} Bs
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function TopProductsChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="muted text-center py-4" style={{ fontSize: '11px' }}>No hay datos de productos vendidos.</p>;
  }

  const maxQty = Math.max(...data.map(d => d.cantidad), 1);

  return (
    <div className="card chart-container" style={{ background: '#ffffff', borderRadius: '12px', padding: '16px', border: '1px solid #f3f4f6' }}>
      <h4 className="text-xs font-bold text-gray-500 mb-3" style={{ margin: '0 0 12px 0', fontSize: '11px' }}>Top Productos Más Vendidos</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {data.map((item, index) => {
          const percentage = (item.cantidad / maxQty) * 100;
          return (
            <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold' }}>
                <span className="text-gray-700 truncate" style={{ maxWidth: '70%' }}>{item.nombre}</span>
                <span className="text-emerald-600">{item.cantidad} u. ({parseFloat(item.recaudado).toFixed(2)} Bs)</span>
              </div>
              <div style={{ height: '8px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${percentage}%`, background: '#10B981', borderRadius: '4px' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardScreen({ user, onGoToVentas }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [allProducts, setAllProducts] = useState([]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const m = await api.getMetrics(user.id_tienda);
      setMetrics(m);
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar las métricas de la tienda.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user.id_tienda]);

  const exportInventoryCSV = async () => {
    let prods = allProducts;
    if (prods.length === 0) {
      try {
        prods = await api.listProductos();
        setAllProducts(prods || []);
      } catch (e) {
        alert("Error al exportar inventario.");
        return;
      }
    }
    if (prods.length === 0) {
      alert("No hay productos en inventario.");
      return;
    }
    
    let csv = "\uFEFFID Producto,Nombre,Stock,Precio Venta,Costo Adquisicion,Margen Esperado\n";
    prods.forEach(p => {
      const costo = p.costo_adquisicion || 0;
      const margen = p.precio_venta - costo;
      csv += `"${p.id_producto}","${p.nombre.replace(/"/g, '""')}",${p.stock_actual},${p.precio_venta},${costo},${margen.toFixed(2)}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `inventario_${user.id_tienda.slice(0, 8)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && !metrics) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-500 text-sm font-medium">Cargando métricas comerciales...</p>
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

  return (
    <div className="stack dashboard-view">
      <style>{`
        @media print {
          body { background: #ffffff !important; color: #000000 !important; font-size: 11px !important; }
          .layout-sidebar, .layout-header, .btn, .direct-sale-btn, .actions, .filter-block, .store-whatsapp-card { display: none !important; }
          .layout-content, .dashboard-view, .stack { width: 100% !important; padding: 0 !important; margin: 0 !important; }
          .card { border: 1px solid #e5e7eb !important; box-shadow: none !important; margin-bottom: 20px !important; }
          .card-head { border-bottom: 1px solid #e5e7eb !important; }
          .products-grid, .stats { display: grid !important; grid-template-columns: repeat(4, 1fr) !important; gap: 10px !important; }
        }
      `}</style>

      {error ? <div className="error-text" style={{ padding: '12px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>{error}</div> : null}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 className="section-title" style={{ margin: 0, fontSize: '18px', fontWeight: 'extrabold', color: '#1f2937' }}>Resumen de Negocios</h2>
          <p className="text-gray-400" style={{ margin: '2px 0 0 0', fontSize: '11px' }}>Control de inventario, costos y ventas físicas/online en tiempo real.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-primary" onClick={onGoToVentas} style={{ background: '#059669', borderColor: '#059669', color: '#ffffff', fontSize: '12px', fontWeight: 'bold' }}>
            Ir a Gestión de Ventas
          </button>
          <button className="btn btn-secondary" onClick={() => window.print()} style={{ fontSize: '12px', fontWeight: 'bold' }}>
            🖨️ Exportar PDF / Imprimir
          </button>
        </div>
      </div>

      {/* Grid de Metricas */}
      <div className="stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '20px', margin: '20px 0' }}>
        
        {/* Tarjeta: Vendido Hoy */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #e5e7eb',
          borderTop: '4px solid #10b981',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
          transition: 'transform 0.2s',
          cursor: 'default'
        }}>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: '700', color: '#6b7280', letterSpacing: '0.05em' }}>Vendido hoy</span>
          <strong style={{ display: 'block', fontSize: '24px', color: '#111827', marginTop: '8px', fontWeight: '700' }}>{parseFloat(res.ventas_hoy || 0).toFixed(2)} Bs</strong>
          <span style={{ fontSize: '11px', color: '#059669', marginTop: '6px', display: 'block', fontWeight: '600' }}>{res.pedidos_hoy || 0} Pedidos completados hoy</span>
        </div>

        {/* Tarjeta: Vendido Histórico */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #e5e7eb',
          borderTop: '4px solid #4f46e5',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
          transition: 'transform 0.2s',
          cursor: 'default'
        }}>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: '700', color: '#6b7280', letterSpacing: '0.05em' }}>Vendido Total (Histórico)</span>
          <strong style={{ display: 'block', fontSize: '24px', color: '#111827', marginTop: '8px', fontWeight: '700' }}>{parseFloat(res.ventas_totales).toFixed(2)} Bs</strong>
          <span style={{ fontSize: '11px', color: '#4f46e5', marginTop: '6px', display: 'block', fontWeight: '600' }}>{res.pedidos_totales} Ventas totales activas</span>
        </div>

        {/* Tarjeta: Costo de Stock */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #e5e7eb',
          borderTop: '4px solid #d97706',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
          transition: 'transform 0.2s',
          cursor: 'default'
        }}>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: '700', color: '#6b7280', letterSpacing: '0.05em' }}>Costo de Stock (Inversión)</span>
          <strong style={{ display: 'block', fontSize: '24px', color: '#111827', marginTop: '8px', fontWeight: '700' }}>{parseFloat(res.costos_totales).toFixed(2)} Bs</strong>
          <span style={{ fontSize: '11px', color: '#d97706', marginTop: '6px', display: 'block', fontWeight: '600' }}>Inversión acumulada en mercancías</span>
        </div>

        {/* Tarjeta: Ganancia Neta */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #e5e7eb',
          borderTop: '4px solid #2563eb',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
          transition: 'transform 0.2s',
          cursor: 'default'
        }}>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: '700', color: '#6b7280', letterSpacing: '0.05em' }}>Ganancia Neta</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <strong style={{ display: 'block', fontSize: '24px', color: '#111827', marginTop: '8px', fontWeight: '700' }}>{parseFloat(res.margen_neto).toFixed(2)} Bs</strong>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: '12px' }}>{parseFloat(res.margen_porcentaje).toFixed(1)}%</span>
          </div>
          <span style={{ fontSize: '11px', color: '#2563eb', marginTop: '6px', display: 'block', fontWeight: '600' }}>Diferencia libre de costos</span>
        </div>
      </div>

      {/* Alertas de Reposición */}
      {metrics?.bajo_stock && metrics.bajo_stock.length > 0 && (
        <div style={{ width: '100%', overflow: 'hidden' }}>
          <Card title="⚠️ Productos con Stock Bajo (Alertas de Reposición)">
            <div style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                <p className="text-amber-800 text-xs font-semibold" style={{ margin: 0 }}>Renovar el inventario de estos productos pronto:</p>
                <button className="btn btn-secondary text-xs" onClick={exportInventoryCSV} style={{ fontSize: '10px', padding: '4px 8px' }}>
                  📥 Excel de Inventario
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left', color: '#6b7280' }}>
                      <th style={{ padding: '8px' }}>Producto</th>
                      <th style={{ padding: '8px' }}>Precio Venta</th>
                      <th style={{ padding: '8px' }}>Costo Adq.</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Stock Actual</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.bajo_stock.map((p, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6', background: p.stock_actual === 0 ? '#fef2f2' : 'transparent' }}>
                        <td style={{ padding: '8px', fontWeight: 'bold', color: '#1f2937' }}>{p.nombre}</td>
                        <td style={{ padding: '8px' }}>{parseFloat(p.precio_venta).toFixed(2)} Bs</td>
                        <td style={{ padding: '8px' }}>{parseFloat(p.costo_adquisicion).toFixed(2)} Bs</td>
                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'black', color: p.stock_actual === 0 ? '#ef4444' : '#d97706' }}>
                          {p.stock_actual} uds
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <span className={`badge ${p.stock_actual === 0 ? "badge-danger" : "badge-warning"}`} style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '8px',
                            fontWeight: 'bold',
                            color: '#ffffff',
                            background: p.stock_actual === 0 ? '#ef4444' : '#d97706'
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
          </Card>
        </div>
      )}

      {/* Graficos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '20px', margin: '20px 0' }}>
        <SalesChart data={metrics?.ventas_diarias || []} />
        <TopProductsChart data={metrics?.productos_top || []} />
      </div>
    </div>
  );
}
