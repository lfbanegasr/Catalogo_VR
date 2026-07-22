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
      <Card title={isSuper ? "Usuarios del Sistema" : "Personal de la Tienda"}>
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

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Rol</th>
                {isSuper && <th>Tienda</th>}
                <th>Activo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id_usuario}>
                  <td>{u.email}</td>
                  <td>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '9px',
                      fontWeight: 'bold',
                      background: u.rol === 'superadmin' ? '#fee2e2' : u.rol === 'admin' ? '#e0e7ff' : '#f3f4f6',
                      color: u.rol === 'superadmin' ? '#991b1b' : u.rol === 'admin' ? '#3730a3' : '#374151'
                    }}>
                      {u.rol}
                    </span>
                  </td>
                  {isSuper && <td>{storeMap.get(u.id_tienda) || u.id_tienda}</td>}
                  <td>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '9px',
                      fontWeight: 'bold',
                      background: u.activo ? '#d1fae5' : '#fee2e2',
                      color: u.activo ? '#065f46' : '#991b1b'
                    }}>
                      {u.activo ? "Si" : "No"}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <button className="btn btn-ghost" onClick={() => setEditing({ ...u })}>Editar</button>
                    <button className="btn btn-ghost" onClick={async () => {
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
              <label>Email<input value={editing.email || ""} onChange={(e) => setEditing((s) => ({ ...s, email: e.target.value }))} /></label>
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
                <label>Rol<input value="empleado" disabled /></label>
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
              <label className="check-row">
                <input type="checkbox" checked={!!editing.activo} onChange={(e) => setEditing((s) => ({ ...s, activo: e.target.checked }))} />
                Activo
              </label>
              <div className="row">
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
                  Guardar
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
          {isSuper ? (
            <StoreRefPicker
              stores={stores}
              value={form.id_tienda}
              onChange={(v) => setForm((s) => ({ ...s, id_tienda: v }))}
              required
              label="Tienda"
              placeholder="Buscar tienda..."
              helpText="Asigna usuario a la tienda destino."
            />
          ) : null}
          <label>Email<input type="email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} required /></label>
          <label>Password<input type="password" value={form.password} onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))} required /></label>
          <HelperText text="Minimo 6 caracteres." />
          {isSuper ? (
            <label>
              Rol
              <select value={form.rol} onChange={(e) => setForm((s) => ({ ...s, rol: e.target.value }))}>
                <option value="admin">admin</option>
                <option value="empleado">empleado</option>
              </select>
            </label>
          ) : null}
          <label className="check-row"><input type="checkbox" checked={form.activo} onChange={(e) => setForm((s) => ({ ...s, activo: e.target.checked }))} />Activo</label>
          <button className="btn btn-primary">{isSuper ? "Crear usuario" : "Registrar Empleado"}</button>
        </form>
      </Card>
    </div>
  );
}
