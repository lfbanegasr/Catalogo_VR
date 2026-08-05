import { useEffect, useMemo, useState } from "react";
import { getPublicOrderTracking } from "../api/api";

const STATUS_LABELS = {
  generada_whatsapp: "Pedido recibido",
  pendiente: "Pedido recibido",
  confirmada: "Confirmado",
  preparando: "En preparacion",
  lista: "Listo",
  enviada: "En camino",
  completada: "Entregado",
  cancelada: "Cancelado",
};

const STATUS_ORDER = [
  "pendiente",
  "confirmada",
  "preparando",
  "lista",
  "enviada",
  "completada",
];

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-BO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatPrice(value) {
  return new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
  }).format(Number(value || 0)).replace("BOB", "Bs.");
}

export default function OrderTrackingPage({ slug, trackingCode, onBack }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    getPublicOrderTracking(slug, trackingCode)
      .then(setOrder)
      .catch((requestError) => setError(requestError.message || "No se encontro el pedido."))
      .finally(() => setLoading(false));
  }, [slug, trackingCode]);

  const currentStep = useMemo(() => {
    if (!order) return 0;
    if (order.estado === "generada_whatsapp") return 0;
    return Math.max(0, STATUS_ORDER.indexOf(order.estado));
  }, [order]);

  return (
    <main className="page-shell">
      <div className="container tracking-container">
        <button className="btn btn-ghost back-btn" type="button" onClick={onBack}>
          Volver al catalogo
        </button>
        <section className="panel tracking-panel">
          <p className="detail-store">Seguimiento del pedido</p>
          <h1 className="detail-title">#{trackingCode}</h1>

          {loading ? <p className="muted">Consultando el estado...</p> : null}
          {error ? <p className="form-error" role="alert">{error}</p> : null}

          {order ? (
            <>
              <div className={"tracking-current " + (order.estado === "cancelada" ? "cancelled" : "")}>
                <span>Estado actual</span>
                <strong>{STATUS_LABELS[order.estado] || order.estado}</strong>
                <small>Actualizado {formatDate(order.fecha_actualizacion)}</small>
              </div>

              {order.estado !== "cancelada" ? (
                <ol className="tracking-steps">
                  {STATUS_ORDER
                    .filter((status) => order.metodo_entrega === "delivery" || status !== "enviada")
                    .map((status, index) => (
                      <li key={status} className={index <= currentStep ? "complete" : ""}>
                        <span aria-hidden="true">{index <= currentStep ? "?" : index + 1}</span>
                        <p>{STATUS_LABELS[status]}</p>
                      </li>
                    ))}
                </ol>
              ) : null}

              <div className="tracking-summary">
                <div>
                  <span>Entrega</span>
                  <strong>{order.metodo_entrega === "delivery" ? "Delivery" : "Retiro en tienda"}</strong>
                </div>
                <div>
                  <span>Total</span>
                  <strong>{formatPrice(order.total_venta)}</strong>
                </div>
              </div>

              <div className="detail-block">
                <h2 className="detail-subtitle">Productos</h2>
                <ul className="tracking-products">
                  {order.productos.map((item, index) => (
                    <li key={item.nombre + String(index)}>
                      <span>{item.cantidad} x {item.nombre}</span>
                      {item.variante ? <small>{item.variante}</small> : null}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="detail-block">
                <h2 className="detail-subtitle">Historial</h2>
                <ol className="tracking-history">
                  {[...order.historial].reverse().map((event, index) => (
                    <li key={event.fecha_evento + String(index)}>
                      <strong>{STATUS_LABELS[event.estado_nuevo] || event.estado_nuevo}</strong>
                      <span>{formatDate(event.fecha_evento)}</span>
                      {event.nota ? <p>{event.nota}</p> : null}
                    </li>
                  ))}
                </ol>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
