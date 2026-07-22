import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { Card, HelperText } from '../Card';

export default function TiendasScreen() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ nombre_tienda: "", slug: "", whatsapp_number: "", dominio_personalizado: "", activa: true });
  const [editing, setEditing] = useState(null);

  const load = async () => setRows(await api.adminListTiendas());
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  return (
    <div className="stack">
      <Card title="Tiendas">
        {error ? <p className="error-text">{error}</p> : null}
        <div className="table-wrap"><table><thead><tr><th>Nombre</th><th>Slug</th><th>WhatsApp</th><th>Activa</th><th>Acciones</th></tr></thead><tbody>
          {rows.map((r) => <tr key={r.id_tienda}><td>{r.nombre_tienda}</td><td>{r.slug}</td><td>{r.whatsapp_number || "-"}</td><td>{r.activa ? "Si" : "No"}</td><td className="actions-cell">
            <button className="btn btn-ghost" onClick={() => setEditing({ ...r })}>Editar</button>
            <button className="btn btn-ghost" onClick={async () => { try { await api.adminUpdateTienda(r.id_tienda, { activa: !r.activa }); await load(); } catch (e) { setError(e.message); } }}>{r.activa ? "Desactivar" : "Activar"}</button>
          </td></tr>)}
        </tbody></table></div>

        {editing ? <div className="inline-editor"><h4>Editar tienda</h4><div className="grid-form">
          <label>Nombre<input value={editing.nombre_tienda || ""} onChange={(e) => setEditing((s) => ({ ...s, nombre_tienda: e.target.value }))} /></label>
          <label>Slug<input value={editing.slug || ""} onChange={(e) => setEditing((s) => ({ ...s, slug: e.target.value }))} /></label>
          <label>WhatsApp<input value={editing.whatsapp_number || ""} onChange={(e) => setEditing((s) => ({ ...s, whatsapp_number: e.target.value }))} /></label>
          <label>Dominio<input value={editing.dominio_personalizado || ""} onChange={(e) => setEditing((s) => ({ ...s, dominio_personalizado: e.target.value }))} /></label>
          <label className="check-row"><input type="checkbox" checked={!!editing.activa} onChange={(e) => setEditing((s) => ({ ...s, activa: e.target.checked }))} />Activa</label>
          <div className="row"><button className="btn btn-primary" onClick={async () => { try { await api.adminUpdateTienda(editing.id_tienda, editing); setEditing(null); await load(); } catch (e) { setError(e.message); } }}>Guardar</button><button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancelar</button></div>
        </div></div> : null}
      </Card>

      <Card title="Crear tienda">
        <form className="grid-form" onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api.adminCreateTienda({ ...form, slug: form.slug || null, whatsapp_number: form.whatsapp_number || null, dominio_personalizado: form.dominio_personalizado || null });
            setForm({ nombre_tienda: "", slug: "", whatsapp_number: "", dominio_personalizado: "", activa: true });
            await load();
          } catch (err) { setError(err.message); }
        }}>
          <label>Nombre<input value={form.nombre_tienda} onChange={(e) => setForm((s) => ({ ...s, nombre_tienda: e.target.value }))} required /></label>
          <HelperText text="Nombre visible del negocio." />
          <label>Slug<input value={form.slug} onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))} /></label>
          <HelperText text="Opcional. Si se omite, se genera automáticamente." />
          <label>WhatsApp<input value={form.whatsapp_number} onChange={(e) => setForm((s) => ({ ...s, whatsapp_number: e.target.value }))} /></label>
          <label>Dominio<input value={form.dominio_personalizado} onChange={(e) => setForm((s) => ({ ...s, dominio_personalizado: e.target.value }))} /></label>
          <label className="check-row"><input type="checkbox" checked={form.activa} onChange={(e) => setForm((s) => ({ ...s, activa: e.target.checked }))} />Activa</label>
          <button className="btn btn-primary">Crear tienda</button>
        </form>
      </Card>
    </div>
  );
}
