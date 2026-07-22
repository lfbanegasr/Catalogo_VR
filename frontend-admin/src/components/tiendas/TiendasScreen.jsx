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
      <Card title="Lista de tiendas registradas">
        {error ? <p className="error-text">{error}</p> : null}
        <div className="table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
          <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead><tr><th style={{ padding: '14px' }}>Nombre</th><th style={{ padding: '14px' }}>Slug</th><th style={{ padding: '14px' }}>WhatsApp</th><th style={{ padding: '14px' }}>Estado</th><th style={{ padding: '14px' }}>Acciones</th></tr></thead>
            <tbody>
              {rows.map((r) => <tr key={r.id_tienda}>
                <td style={{ padding: '14px', fontWeight: '600', color: '#1f2937' }}>{r.nombre_tienda}</td>
                <td style={{ padding: '14px', color: '#6b7280' }}>{r.slug}</td>
                <td style={{ padding: '14px' }}>{r.whatsapp_number || "-"}</td>
                <td style={{ padding: '14px' }}>
                  <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', background: r.activa ? '#d1fae5' : '#fee2e2', color: r.activa ? '#065f46' : '#991b1b' }}>
                    {r.activa ? "Activa" : "Inactiva"}
                  </span>
                </td>
                <td className="actions-cell" style={{ padding: '14px' }}>
                  <button className="btn btn-ghost" onClick={() => setEditing({ ...r })}>Editar</button>
                  <button className={`btn ${r.activa ? 'btn-danger-ghost' : 'btn-success-ghost'}`} onClick={async () => { try { await api.adminUpdateTienda(r.id_tienda, { activa: !r.activa }); await load(); } catch (e) { setError(e.message); } }}>{r.activa ? "Desactivar" : "Activar"}</button>
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>

        {editing ? <div className="inline-editor"><h4>Editar tienda</h4>
          <div className="grid-form">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <label>Nombre<input value={editing.nombre_tienda || ""} onChange={(e) => setEditing((s) => ({ ...s, nombre_tienda: e.target.value }))} /></label>
              <label>Slug<input value={editing.slug || ""} onChange={(e) => setEditing((s) => ({ ...s, slug: e.target.value }))} /></label>
              <label>WhatsApp<input value={editing.whatsapp_number || ""} onChange={(e) => setEditing((s) => ({ ...s, whatsapp_number: e.target.value }))} /></label>
              <label>Dominio<input value={editing.dominio_personalizado || ""} onChange={(e) => setEditing((s) => ({ ...s, dominio_personalizado: e.target.value }))} /></label>
            </div>
            <label className="check-row"><input type="checkbox" checked={!!editing.activa} onChange={(e) => setEditing((s) => ({ ...s, activa: e.target.checked }))} />Tienda Activa (Visible)</label>
            <div className="row" style={{ marginTop: '10px' }}><button className="btn btn-primary" onClick={async () => { try { await api.adminUpdateTienda(editing.id_tienda, editing); setEditing(null); await load(); } catch (e) { setError(e.message); } }}>Guardar Cambios</button><button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancelar</button></div>
          </div>
        </div> : null}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <label>Nombre<input value={form.nombre_tienda} onChange={(e) => setForm((s) => ({ ...s, nombre_tienda: e.target.value }))} required placeholder="Ej. Mi Negocio" /></label>
              <HelperText text="Nombre visible del negocio." />
            </div>
            <div>
              <label>Slug<input value={form.slug} onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))} placeholder="ej. mi-negocio" /></label>
              <HelperText text="Opcional. Si se omite, se genera automáticamente." />
            </div>
            <label>WhatsApp<input placeholder="Ej. +591..." value={form.whatsapp_number} onChange={(e) => setForm((s) => ({ ...s, whatsapp_number: e.target.value }))} /></label>
            <label>Dominio<input placeholder="Ej. mi-tienda.com" value={form.dominio_personalizado} onChange={(e) => setForm((s) => ({ ...s, dominio_personalizado: e.target.value }))} /></label>
          </div>
          <label className="check-row" style={{ marginTop: '10px' }}><input type="checkbox" checked={form.activa} onChange={(e) => setForm((s) => ({ ...s, activa: e.target.checked }))} />Tienda Activa (Visible al publico)</label>
          <button className="btn btn-primary" style={{ alignSelf: 'flex-start', padding: '12px 24px' }}>Crear tienda</button>
        </form>
      </Card>
    </div>
  );
}
