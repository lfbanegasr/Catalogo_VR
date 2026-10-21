import React, { useState, useEffect } from 'react';
import { api } from '../../api';

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
    <div className="theme-panel-card">
      <div className="theme-card-header">
        <h3>Configuración General y Moneda</h3>
        <p>Número de WhatsApp para pedidos y símbolo de moneda mostrado al cliente.</p>
        {store ? <span style={{ fontSize: "0.82rem", color: "var(--brand-primary)", fontWeight: 600 }}>{store.nombre_tienda} ({store.slug})</span> : null}
      </div>

      {loading ? <p style={{ color: "var(--text-muted)" }}>Cargando datos...</p> : null}
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {ok ? <div className="alert alert-success">{ok}</div> : null}

      <form 
        onSubmit={async (event) => {
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
        }}
        style={{ display: "flex", flexDirection: "column", gap: "16px" }}
      >
        <label>
          <span style={{ display: "block", marginBottom: "6px", fontSize: "0.86rem", fontWeight: 600 }}>
            Número de WhatsApp Comercial
          </span>
          <input
            value={whatsapp}
            autoComplete="off"
            placeholder="+591 70000000 o +51 999999999"
            onChange={(event) => setWhatsapp(event.target.value)}
          />
          <small style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginTop: "4px", display: "block" }}>
            Usa formato internacional con código de país (ej. +591 o +51).
          </small>
        </label>

        <label>
          <span style={{ display: "block", marginBottom: "6px", fontSize: "0.86rem", fontWeight: 600 }}>
            Símbolo de Moneda (ej. Bs, S/, $, USD)
          </span>
          <input
            value={currencySymbol}
            autoComplete="off"
            placeholder="Bs"
            maxLength={10}
            onChange={(event) => setCurrencySymbol(event.target.value)}
            required
          />
          <small style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginTop: "4px", display: "block" }}>
            Símbolo que se mostrará en los precios de los productos y pedidos.
          </small>
        </label>

        <button 
          className="btn btn-primary" 
          style={{ alignSelf: "flex-start", marginTop: "8px" }} 
          disabled={saving}
        >
          {saving ? "Guardando..." : "Guardar Configuración General"}
        </button>
      </form>
    </div>
  );
}
