import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api';
import StoreRefPicker from '../StoreRefPicker';
import { 
  UsuariosIcon, 
  EyeIcon, 
  EyeOffIcon, 
  EditIcon, 
  RefreshIcon,
  CheckIcon
} from '../common/Icons';

export default function UsuariosScreen({ user }) {
  const isSuper = user.rol === "superadmin";

  const [stores, setStores] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [creating, setCreating] = useState(false);

  const [filters, setFilters] = useState({
    tienda: isSuper ? "" : user.id_tienda,
    rol: "",
    activo: ""
  });

  const [form, setForm] = useState({
    id_tienda: isSuper ? "" : user.id_tienda,
    email: "",
    username: "",
    password: "",
    rol: isSuper ? "admin" : "empleado",
    activo: true
  });
  const [usernameCustomized, setUsernameCustomized] = useState(false);

  const [editing, setEditing] = useState(null);
  const [resettingUser, setResettingUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);

  const storeMap = useMemo(() => new Map(stores.map((s) => [s.id_tienda, s.nombre_tienda])), [stores]);

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setForm((prev) => {
      const next = { ...prev, email: val };
      if (!usernameCustomized) {
        const auto = val.split("@")[0].toLowerCase().replace(/[^a-z0-9_.-]/g, "");
        next.username = auto;
      }
      return next;
    });
  };

  const handleUsernameChange = (e) => {
    setUsernameCustomized(true);
    const clean = e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, "");
    setForm((prev) => ({ ...prev, username: clean }));
  };

  const loadStores = async () => {
    if (isSuper) {
      const data = await api.adminListTiendas();
      setStores(data);
      if (!form.id_tienda && data[0]?.id_tienda) {
        setForm((s) => ({ ...s, id_tienda: data[0].id_tienda }));
      }
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.adminListUsersFiltered({
        tienda: filters.tienda || undefined,
        rol: filters.rol || undefined,
        activo: filters.activo === "" ? undefined : filters.activo === "true",
      });
      setRows(data || []);
    } catch (e) {
      setError(e.message || "Error al cargar la lista de usuarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([loadStores(), loadUsers()]).catch((e) => setError(e.message));
  }, [user.id_tienda]);

  // Client-side search filtering (includes username, email, store, and role)
  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const q = searchTerm.toLowerCase();
    return rows.filter((u) => {
      const username = (u.username || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const storeName = (storeMap.get(u.id_tienda) || "").toLowerCase();
      const rol = (u.rol || "").toLowerCase();
      return username.includes(q) || email.includes(q) || storeName.includes(q) || rol.includes(q);
    });
  }, [rows, searchTerm, storeMap]);

  // Metrics
  const metrics = useMemo(() => {
    const total = rows.length;
    const admins = rows.filter((r) => r.rol === "admin" || r.rol === "superadmin").length;
    const staff = rows.filter((r) => r.rol === "empleado").length;
    const active = rows.filter((r) => r.activo).length;
    return { total, admins, staff, active };
  }, [rows]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) return;
    setCreating(true);
    setError("");
    setOkMsg("");
    try {
      const payload = {
        ...form,
        email: form.email.trim().toLowerCase(),
        username: form.username.trim().toLowerCase() || undefined,
      };
      const created = await api.adminCreateUser(payload);
      setOkMsg(`Usuario @${created.username || created.email} creado con éxito`);
      setForm((s) => ({
        ...s,
        email: "",
        username: "",
        password: ""
      }));
      setUsernameCustomized(false);
      await loadUsers();
    } catch (err) {
      setError(err.message || "No se pudo crear el usuario");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (u) => {
    try {
      await api.adminUpdateUser(u.id_usuario, { activo: !u.activo });
      setOkMsg(`Estado de ${u.email} actualizado`);
      await loadUsers();
    } catch (e) {
      setError(e.message || "Error al cambiar estado");
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    try {
      await api.adminUpdateUser(editing.id_usuario, {
        email: editing.email?.trim().toLowerCase(),
        username: editing.username?.trim().toLowerCase() || undefined,
        rol: isSuper ? editing.rol : "empleado",
        id_tienda: isSuper ? editing.id_tienda : user.id_tienda,
        activo: editing.activo
      });
      setOkMsg("Usuario actualizado exitosamente");
      setEditing(null);
      await loadUsers();
    } catch (e) {
      setError(e.message || "Error al actualizar usuario");
    }
  };

  const handleConfirmResetPassword = async (e) => {
    e.preventDefault();
    if (!resettingUser || !newPassword) return;
    try {
      await api.adminResetPassword(resettingUser.id_usuario, newPassword);
      setOkMsg(`Contraseña restablecida exitosamente para ${resettingUser.email}`);
      setResettingUser(null);
      setNewPassword("");
    } catch (e) {
      setError(e.message || "Error al restablecer contraseña");
    }
  };

  return (
    <div className="users-container">
      {/* Page Header */}
      <div className="users-header">
        <div className="users-header-info">
          <h2>{isSuper ? "Gestión de Usuarios y Accesos" : "Equipo y Personal de Tienda"}</h2>
          <p>Administra los roles, permisos y credenciales de acceso para la plataforma.</p>
        </div>
        <button 
          className="btn btn-ghost" 
          onClick={loadUsers} 
          title="Recargar usuarios"
          style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
        >
          <RefreshIcon size={16} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Alerts */}
      {error ? (
        <div className="alert alert-danger" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{error}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setError("")}>✕</button>
        </div>
      ) : null}
      {okMsg ? (
        <div className="alert alert-success" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{okMsg}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOkMsg("")}>✕</button>
        </div>
      ) : null}

      {/* KPI Bento Grid */}
      <div className="users-kpi-grid">
        <div className="users-kpi-card accent-indigo">
          <div className="users-kpi-icon">
            <UsuariosIcon size={24} />
          </div>
          <div className="users-kpi-details">
            <span className="users-kpi-label">Total Cuentas</span>
            <span className="users-kpi-val">{metrics.total}</span>
          </div>
        </div>

        <div className="users-kpi-card accent-purple">
          <div className="users-kpi-icon">
            <UsuariosIcon size={24} />
          </div>
          <div className="users-kpi-details">
            <span className="users-kpi-label">Administradores</span>
            <span className="users-kpi-val">{metrics.admins}</span>
          </div>
        </div>

        <div className="users-kpi-card accent-cyan">
          <div className="users-kpi-icon">
            <UsuariosIcon size={24} />
          </div>
          <div className="users-kpi-details">
            <span className="users-kpi-label">Personal / Staff</span>
            <span className="users-kpi-val">{metrics.staff}</span>
          </div>
        </div>

        <div className="users-kpi-card accent-emerald">
          <div className="users-kpi-icon">
            <CheckIcon size={24} />
          </div>
          <div className="users-kpi-details">
            <span className="users-kpi-label">Cuentas Activas</span>
            <span className="users-kpi-val">{metrics.active}</span>
          </div>
        </div>
      </div>

      {/* Create User Card */}
      <div className="user-form-card">
        <div className="user-form-header">
          <UsuariosIcon size={22} style={{ color: "var(--brand-primary)" }} />
          <h3>{isSuper ? "Crear Nuevo Usuario" : "Registrar Nuevo Empleado"}</h3>
        </div>

        <form onSubmit={handleCreateUser}>
          <div className="user-form-grid">
            {isSuper ? (
              <StoreRefPicker
                stores={stores}
                value={form.id_tienda}
                onChange={(v) => setForm((s) => ({ ...s, id_tienda: v }))}
                required
                label="Tienda Destino"
                placeholder="Buscar tienda..."
                helpText="Asigna el usuario a una tienda específica."
              />
            ) : null}

            <label>
              <span>Correo Electrónico</span>
              <input 
                type="email" 
                placeholder="ejemplo@mitienda.com" 
                value={form.email} 
                onChange={handleEmailChange} 
                required 
              />
            </label>

            <label>
              <span>Nombre de Usuario (Login)</span>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <span style={{ position: "absolute", left: "12px", color: "var(--brand-primary, #6366f1)", fontWeight: 800, fontSize: "0.95rem", pointerEvents: "none", zIndex: 1 }}>
                  @
                </span>
                <input 
                  type="text" 
                  placeholder="ej. loriglow, cajero1" 
                  value={form.username} 
                  onChange={handleUsernameChange} 
                  required 
                  minLength={3}
                  maxLength={50}
                  autoComplete="username"
                  style={{ paddingLeft: "30px", width: "100%" }}
                />
              </div>
              <small style={{ display: "block", fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "4px" }}>
                Identificador único para iniciar sesión rápidamente sin correo.
              </small>
            </label>

            <div>
              <label>
                <span>Contraseña</span>
                <div className="password-input-wrap">
                  <input 
                    type={showCreatePassword ? "text" : "password"} 
                    placeholder="Mínimo 6 caracteres" 
                    value={form.password} 
                    onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))} 
                    required 
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <button 
                    type="button" 
                    className="password-toggle-btn"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    title={showCreatePassword ? "Ocultar contraseña" : "Ver contraseña"}
                  >
                    {showCreatePassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                  </button>
                </div>
              </label>
            </div>

            {isSuper ? (
              <label>
                <span>Rol de Usuario</span>
                <select 
                  className="users-filter-select" 
                  value={form.rol} 
                  onChange={(e) => setForm((s) => ({ ...s, rol: e.target.value }))}
                >
                  <option value="admin">Administrador (admin)</option>
                  <option value="empleado">Empleado de tienda (empleado)</option>
                </select>
              </label>
            ) : null}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px", marginTop: "18px" }}>
            <label className="check-row" style={{ margin: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <input 
                type="checkbox" 
                checked={form.activo} 
                onChange={(e) => setForm((s) => ({ ...s, activo: e.target.checked }))} 
              />
              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Usuario Activo (Permitir acceso al sistema)</span>
            </label>

            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={creating}
              style={{ minWidth: "160px" }}
            >
              {creating ? "Creando usuario..." : isSuper ? "Crear usuario" : "Registrar Empleado"}
            </button>
          </div>
        </form>
      </div>

      {/* Users List & Filter Card */}
      <div className="users-table-card">
        {/* Filters Toolbar */}
        <div className="users-filters-row">
          <div className="users-search-field">
            <span className="users-search-icon">🔍</span>
            <input 
              type="text" 
              placeholder="Buscar por @usuario, correo, tienda o rol..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {isSuper && (
            <div style={{ minWidth: "220px" }}>
              <StoreRefPicker
                stores={stores}
                value={filters.tienda}
                onChange={(v) => {
                  setFilters((s) => ({ ...s, tienda: v }));
                  setTimeout(loadUsers, 50);
                }}
                allowEmpty
                label=""
                placeholder="Todas las tiendas"
                helpText=""
              />
            </div>
          )}

          {isSuper && (
            <select 
              className="users-filter-select" 
              value={filters.rol} 
              onChange={(e) => {
                setFilters((s) => ({ ...s, rol: e.target.value }));
                setTimeout(loadUsers, 50);
              }}
            >
              <option value="">Todos los roles</option>
              <option value="superadmin">Superadmin</option>
              <option value="admin">Admin</option>
              <option value="empleado">Empleado</option>
              <option value="cliente">Cliente</option>
            </select>
          )}

          <select 
            className="users-filter-select" 
            value={filters.activo} 
            onChange={(e) => {
              setFilters((s) => ({ ...s, activo: e.target.value }));
              setTimeout(loadUsers, 50);
            }}
          >
            <option value="">Todos los estados</option>
            <option value="true">Solo activos</option>
            <option value="false">Solo inactivos</option>
          </select>

          <button 
            type="button" 
            className="btn btn-ghost" 
            onClick={loadUsers}
            style={{ height: "42px" }}
          >
            Filtrar
          </button>
        </div>

        {/* Responsive Table */}
        <div className="table-wrap" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
              Cargando lista de usuarios...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
              No se encontraron usuarios con los filtros seleccionados.
            </div>
          ) : (
            <table className="users-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol</th>
                  {isSuper && <th>Tienda Asignada</th>}
                  <th>Estado</th>
                  <th style={{ textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const initial = (u.username || u.email || "U").slice(0, 1).toUpperCase();
                  const assignedStore = storeMap.get(u.id_tienda) || u.id_tienda || "Sin tienda";
                  return (
                    <tr key={u.id_usuario}>
                      <td>
                        <div className="users-user-cell">
                          <div className={`users-avatar ${u.rol || "empleado"}`}>
                            {initial}
                          </div>
                          <div className="users-user-meta">
                            <span style={{ fontWeight: 700, color: "var(--brand-primary, #6366f1)", display: "inline-flex", alignItems: "center", gap: "2px", fontSize: "0.94rem" }}>
                              @{u.username || "sin_usuario"}
                            </span>
                            <span className="users-user-email" style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                              {u.email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`role-pill ${u.rol || "empleado"}`}>
                          {u.rol}
                        </span>
                      </td>
                      {isSuper && (
                        <td>
                          <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
                            {assignedStore}
                          </span>
                        </td>
                      )}
                      <td>
                        <span className={`status-pill ${u.activo ? "active" : "inactive"}`}>
                          <span className="status-pill-dot" />
                          {u.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                          <button 
                            type="button" 
                            className="btn btn-ghost btn-sm" 
                            onClick={() => setEditing({ ...u })}
                            title="Editar usuario"
                            style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                          >
                            <EditIcon size={14} />
                            <span>Editar</span>
                          </button>

                          <button 
                            type="button" 
                            className={`btn btn-sm ${u.activo ? "btn-danger-ghost" : "btn-success-ghost"}`} 
                            onClick={() => handleToggleActive(u)}
                            title={u.activo ? "Desactivar acceso" : "Activar acceso"}
                          >
                            {u.activo ? "Desactivar" : "Activar"}
                          </button>

                          <button 
                            type="button" 
                            className="btn btn-ghost btn-sm" 
                            onClick={() => {
                              setResettingUser(u);
                              setNewPassword("");
                            }}
                            title="Restablecer clave"
                          >
                            Clave
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Edit User Modal */}
      {editing ? (
        <div className="client-modal-overlay" onClick={() => setEditing(null)}>
          <div className="client-modal-window" style={{ maxWidth: "560px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)" }}>
                Editar Usuario
              </h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>✕</button>
            </div>

            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <label>
                <span>Nombre de Usuario (Login)</span>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <span style={{ position: "absolute", left: "12px", color: "var(--brand-primary, #6366f1)", fontWeight: 800, fontSize: "0.95rem", pointerEvents: "none", zIndex: 1 }}>
                    @
                  </span>
                  <input 
                    type="text" 
                    value={editing.username || ""} 
                    onChange={(e) => setEditing((s) => ({ ...s, username: e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, "") }))} 
                    required 
                    minLength={3}
                    maxLength={50}
                    style={{ paddingLeft: "30px", width: "100%" }}
                  />
                </div>
                <small style={{ display: "block", fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "4px" }}>
                  Identificador único del usuario para iniciar sesión.
                </small>
              </label>

              <label>
                <span>Correo Electrónico</span>
                <input 
                  type="email" 
                  value={editing.email || ""} 
                  onChange={(e) => setEditing((s) => ({ ...s, email: e.target.value }))} 
                  required
                />
              </label>

              {isSuper ? (
                <label>
                  <span>Rol</span>
                  <select 
                    value={editing.rol || "admin"} 
                    onChange={(e) => setEditing((s) => ({ ...s, rol: e.target.value }))}
                  >
                    <option value="superadmin">Superadmin</option>
                    <option value="admin">Admin</option>
                    <option value="empleado">Empleado</option>
                    <option value="cliente">Cliente</option>
                  </select>
                </label>
              ) : null}

              {isSuper && (
                <StoreRefPicker
                  stores={stores}
                  value={editing.id_tienda}
                  onChange={(v) => setEditing((s) => ({ ...s, id_tienda: v }))}
                  required
                  label="Tienda Asignada"
                  placeholder="Buscar tienda..."
                  helpText="Modifica la tienda a la que pertenece este usuario."
                />
              )}

              <label className="check-row" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                <input 
                  type="checkbox" 
                  checked={!!editing.activo} 
                  onChange={(e) => setEditing((s) => ({ ...s, activo: e.target.checked }))} 
                />
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Usuario Activo (Permitir acceso)</span>
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
                  Cancelar
                </button>
                <button type="button" className="btn btn-primary" onClick={handleSaveEdit}>
                  Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Reset Password Modal */}
      {resettingUser ? (
        <div className="client-modal-overlay" onClick={() => setResettingUser(null)}>
          <div className="client-modal-window" style={{ maxWidth: "460px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)" }}>
                Restablecer Contraseña
              </h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setResettingUser(null)}>✕</button>
            </div>

            <form onSubmit={handleConfirmResetPassword} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-muted)" }}>
                Ingresa la nueva contraseña para <strong>{resettingUser.email}</strong>.
              </p>

              <label>
                <span>Nueva Contraseña</span>
                <div className="password-input-wrap">
                  <input 
                    type={showResetPassword ? "text" : "password"} 
                    placeholder="Mínimo 6 caracteres" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    autoFocus
                  />
                  <button 
                    type="button" 
                    className="password-toggle-btn"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                  >
                    {showResetPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                  </button>
                </div>
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setResettingUser(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirmar Nueva Contraseña
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
