import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api';
import { AuditoriaIcon, SearchIcon } from '../common/Icons';

/* Helper para iniciales de avatar */
function getInitials(nameOrEmail) {
  if (!nameOrEmail) return "U";
  const clean = nameOrEmail.split("@")[0].replace(/[^a-zA-Z0-9]/g, " ").trim();
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

/* Helper para formatear fecha y hora local */
function formatDateTime(isoString) {
  if (!isoString) return "-";
  try {
    const fixed = isoString.endsWith("Z") ? isoString : `${isoString}Z`;
    const d = new Date(fixed);
    return d.toLocaleString("es-BO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return isoString;
  }
}

/* Helper para calcular fechas predeterminadas */
function getDatePresetRange(preset) {
  const now = new Date();
  const toDateStr = (d) => d.toISOString().split("T")[0];

  if (preset === "Hoy") {
    const today = toDateStr(now);
    return { startDate: today, endDate: today };
  }
  if (preset === "7D") {
    const start = new Date();
    start.setDate(now.getDate() - 7);
    return { startDate: toDateStr(start), endDate: toDateStr(now) };
  }
  if (preset === "30D") {
    const start = new Date();
    start.setDate(now.getDate() - 30);
    return { startDate: toDateStr(start), endDate: toDateStr(now) };
  }
  return { startDate: "", endDate: "" };
}

export default function AuditoriaScreen() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filterRol, setFilterRol] = useState("");
  const [filterStatus, setFilterStatus] = useState(""); // "" | "success" | "error"
  const [datePreset, setDatePreset] = useState("30D");

  // Rango inicial de 30 días
  const initialRange = useMemo(() => getDatePresetRange("30D"), []);
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);

  const loadLogs = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.auditLogs({
        rol: filterRol || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        limit: 150,
      });
      setRows(data || []);
    } catch (e) {
      setError(e.message || "Error al sincronizar bitácora de auditoría");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [filterRol, startDate, endDate]);

  // Selección de presets rápidos
  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    const range = getDatePresetRange(preset);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  };

  // Filtrado instantáneo en memoria para ultra fluidez
  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter((r) => {
      // Filtro por estado
      if (filterStatus === "success" && r.exito === false) return false;
      if (filterStatus === "error" && r.exito !== false) return false;

      // Filtro por texto
      if (!normalized) return true;
      const haystack = [
        r.accion,
        r.evento,
        r.email_usuario,
        r.email_intentado,
        r.id_tienda,
        r.ip,
        r.metodo_http,
        r.endpoint,
        r.detalle,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [rows, query, filterStatus]);

  // KPIs de Auditoría
  const metrics = useMemo(() => {
    const total = rows.length;
    const todayStr = new Date().toISOString().split("T")[0];

    const todayCount = rows.filter((r) => {
      if (!r.fecha_hora) return false;
      return r.fecha_hora.startsWith(todayStr);
    }).length;

    const uniqueUsers = new Set(
      rows.map((r) => r.email_usuario || r.email_intentado).filter(Boolean)
    ).size;

    const securityAlerts = rows.filter((r) => {
      if (r.exito === false) return true;
      const method = (r.metodo_http || "").toUpperCase();
      if (method === "DELETE") return true;
      const act = (r.accion || "").toLowerCase();
      return act.includes("password") || act.includes("reset") || act.includes("login fail");
    }).length;

    return { total, todayCount, uniqueUsers, securityAlerts };
  }, [rows]);

  // Exportar logs a CSV
  const exportCSV = () => {
    if (filteredRows.length === 0) {
      alert("No hay registros en la vista actual para exportar.");
      return;
    }
    let csv = "\uFEFFFecha_Hora,Metodo,Accion,Usuario,Rol,Tienda_ID,Direccion_IP,Estado,Detalle\n";
    filteredRows.forEach((r) => {
      const fecha = formatDateTime(r.fecha_hora);
      const metodo = r.metodo_http || "N/A";
      const accion = `"${(r.accion || "").replace(/"/g, '""')}"`;
      const usuario = `"${(r.email_usuario || r.email_intentado || "Anónimo").replace(/"/g, '""')}"`;
      const rol = r.rol_usuario || "-";
      const tienda = r.id_tienda || "-";
      const ip = r.ip || "-";
      const estado = r.exito === false ? "Fallido" : "Exitoso";
      const detalle = `"${(r.detalle || r.endpoint || "").replace(/"/g, '""')}"`;
      csv += `${fecha},${metodo},${accion},${usuario},${rol},${tienda},${ip},${estado},${detalle}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `auditoria_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getMethodBadgeClass = (method, action = "") => {
    const m = (method || "").toUpperCase();
    const act = (action || "").toLowerCase();
    if (act.includes("login") || act.includes("auth")) return "audit-method-badge auth";
    if (m === "POST") return "audit-method-badge post";
    if (m === "PATCH" || m === "PUT") return "audit-method-badge patch";
    if (m === "DELETE") return "audit-method-badge delete";
    return "audit-method-badge get";
  };

  return (
    <div className="audit-container">
      {/* CABECERA DE LA PANTALLA */}
      <div className="audit-header-row">
        <div>
          <h1 style={{ fontSize: "1.65rem", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
            Registro de Auditoría del Sistema
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "0.88rem", color: "var(--text-secondary)" }}>
            Trazabilidad de seguridad, accesos de personal y operaciones registradas en el catálogo.
          </p>
        </div>

        <div className="audit-actions-group">
          <button
            type="button"
            className="btn-secondary-modern"
            onClick={exportCSV}
            title="Descargar eventos en formato CSV compatible con Excel"
          >
            <span>📥 Exportar CSV</span>
          </button>

          <button
            type="button"
            className="catalog-sync-btn"
            onClick={loadLogs}
            title="Sincronizar eventos de auditoría"
            disabled={loading}
          >
            <span style={{ display: "inline-block", transform: loading ? "rotate(180deg)" : "none", transition: "transform 0.4s ease" }}>
              🔄
            </span>
            <span>{loading ? "Sincronizando..." : "Actualizar"}</span>
          </button>
        </div>
      </div>

      {error ? (
        <div style={{ background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "12px", padding: "12px 16px", color: "#ef4444", fontSize: "0.86rem" }}>
          ⚠️ {error}
        </div>
      ) : null}

      {/* KPI BENTO STRIP DE AUDITORÍA */}
      <div className="catalog-kpi-bento">
        {/* Total Eventos */}
        <div className="catalog-kpi-card accent-cyan">
          <div className="catalog-kpi-header">
            <span className="catalog-kpi-label">Total Eventos</span>
            <div className="catalog-kpi-icon-wrap cyan">
              <AuditoriaIcon size={18} />
            </div>
          </div>
          <div className="catalog-kpi-number">{metrics.total}</div>
          <div className="catalog-kpi-footnote">
            <span className="catalog-kpi-dot cyan" />
            <span>Registros cargados en el periodo</span>
          </div>
        </div>

        {/* Eventos Hoy */}
        <div className="catalog-kpi-card accent-emerald">
          <div className="catalog-kpi-header">
            <span className="catalog-kpi-label">Actividad Hoy</span>
            <div className="catalog-kpi-icon-wrap emerald">
              <span style={{ fontSize: "1.1rem" }}>⚡</span>
            </div>
          </div>
          <div className="catalog-kpi-number">{metrics.todayCount}</div>
          <div className="catalog-kpi-footnote">
            <span className="catalog-kpi-dot emerald" />
            <span>Operaciones en las últimas 24h</span>
          </div>
        </div>

        {/* Usuarios Únicos */}
        <div className="catalog-kpi-card accent-purple">
          <div className="catalog-kpi-header">
            <span className="catalog-kpi-label">Usuarios Únicos</span>
            <div className="catalog-kpi-icon-wrap purple">
              <span style={{ fontSize: "1.1rem" }}>👤</span>
            </div>
          </div>
          <div className="catalog-kpi-number">{metrics.uniqueUsers}</div>
          <div className="catalog-kpi-footnote">
            <span className="catalog-kpi-dot purple" />
            <span>Cuentas activas en la bitácora</span>
          </div>
        </div>

        {/* Alertas de Seguridad */}
        <div className="catalog-kpi-card accent-amber">
          <div className="catalog-kpi-header">
            <span className="catalog-kpi-label">Alertas / Críticos</span>
            <div className="catalog-kpi-icon-wrap amber">
              <span style={{ fontSize: "1.1rem" }}>🛡️</span>
            </div>
          </div>
          <div className="catalog-kpi-number">{metrics.securityAlerts}</div>
          <div className="catalog-kpi-footnote">
            <span className="catalog-kpi-dot amber" />
            <span>Fallos o acciones destructivas</span>
          </div>
        </div>
      </div>

      {/* PANEL DE FILTROS & BÚSQUEDA */}
      <div className="audit-filter-panel">
        <div className="audit-filter-top-row">
          {/* Barra de Búsqueda Reactiva */}
          <div className="audit-search-box">
            <SearchIcon size={18} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <input
              className="audit-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por acción, usuario, IP, endpoint o tienda..."
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.85rem", padding: "0 4px" }}
                title="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
          </div>

          {/* Presets Rápidos de Fecha */}
          <div className="audit-preset-tabs">
            {["Hoy", "7D", "30D", "Todo"].map((preset) => (
              <button
                key={preset}
                type="button"
                className={`audit-preset-btn ${datePreset === preset ? "active" : ""}`}
                onClick={() => handlePresetChange(preset)}
              >
                {preset === "Todo" ? "Todo el Historial" : preset === "Hoy" ? "Hoy" : `Últimos ${preset}`}
              </button>
            ))}
          </div>
        </div>

        {/* Filtros Secundarios */}
        <div className="audit-filter-bottom-row">
          <div className="audit-filter-field">
            <label htmlFor="audit-filter-rol">Rol de Usuario</label>
            <select
              id="audit-filter-rol"
              value={filterRol}
              onChange={(e) => setFilterRol(e.target.value)}
            >
              <option value="">Todos los roles</option>
              <option value="superadmin">Superadmin</option>
              <option value="admin">Administrador</option>
              <option value="empleado">Empleado</option>
            </select>
          </div>

          <div className="audit-filter-field">
            <label htmlFor="audit-filter-status">Estado Operación</label>
            <select
              id="audit-filter-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">Todos los estados</option>
              <option value="success">Solo Exitosos ✅</option>
              <option value="error">Solo Fallidos / Alertas ⚠️</option>
            </select>
          </div>

          <div className="audit-filter-field">
            <label htmlFor="audit-start-date">Desde fecha</label>
            <input
              id="audit-start-date"
              type="date"
              value={startDate}
              onChange={(e) => {
                setDatePreset("Personalizado");
                setStartDate(e.target.value);
              }}
            />
          </div>

          <div className="audit-filter-field">
            <label htmlFor="audit-end-date">Hasta fecha</label>
            <input
              id="audit-end-date"
              type="date"
              value={endDate}
              onChange={(e) => {
                setDatePreset("Personalizado");
                setEndDate(e.target.value);
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%", paddingBottom: "2px" }}>
            <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 600 }}>
              {filteredRows.length} {filteredRows.length === 1 ? "evento filtrado" : "eventos filtrados"}
            </span>
          </div>
        </div>
      </div>

      {/* TABLA MODERNA Y CARDS MÓVILES DE AUDITORÍA */}
      <div className="audit-table-card">
        {loading ? (
          <div style={{ padding: "48px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
            ⏳ Sincronizando registros de auditoría...
          </div>
        ) : filteredRows.length === 0 ? (
          <div style={{ padding: "52px 16px", textAlign: "center" }}>
            <div style={{ fontSize: "2.6rem", marginBottom: "8px" }}>🛡️</div>
            <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text-primary)" }}>
              No se encontraron registros de auditoría
            </h3>
            <p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: "0.86rem" }}>
              {query || filterRol || filterStatus
                ? "Prueba cambiando o limpiando los criterios de búsqueda y filtros."
                : "No hay eventos registrados en este periodo temporal."}
            </p>
          </div>
        ) : (
          <>
            {/* VISTA ESCRITORIO: TABLA MODERNA */}
            <div className="audit-table-wrap">
              <table className="audit-modern-table">
                <thead>
                  <tr>
                    <th>Fecha y Hora</th>
                    <th>Método / Acción</th>
                    <th>Usuario & Rol</th>
                    <th>Estado</th>
                    <th>Tienda ID</th>
                    <th>Dirección IP</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => {
                    const userDisplay = r.email_usuario || r.email_intentado || "Anónimo / Sistema";
                    const isFailure = r.exito === false;
                    return (
                      <tr key={r.id}>
                        {/* Fecha */}
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <strong style={{ color: "var(--text-primary)", fontSize: "0.84rem" }}>
                              {formatDateTime(r.fecha_hora)}
                            </strong>
                            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                              Hora Local
                            </span>
                          </div>
                        </td>

                        {/* Acción y Método */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span className={getMethodBadgeClass(r.metodo_http, r.accion)}>
                              {r.metodo_http || "LOG"}
                            </span>
                            <div>
                              <strong style={{ color: "var(--text-primary)", fontSize: "0.88rem", display: "block" }}>
                                {r.accion}
                              </strong>
                              {r.endpoint && (
                                <span style={{ fontSize: "0.73rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
                                  {r.endpoint.length > 40 ? `${r.endpoint.slice(0, 40)}...` : r.endpoint}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Usuario */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div className="audit-user-avatar">
                              {getInitials(userDisplay)}
                            </div>
                            <div>
                              <strong style={{ color: "var(--text-primary)", fontSize: "0.86rem", display: "block" }}>
                                {userDisplay}
                              </strong>
                              {r.rol_usuario ? (
                                <span style={{ fontSize: "0.72rem", color: "var(--brand-primary)", fontWeight: 700, textTransform: "uppercase" }}>
                                  {r.rol_usuario}
                                </span>
                              ) : (
                                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                  Sin rol
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Estado */}
                        <td>
                          <span className={`audit-status-pill ${isFailure ? "failure" : "success"}`}>
                            <span>{isFailure ? "●" : "●"}</span>
                            <span>{isFailure ? "Fallido" : "Exitoso"}</span>
                          </span>
                        </td>

                        {/* Tienda */}
                        <td>
                          <span className="audit-mono-pill">
                            {r.id_tienda ? `${r.id_tienda.slice(0, 8)}...` : "Global"}
                          </span>
                        </td>

                        {/* IP */}
                        <td>
                          <span className="audit-mono-pill">
                            {r.ip || "127.0.0.1"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* VISTA MÓVIL: CARDS RESPONSIVAS (< 768px) */}
            <div className="audit-mobile-cards">
              {filteredRows.map((r) => {
                const userDisplay = r.email_usuario || r.email_intentado || "Anónimo";
                const isFailure = r.exito === false;
                return (
                  <div key={r.id} className="audit-card-item">
                    <div className="audit-card-header">
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className={getMethodBadgeClass(r.metodo_http, r.accion)}>
                          {r.metodo_http || "LOG"}
                        </span>
                        <strong style={{ fontSize: "0.88rem", color: "var(--text-primary)" }}>
                          {r.accion}
                        </strong>
                      </div>
                      <span className={`audit-status-pill ${isFailure ? "failure" : "success"}`}>
                        <span>{isFailure ? "Fallido" : "Exitoso"}</span>
                      </span>
                    </div>

                    <div className="audit-card-user-row">
                      <div className="audit-user-avatar" style={{ width: "30px", height: "30px", fontSize: "0.74rem" }}>
                        {getInitials(userDisplay)}
                      </div>
                      <div>
                        <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "var(--text-primary)" }}>
                          {userDisplay}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                          Rol: {r.rol_usuario || "N/A"}
                        </div>
                      </div>
                    </div>

                    <div className="audit-card-footer">
                      <span>🕒 {formatDateTime(r.fecha_hora)}</span>
                      <span>🌐 IP: {r.ip || "127.0.0.1"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
