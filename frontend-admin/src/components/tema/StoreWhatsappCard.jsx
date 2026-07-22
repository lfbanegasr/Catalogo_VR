import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { Card, HelperText } from '../Card';

export default function StoreWhatsappCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [store, setStore] = useState(null);
  const [whatsapp, setWhatsapp] = useState("");

  const loadStore = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.adminGetMyStore();
      setStore(data);
      setWhatsapp(data.whatsapp_number || "");
    } catch (err) {
      setError(err.message || "No se pudo cargar la tienda");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStore();
  }, []);

  return (
    <Card title="WhatsApp de la tienda">
      {loading ? <p className="muted">Cargando...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {store ? <p className="muted small">{store.nombre_tienda} ({store.slug})</p> : null}
      <form className="grid-form" onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        setError("");
        setOk("");
        try {
          const updated = await api.adminUpdateMyStore({ whatsapp_number: whatsapp || null });
          setStore(updated);
          setWhatsapp(updated.whatsapp_number || "");
          setOk("Numero de WhatsApp actualizado");
        } catch (err) {
          setError(err.message || "No se pudo guardar");
        } finally {
          setSaving(false);
        }
      }}>
        <label>
          Numero de WhatsApp
          <input
            value={whatsapp}
            autoComplete="off"
            placeholder="+51999999999"
            onChange={(event) => setWhatsapp(event.target.value)}
          />
        </label>
        <HelperText text="Usa formato internacional con codigo de pais." />
        {ok ? <p className="ok-text">{ok}</p> : null}
        <button className="btn btn-primary" disabled={saving}>{saving ? "Guardando..." : "Guardar WhatsApp"}</button>
      </form>
    </Card>
  );
}
