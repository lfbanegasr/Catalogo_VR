import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api';
import { Card, HelperText } from '../Card';
import StoreRefPicker from '../StoreRefPicker';

export default function UsuariosScreen({ user }) {
  const isSuper = user.rol === "superadmin";

  const [stores, setStores] = useState([]);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    tienda: isSuper ? "" : user.id_tienda,
    rol: "",
    activo: ""
  });
  const [form, setForm] = useState({
    id_tienda: isSuper ? "" : user.id_tienda,
    email: "",
    password: "",
    rol: isSuper ? "admin" : "empleado",
    activo: true
  });
  const [editing, setEditing] = useState(null);
  const storeMap = useMemo(() => new Map(stores.map((s) => [s.id_tienda, s.nombre_tienda])), [stores]);

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
    setRows(await api.adminListUsersFiltered({
      tienda: filters.tienda || undefined,
      rol: filters.rol || undefined,
      activo: filters.activo === "" ? undefined : filters.activo === "true",
    }));
  };

  useEffect(() => {
    Promise.all([loadStores(), loadUsers()]).catch((e) => setError(e.message));
  }, [user.id_tienda]);

  return (
    <div className="stack">
      <Card title={isSuper ? "Lista de todos los usuarios" : "Lista de personal"}>
        {error ? <p className="error-text">{error}</p> : null}
        <div className="row" style={{ flexWrap: 'wrap', gap: '12px' }}>
          {isSuper && (
            <StoreRefPicker
              stores={stores}
              value={filters.tienda}
              onChange={(v) => setFilters((s) => ({ ...s, tienda: v }))}
              allowEmpty
              label="Tienda"
              placeholder="Filtrar por tienda..."
              helpText="Opcional: deja vacio para ver todas."
            />
          )}
          {isSuper && (
            <label>
              Rol
              <select value={filters.rol} onChange={(e) => setFilters((s) => ({ ...s, rol: e.target.value }))}>
                <option value="">Todos</option>
                <option value="superadmin">superadmin</option>
                <option value="admin">admin</option>
                <option value="empleado">empleado</option>
                <option value="cliente">cliente</option>
              </select>
            </label>
          )}
          <label>
            Estado
            <select value={filters.activo} onChange={(e) => setFilters((s) => ({ ...s, activo: e.target.value }))}>
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
          </label>
          <button className="btn btn-ghost" style={{ alignSelf: 'flex-end', height: '38px' }} onClick={() => loadUsers().catch((e) => setError(e.message))}>Filtrar</button>
        </div>

        <div className="table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
          <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                <th style={{ padding: '14px' }}>Email</th>
                <th style={{ padding: '14px' }}>Rol</th>
                {isSuper && <th style={{ padding: '14px' }}>Tienda</th>}
                <th style={{ padding: '14px' }}>Estado</th>
                <th style={{ padding: '14px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id_usuario}>
                  <td style={{ padding: '14px', fontWeight: '600', color: '#1f2937' }}>{u.email}</td>
                  <td style={{ padding: '14px' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      background: u.rol === 'superadmin' ? '#fee2e2' : u.rol === 'admin' ? '#e0e7ff' : '#f3f4f6',
                      color: u.rol === 'superadmin' ? '#991b1b' : u.rol === 'admin' ? '#3730a3' : '#374151'
                    }}>
                      {u.rol}
                    </span>
                  </td>
                  {isSuper && <td style={{ padding: '14px', color: '#6b7280' }}>{storeMap.get(u.id_tienda) || u.id_tienda}</td>}
                  <td style={{ padding: '14px' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      background: u.activo ? '#d1fae5' : '#fee2e2',
                      color: u.activo ? '#065f46' : '#991b1b'
                    }}>
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="actions-cell" style={{ padding: '14px' }}>
                    <button className="btn btn-ghost" onClick={() => setEditing({ ...u })}>Editar</button>
                    <button className={`btn ${u.activo ? 'btn-danger-ghost' : 'btn-success-ghost'}`} onClick={async () => {
                      try {
                        await api.adminUpdateUser(u.id_usuario, { activo: !u.activo });
                        await loadUsers();
                      } catch (e) {
                        setError(e.message);
                      }
                    }}>
                      {u.activo ? "Desactivar" : "Activar"}
                    </button>
                    <button className="btn btn-ghost" onClick={async () => {
                      const p = window.prompt(`Nueva password para ${u.email}`);
                      if (!p) return;
                      try {
                        await api.adminResetPassword(u.id_usuario, p);
                        alert("Contraseña restablecida con éxito.");
                      } catch (e) {
                        setError(e.message);
                      }
                    }}>
                      Reset password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editing ? (
          <div className="inline-editor">
            <h4>Editar usuario</h4>
            <div className="grid-form">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'start' }}>
                <label>Email<input type="email" value={editing.email || ""} onChange={(e) => setEditing((s) => ({ ...s, email: e.target.value }))} /></label>
                {isSuper ? (
                  <label>
                    Rol
                    <select value={editing.rol || "admin"} onChange={(e) => setEditing((s) => ({ ...s, rol: e.target.value }))}>
                      <option value="superadmin">superadmin</option>
                      <option value="admin">admin</option>
                      <option value="empleado">empleado</option>
                      <option value="cliente">cliente</option>
                    </select>
                  </label>
                ) : (
                  <label>Rol<input value="empleado" disabled style={{ background: '#f3f4f6' }} /></label>
                )}
                {isSuper && (
                  <StoreRefPicker
                    stores={stores}
                    value={editing.id_tienda}
                    onChange={(v) => setEditing((s) => ({ ...s, id_tienda: v }))}
                    required
                    label="Tienda"
                    placeholder="Buscar tienda..."
                    helpText="Selecciona la tienda del usuario."
                  />
                )}
              </div>
              <label className="check-row" style={{ marginTop: '8px' }}>
                <input type="checkbox" checked={!!editing.activo} onChange={(e) => setEditing((s) => ({ ...s, activo: e.target.checked }))} />
                Usuario Activo (Permitir acceso)
              </label>
              <div className="row" style={{ marginTop: '10px' }}>
                <button className="btn btn-primary" onClick={async () => {
                  try {
                    await api.adminUpdateUser(editing.id_usuario, {
                      email: editing.email,
                      rol: isSuper ? editing.rol : "empleado",
                      id_tienda: isSuper ? editing.id_tienda : user.id_tienda,
                      activo: editing.activo
                    });
                    setEditing(null);
                    await loadUsers();
                  } catch (e) {
                    setError(e.message);
                  }
                }}>
                  Guardar Cambios
                </button>
                <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>
              </div>
            </div>
          </div>
        ) : null}
      </Card>

      <Card title={isSuper ? "Crear usuario" : "Registrar Empleado"}>
        <form className="grid-form" onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api.adminCreateUser(form);
            setForm((s) => ({
              ...s,
              email: "",
              password: ""
            }));
            await loadUsers();
          } catch (err) {
            setError(err.message);
          }
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'start' }}>
            {isSuper ? (
              <StoreRefPicker
                stores={stores}
                value={form.id_tienda}
                onChange={(v) => setForm((s) => ({ ...s, id_tienda: v }))}
                required
                label="Tienda Destino"
                placeholder="Buscar tienda..."
                helpText="Asigna usuario a la tienda destino."
              />
            ) : null}
            <label>Email<input type="email" placeholder="Ej. empleado@tienda.com" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} required /></label>
            <div>
              <label>Password<input type="password" placeholder="Contraseña segura" value={form.password} onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))} required /></label>
              <HelperText text="Minimo 6 caracteres." />
            </div>
            {isSuper ? (
              <label>
                Rol
                <select value={form.rol} onChange={(e) => setForm((s) => ({ ...s, rol: e.target.value }))}>
                  <option value="admin">admin</option>
                  <option value="empleado">empleado</option>
                </select>
              </label>
            ) : null}
          </div>
          <label className="check-row" style={{ marginTop: '10px' }}>
            <input type="checkbox" checked={form.activo} onChange={(e) => setForm((s) => ({ ...s, activo: e.target.checked }))} />
            Usuario Activo (Permitir acceso)
          </label>
          <button className="btn btn-primary" style={{ alignSelf: 'flex-start', padding: '12px 24px' }}>
            {isSuper ? "Crear usuario" : "Registrar Empleado"}
          </button>
        </form>
      </Card>
    </div>
  );
}
