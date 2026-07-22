import { buildAssetUrl } from './api';

export function getImageSrc(imagenUrl) {
  if (!imagenUrl) return "";
  if (/^https?:\/\//i.test(imagenUrl)) return imagenUrl;
  return buildAssetUrl(imagenUrl);
}

export function toInputDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export function createOfferFormState(offer = null) {
  return {
    nombre: offer?.nombre || "",
    tipo: offer?.tipo || "PERCENT",
    porcentaje: offer?.porcentaje ?? "",
    prioridad: offer?.prioridad ?? 0,
    activa: offer?.activa ?? true,
    fecha_inicio: toInputDateTime(offer?.fecha_inicio),
    fecha_fin: toInputDateTime(offer?.fecha_fin),
    badge_text: offer?.badge_text || "",
  };
}

export function normalizeOfferPayload(form) {
  return {
    nombre: form.nombre.trim(),
    tipo: form.tipo,
    porcentaje: form.tipo === "PERCENT" ? Number(form.porcentaje || 0) : null,
    prioridad: Number(form.prioridad || 0),
    activa: Boolean(form.activa),
    fecha_inicio: form.fecha_inicio || null,
    fecha_fin: form.fecha_fin || null,
    badge_text: form.badge_text.trim() || null,
  };
}

export function formatOfferValue(offer) {
  if (offer.tipo === "PERCENT") {
    return `${offer.porcentaje ?? 0}%`;
  }
  return "Por producto";
}
