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
  const [currencySymbol, setCurrencySymbol] = useState("S/");

  const loadStore = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.adminGetMyStore();
      setStore(data);
      setWhatsapp(data.whatsapp_number || "");
      setCurrencySymbol(data.currency_symbol || "S/");
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
    <Card title="Configuración General de la Tienda">
      {loading ? <p className="muted">Cargando...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {store ? <p className="muted small">{store.nombre_tienda} ({store.slug})</p> : null}
      <form className="grid-form" onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        setError("");
        setOk("");
        try {
          const updated = await api.adminUpdateMyStore({
            whatsapp_number: whatsapp || null,
            currency_symbol: currencySymbol || "S/"
          });
          setStore(updated);
          setWhatsapp(updated.whatsapp_number || "");
          setCurrencySymbol(updated.currency_symbol || "S/");
          setOk("Configuración general actualizada con éxito");
        } catch (err) {
          setError(err.message || "No se pudo guardar");
        } finally {
          setSaving(false);
        }
      }}>
        <label>
          Número de WhatsApp
          <input
            value={whatsapp}
            autoComplete="off"
            placeholder="+51999999999"
            onChange={(event) => setWhatsapp(event.target.value)}
          />
        </label>
        <HelperText text="Usa formato internacional con código de país." />

        <label style={{ marginTop: '14px' }}>
          Símbolo de Moneda (ej. Bs, S/, $, USD)
          <input
            value={currencySymbol}
            autoComplete="off"
            placeholder="Bs"
            maxLength={10}
            onChange={(event) => setCurrencySymbol(event.target.value)}
            required
          />
        </label>
        <HelperText text="Símbolo que se mostrará en los precios de los productos y pedidos." />

        {ok ? <p className="ok-text" style={{ marginTop: '10px' }}>{ok}</p> : null}
        <button className="btn btn-primary" style={{ marginTop: '14px' }} disabled={saving}>
          {saving ? "Guardando..." : "Guardar Configuración"}
        </button>
      </form>
    </Card>
  );
}
