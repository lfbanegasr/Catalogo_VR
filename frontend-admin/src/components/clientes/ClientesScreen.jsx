import React, { useEffect, useState, useMemo } from "react";
import { api } from "../../api";
import {
  ClientesIcon,
  SearchIcon,
  WhatsAppIcon,
  CloseIcon,
  CheckIcon,
  EditIcon,
  ExternalLinkIcon,
  TrendUpIcon,
} from "../common/Icons";

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " Bs.";
}

function getInitials(name) {
  if (!name) return "CL";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

export default function ClientesScreen({ user }) {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toastMsg, setToastMsg] = useState("");

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  };

  const load = async (query = search) => {
    setLoading(true);
    setError("");
    try {
      const data = await api.listClientes(query.trim(), user.id_tienda);
      setClients(data || []);
    } catch (requestError) {
      setError(requestError.message || "No se pudieron cargar los clientes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load("");
  }, [user.id_tienda]);

  const openClient = async (idCliente) => {
    setError("");
    try {
      const detail = await api.getCliente(idCliente, user.id_tienda);
      setSelected(detail);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const saveClient = async () => {
    if (!selected || !["admin", "superadmin"].includes(user.rol)) return;
    setSaving(true);
    setError("");
    try {
      const updated = await api.updateCliente(selected.id_cliente, {
        nombre_completo: selected.nombre_completo,
        telefono: selected.telefono || null,
        email: selected.email || null,
        ciudad_region: selected.ciudad_region || null,
        notas: selected.notas || null,
      }, user.id_tienda);
      setSelected(updated);
      await load();
      showToast("✅ Ficha de cliente actualizada correctamente");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  // Instant in-memory filter + backend fallback
  const displayClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      return (
        (c.nombre_completo || "").toLowerCase().includes(q) ||
        (c.telefono || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.ciudad_region || "").toLowerCase().includes(q)
      );
    });
  }, [clients, search]);

  // KPIs de clientes
  const metrics = useMemo(() => {
    const total = clients.length;
    const frequent = clients.filter((c) => Number(c.total_pedidos || 0) > 1).length;
    const totalSpent = clients.reduce((acc, c) => acc + Number(c.total_comprado || 0), 0);
    const totalOrders = clients.reduce((acc, c) => acc + Number(c.total_pedidos || 0), 0);
    const avgTicket = totalOrders > 0 ? totalSpent / totalOrders : 0;
    return { total, frequent, totalSpent, avgTicket };
  }, [clients]);

  const canEdit = ["admin", "superadmin"].includes(user?.rol);

  return (
    <div className="clients-container">
      {/* HEADER DE LA PANTALLA */}
      <div className="clients-header-row">
        <div>
          <h1 style={{ fontSize: "1.65rem", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
            Directorio de Clientes
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "0.88rem", color: "var(--text-secondary)" }}>
            Base de datos unificada, historial acumulado de compras, direcciones y notas comerciales.
          </p>
        </div>

        <button
          type="button"
          className="catalog-sync-btn"
          onClick={() => load(search)}
          title="Recargar clientes"
        >
          <span>🔄 Actualizar</span>
        </button>
      </div>

      {toastMsg && (
        <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "12px", padding: "12px 18px", color: "#10b981", fontSize: "0.88rem", fontWeight: 600 }}>
          {toastMsg}
        </div>
      )}

      {error ? (
        <div style={{ background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "12px", padding: "12px 16px", color: "#ef4444", fontSize: "0.86rem" }}>
          ⚠️ {error}
        </div>
      ) : null}

      {/* KPI BENTO STRIP DE CLIENTES */}
      <div className="catalog-kpi-bento">
        <div className="catalog-kpi-card accent-cyan">
          <div className="catalog-kpi-header">
            <span className="catalog-kpi-label">Total Clientes</span>
            <div className="catalog-kpi-icon-wrap cyan">
              <ClientesIcon size={18} />
            </div>
          </div>
          <div className="catalog-kpi-number">{metrics.total}</div>
          <div className="catalog-kpi-footnote">
            <span className="catalog-kpi-dot cyan" />
            <span>Registrados en tienda</span>
          </div>
        </div>

        <div className="catalog-kpi-card accent-emerald">
          <div className="catalog-kpi-header">
            <span className="catalog-kpi-label">Clientes Recurrentes</span>
            <div className="catalog-kpi-icon-wrap emerald">
              <CheckIcon size={18} />
            </div>
          </div>
          <div className="catalog-kpi-number">{metrics.frequent}</div>
          <div className="catalog-kpi-footnote">
            <span className="catalog-kpi-dot emerald" />
            <span>Con más de 1 pedido</span>
          </div>
        </div>

        <div className="catalog-kpi-card accent-purple">
          <div className="catalog-kpi-header">
            <span className="catalog-kpi-label">Volumen Comprado</span>
            <div className="catalog-kpi-icon-wrap purple">
              <TrendUpIcon size={18} />
            </div>
          </div>
          <div className="catalog-kpi-number" style={{ fontSize: "1.55rem" }}>
            {formatMoney(metrics.totalSpent)}
          </div>
          <div className="catalog-kpi-footnote">
            <span className="catalog-kpi-dot purple" />
            <span>Total histórico facturado</span>
          </div>
        </div>

        <div className="catalog-kpi-card accent-amber">
          <div className="catalog-kpi-header">
            <span className="catalog-kpi-label">Ticket Promedio</span>
            <div className="catalog-kpi-icon-wrap amber">
              <EditIcon size={18} />
            </div>
          </div>
          <div className="catalog-kpi-number" style={{ fontSize: "1.55rem" }}>
            {formatMoney(metrics.avgTicket)}
          </div>
          <div className="catalog-kpi-footnote">
            <span className="catalog-kpi-dot amber" />
            <span>Por pedido realizado</span>
          </div>
        </div>
      </div>

      {/* TOOLBAR Y BUSCADOR */}
      <div className="clients-filter-card">
        <form
          className="clients-search-box"
          onSubmit={(e) => {
            e.preventDefault();
            load(search);
          }}
        >
          <SearchIcon size={18} style={{ color: "var(--text-muted)" }} />
          <input
            className="clients-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono o correo..."
          />
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {search && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setSearch("");
                load("");
              }}
              style={{ padding: "8px 14px", fontSize: "0.82rem" }}
            >
              Limpiar filtro
            </button>
          )}

          <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 600 }}>
            {displayClients.length} {displayClients.length === 1 ? "cliente encontrado" : "clientes encontrados"}
          </span>
        </div>
      </div>

      {/* TABLA MODERNA DE CLIENTES */}
      <div className="clients-table-card">
        {loading ? (
          <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
            ⏳ Cargando clientes...
          </div>
        ) : displayClients.length === 0 ? (
          <div style={{ padding: "48px 16px", textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>👥</div>
            <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text-primary)" }}>No se encontraron clientes</h3>
            <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: "0.86rem" }}>
              {search ? "Prueba cambiando el criterio de búsqueda." : "Aún no se han registrado compras o clientes en esta tienda."}
            </p>
          </div>
        ) : (
          <table className="sales-modern-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Contacto</th>
                <th>Pedidos</th>
                <th>Total Comprado</th>
                <th style={{ textAlign: "right" }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {displayClients.map((client) => {
                const phoneClean = (client.telefono || "").replace(/\D/g, "");
                return (
                  <tr key={client.id_cliente}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div className="client-avatar-badge">
                          {getInitials(client.nombre_completo)}
                        </div>
                        <div>
                          <strong style={{ color: "var(--text-primary)", fontSize: "0.92rem", display: "block" }}>
                            {client.nombre_completo}
                          </strong>
                          <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                            ID: {client.id_cliente.slice(0, 8)}...
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        {client.telefono ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 600 }}>
                              {client.telefono}
                            </span>
                            <a
                              href={`https://wa.me/${phoneClean.startsWith("591") ? phoneClean : "591" + phoneClean}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Abrir WhatsApp"
                              style={{ color: "#25D366", display: "inline-flex" }}
                            >
                              <WhatsAppIcon size={15} />
                            </a>
                          </div>
                        ) : (
                          <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Sin teléfono</span>
                        )}

                        {client.email && (
                          <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                            {client.email}
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "3px 10px",
                          borderRadius: "999px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          background: client.total_pedidos > 1 ? "rgba(2, 132, 199, 0.14)" : "var(--bg-surface-elevated)",
                          color: client.total_pedidos > 1 ? "var(--brand-primary)" : "var(--text-secondary)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        {client.total_pedidos} {client.total_pedidos === 1 ? "pedido" : "pedidos"}
                      </span>
                    </td>

                    <td>
                      <strong style={{ color: "var(--text-primary)", fontSize: "0.95rem" }}>
                        {formatMoney(client.total_comprado)}
                      </strong>
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="catalog-card-action-btn"
                        onClick={() => openClient(client.id_cliente)}
                      >
                        <ExternalLinkIcon size={14} />
                        <span>Ver Ficha</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL / FICHA DETALLADA DE CLIENTE */}
      {selected && (
        <div
          className="client-modal-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <section
            className="client-modal-window"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <header className="catalog-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div className="client-avatar-badge" style={{ width: "46px", height: "46px", fontSize: "1rem" }}>
                  {getInitials(selected.nombre_completo)}
                </div>
                <div>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--brand-primary)" }}>
                    Ficha Comercial del Cliente
                  </span>
                  <h2 style={{ margin: "2px 0 0", fontSize: "1.25rem", color: "var(--text-primary)" }}>
                    {selected.nombre_completo}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                className="icon-close-btn"
                onClick={() => setSelected(null)}
                aria-label="Cerrar modal"
              >
                <CloseIcon size={20} />
              </button>
            </header>

            {/* Modal Body */}
            <div className="catalog-modal-body">
              {/* Resumen Comercial */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", background: "var(--bg-surface-elevated)", padding: "14px 18px", borderRadius: "16px", border: "1px solid var(--border-subtle)" }}>
                <div>
                  <div style={{ fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700, color: "var(--text-muted)" }}>
                    Total Pedidos
                  </div>
                  <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--brand-primary)" }}>
                    {selected.total_pedidos}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700, color: "var(--text-muted)" }}>
                    Total Comprado
                  </div>
                  <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-primary)" }}>
                    {formatMoney(selected.total_comprado)}
                  </div>
                </div>
              </div>

              {/* Formulario de Datos */}
              <div className="grid-form" style={{ marginTop: "6px" }}>
                <label>
                  Nombre Completo
                  <input
                    value={selected.nombre_completo || ""}
                    disabled={!canEdit}
                    onChange={(e) => setSelected((s) => ({ ...s, nombre_completo: e.target.value }))}
                  />
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
                  <label>
                    Teléfono
                    <input
                      value={selected.telefono || ""}
                      disabled={!canEdit}
                      placeholder="Ej: 77123456"
                      onChange={(e) => setSelected((s) => ({ ...s, telefono: e.target.value }))}
                    />
                  </label>

                  <label>
                    Correo Electrónico
                    <input
                      type="email"
                      value={selected.email || ""}
                      disabled={!canEdit}
                      placeholder="cliente@ejemplo.com"
                      onChange={(e) => setSelected((s) => ({ ...s, email: e.target.value }))}
                    />
                  </label>
                </div>

                <label>
                  Ciudad o Región
                  <input
                    value={selected.ciudad_region || ""}
                    disabled={!canEdit}
                    placeholder="Ej: Santa Cruz, La Paz, Cochabamba..."
                    onChange={(e) => setSelected((s) => ({ ...s, ciudad_region: e.target.value }))}
                  />
                </label>

                <label>
                  Notas Internas del Cliente
                  <textarea
                    rows={3}
                    value={selected.notas || ""}
                    disabled={!canEdit}
                    placeholder="Instrucciones especiales, referencias, preferencias de compra..."
                    onChange={(e) => setSelected((s) => ({ ...s, notas: e.target.value }))}
                  />
                </label>
              </div>

              {/* Direcciones Guardadas */}
              <div style={{ marginTop: "10px" }}>
                <h4 style={{ margin: "0 0 10px", fontSize: "0.95rem", color: "var(--text-primary)" }}>
                  Direcciones de Entrega Guardadas ({(selected.direcciones || []).length})
                </h4>

                <div className="client-address-grid">
                  {(selected.direcciones || []).map((address) => (
                    <article key={address.id_direccion} className="client-address-card">
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <strong style={{ color: "var(--text-primary)", fontSize: "0.88rem" }}>
                          {address.etiqueta || "Dirección"}
                        </strong>
                        {address.es_predeterminada && (
                          <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                            Principal
                          </span>
                        )}
                      </div>
                      <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                        {address.linea1}
                      </div>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                        {[address.ciudad, address.region].filter(Boolean).join(", ")}
                      </div>
                      {address.referencia && (
                        <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem", fontStyle: "italic", marginTop: "2px" }}>
                          Ref: {address.referencia}
                        </div>
                      )}
                    </article>
                  ))}

                  {(selected.direcciones || []).length === 0 && (
                    <div style={{ padding: "16px", borderRadius: "12px", background: "var(--bg-surface-elevated)", color: "var(--text-muted)", fontSize: "0.82rem", gridColumn: "1 / -1" }}>
                      Este cliente aún no tiene direcciones registradas.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <footer className="catalog-modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setSelected(null)}
              >
                Cerrar
              </button>

              {canEdit && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={saving}
                  onClick={saveClient}
                >
                  {saving ? "Guardando..." : "Guardar Cambios"}
                </button>
              )}
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
