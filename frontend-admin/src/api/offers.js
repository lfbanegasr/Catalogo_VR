import { request } from "../api.js";

function offerPath(path, tenantId) {
  if (!tenantId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}id_tienda=${encodeURIComponent(tenantId)}`;
}

export const offersApi = {
  list: ({ tenantId } = {}) =>
    request(offerPath("/catalog/offers", tenantId)),
  create: (payload, { tenantId } = {}) =>
    request(offerPath("/catalog/offers", tenantId), {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (idOferta, payload, { tenantId } = {}) =>
    request(offerPath(`/catalog/offers/${idOferta}`, tenantId), {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  listProducts: (idOferta, { tenantId } = {}) =>
    request(offerPath(`/catalog/offers/${idOferta}/products`, tenantId)),
  listCategories: (idOferta, { tenantId } = {}) =>
    request(offerPath(`/catalog/offers/${idOferta}/categories`, tenantId)),
  attachProducts: (idOferta, payload, { tenantId } = {}) =>
    request(offerPath(`/catalog/offers/${idOferta}/products`, tenantId), {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  attachCategories: (idOferta, payload, { tenantId } = {}) =>
    request(offerPath(`/catalog/offers/${idOferta}/categories`, tenantId), {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  detachProduct: (idOferta, idProducto, { tenantId } = {}) =>
    request(offerPath(`/catalog/offers/${idOferta}/products/${idProducto}`, tenantId), {
      method: "DELETE",
    }),
  detachCategory: (idOferta, idCategoria, { tenantId } = {}) =>
    request(offerPath(`/catalog/offers/${idOferta}/categories/${idCategoria}`, tenantId), {
      method: "DELETE",
    }),
  uploadBanner: (idOferta, file, { tenantId } = {}) => {
    const form = new FormData();
    form.append("file", file);
    return request(offerPath(`/catalog/offers/${idOferta}/banner`, tenantId), {
      method: "POST",
      body: form,
    });
  },
};
