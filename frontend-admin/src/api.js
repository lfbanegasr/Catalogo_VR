const TOKEN_KEY = "tienda_admin_token";
const DEFAULT_DEV_API_BASE = "http://127.0.0.1:8000";
const ENV_API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");
const API_BASE = ENV_API_BASE ? `${ENV_API_BASE}/api` : "/api";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers, cache: "no-store" });
  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const data = await res.json();
      message = data?.detail || message;
    } catch {
      // noop
    }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

function withQuery(path, params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, value);
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export function buildAssetUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const base =
    import.meta.env.PROD
      ? ENV_API_BASE
      : ENV_API_BASE || DEFAULT_DEV_API_BASE;
  if (!base) return path;
  if (!String(path).startsWith("/")) return `${base}/${path}`;
  return `${base}${path}`;
}

export const api = {
  login: (email, password) =>
    request("/auth/login-json", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  forgotPassword: (email) =>
    request("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token, newPassword) =>
    request("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, new_password: newPassword }),
    }),
  me: () => request("/me"),
  adminListTiendas: () => request("/admin/tiendas"),
  adminCreateTienda: (payload) =>
    request("/admin/tiendas", { method: "POST", body: JSON.stringify(payload) }),
  adminListUsers: (tiendaId) =>
    request(`/admin/users${tiendaId ? `?tienda=${encodeURIComponent(tiendaId)}` : ""}`),
  adminListUsersFiltered: ({ tienda, rol, activo } = {}) => {
    const params = new URLSearchParams();
    if (tienda) params.set("tienda", tienda);
    if (rol) params.set("rol", rol);
    if (typeof activo === "boolean") params.set("activo", String(activo));
    const q = params.toString();
    return request(`/admin/users${q ? `?${q}` : ""}`);
  },
  adminCreateUser: (payload) =>
    request("/admin/users", { method: "POST", body: JSON.stringify(payload) }),
  adminUpdateUser: (idUsuario, payload) =>
    request(`/admin/users/${idUsuario}`, { method: "PATCH", body: JSON.stringify(payload) }),
  adminResetPassword: (idUsuario, newPassword) =>
    request(`/admin/users/${idUsuario}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ new_password: newPassword }),
    }),
  adminUpdateTienda: (idTienda, payload) =>
    request(`/admin/tiendas/${idTienda}`, { method: "PATCH", body: JSON.stringify(payload) }),
  adminUpdateTiendaTheme: (idTienda, payload) =>
    request(`/admin/tiendas/${idTienda}/theme`, { method: "PATCH", body: JSON.stringify(payload) }),
  adminGetMyStore: () => request("/admin/my-store"),
  adminUpdateMyStore: (payload) =>
    request("/admin/my-store", { method: "PATCH", body: JSON.stringify(payload) }),
  meUpdateTheme: (payload) =>
    request("/me/theme", { method: "PATCH", body: JSON.stringify(payload) }),
  auditLogs: () => request("/admin/audit-logs?limit=50"),
  listProductos: (tiendaRef) =>
    request(`/catalog/products${tiendaRef ? `?tienda=${encodeURIComponent(tiendaRef)}` : ""}`),
  createProducto: (payload, tiendaRef) =>
    request(`/catalog/products${tiendaRef ? `?tienda=${encodeURIComponent(tiendaRef)}` : ""}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listCategorias: (tiendaRef) =>
    request(`/catalog/categories${tiendaRef ? `?tienda=${encodeURIComponent(tiendaRef)}` : ""}`),
  createCategoria: (payload, tiendaRef) =>
    request(`/catalog/categories${tiendaRef ? `?tienda=${encodeURIComponent(tiendaRef)}` : ""}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateCategoria: (idCategoria, payload, tiendaRef) =>
    request(`/catalog/categories/${idCategoria}${tiendaRef ? `?tienda=${encodeURIComponent(tiendaRef)}` : ""}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deactivateCategoria: (idCategoria, tiendaRef) =>
    request(`/catalog/categories/${idCategoria}${tiendaRef ? `?tienda=${encodeURIComponent(tiendaRef)}` : ""}`, { method: "DELETE" }),
  updateProducto: (idProducto, payload, tiendaRef) =>
    request(`/catalog/products/${idProducto}${tiendaRef ? `?tienda=${encodeURIComponent(tiendaRef)}` : ""}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deactivateProducto: (idProducto, tiendaRef) =>
    request(`/catalog/products/${idProducto}${tiendaRef ? `?tienda=${encodeURIComponent(tiendaRef)}` : ""}`, { method: "DELETE" }),
  uploadProductoImage: (idProducto, file) => {
    const form = new FormData();
    form.append("file", file);
    return request(`/catalog/products/${idProducto}/image`, { method: "POST", body: form });
  },
  uploadThemeBanner: (file, tiendaRef) => {
    const form = new FormData();
    form.append("file", file);
    const path = withQuery("/catalog/theme/banner", tiendaRef ? { tienda: tiendaRef } : {});
    return request(path, { method: "POST", body: form });
  },
  listVentas: (idTienda) =>
    request(withQuery("/sales/ventas", { id_tienda: idTienda })),
  getVenta: (idVenta, idTienda) =>
    request(withQuery(`/sales/ventas/${idVenta}`, { id_tienda: idTienda })),
  updateVentaEstado: (idVenta, estado, idTienda) =>
    request(withQuery(`/sales/ventas/${idVenta}/estado`, { id_tienda: idTienda }), {
      method: "PATCH",
      body: JSON.stringify({ estado }),
    }),
  createVentaDirecta: (payload, idTienda) =>
    request(withQuery("/sales/ventas", { id_tienda: idTienda }), {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getMetrics: (idTienda) =>
    request(withQuery("/sales/metrics", { id_tienda: idTienda })),
};
