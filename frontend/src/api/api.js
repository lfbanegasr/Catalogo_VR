const BASE_URL = "/api";
const DEFAULT_DEV_API_BASE = "http://127.0.0.1:8000";
const ENV_API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");
const DEFAULT_THEME_ID = "modern_banner";
const DEFAULT_THEME_CONFIG = {
  primary: "#E94B8A",
  secondary: "#F8BBD0",
  background: "#FFF7FA",
  text: "#1F1F1F",
  muted: "#6B7280",
  radius: 16,
  hero_image_url: "",
  category_images: {},
  show_offers: true,
  show_featured: true,
  category_style: "round_icons",
  font_scale: "md",
};

function prettifySlug(slug = "") {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { cache: "no-store", ...options });

  if (!response.ok) {
    let message = `Error ${response.status}`;
    try {
      const data = await response.json();
      if (data?.detail) {
        message = Array.isArray(data.detail)
          ? data.detail[0]?.msg || message
          : data.detail;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return response.json();
}

function normalizeCategory(item) {
  if (!item) return null;
  const rawId = item.id ?? item.id_categoria ?? item.uuid ?? item.value ?? "";

  return {
    id: rawId ? String(rawId) : "",
    nombre: item.nombre || item.name || "Sin categoria",
  };
}

function normalizeProduct(item) {
  if (!item) return null;

  const rawId = item.id ?? item.id_producto ?? "";
  const rawCategoriaId =
    item.categoria_id ?? item.id_categoria ?? item.categoryId ?? null;
  const nombre = item.nombre || item.name || "Producto sin nombre";
  const descripcion = item.descripcion || item.description || "";
  const precio = Number(item.precio ?? item.precio_venta ?? item.price ?? 0);
  const precioOriginal = Number(
    item.precio_original ?? item.original_price ?? item.precio ?? item.precio_venta ?? item.price ?? 0,
  );
  const precioFinal = Number(
    item.precio_final ?? item.final_price ?? item.precio ?? item.precio_venta ?? item.price ?? 0,
  );
  const descuentoPct =
    item.descuento_pct == null ? null : Number(item.descuento_pct);
  const stockValue =
    item.stock ??
    item.stock_actual ??
    item.stockAvailable ??
    item.disponible ??
    null;
  let imagenUrl = item.imagen_url ?? item.imageUrl ?? "";
  const imagenesRaw = Array.isArray(item.imagenes)
    ? item.imagenes
    : Array.isArray(item.images)
      ? item.images
      : [];
  const imagenes = imagenesRaw.filter(Boolean).map((url) => String(url));
  if (!imagenUrl && imagenes[0]) {
    imagenUrl = imagenes[0];
  }
  if (imagenUrl && !imagenes.includes(imagenUrl)) {
    imagenes.unshift(imagenUrl);
  }

  return {
    id: rawId ? String(rawId) : "",
    nombre,
    descripcion,
    precio,
    precio_original: precioOriginal,
    precio_final: precioFinal,
    descuento_pct: Number.isFinite(descuentoPct) ? descuentoPct : null,
    badge_text: item.badge_text || null,
    id_oferta_aplicada: item.id_oferta_aplicada || null,
    stock: stockValue == null ? null : Number(stockValue),
    categoria_id: rawCategoriaId == null ? null : String(rawCategoriaId),
    imagen_url: imagenUrl || "",
    imagenes,
    // aliases de compatibilidad temporal
    name: nombre,
    description: descripcion,
    price: precio,
    originalPrice: precioOriginal,
    finalPrice: precioFinal,
    discountPct: Number.isFinite(descuentoPct) ? descuentoPct : null,
    badgeText: item.badge_text || null,
    imageUrl: imagenUrl || "",
    images: imagenes,
    categoryId: rawCategoriaId == null ? null : String(rawCategoriaId),
  };
}

function normalizeOffer(item) {
  if (!item) return null;
  const rawId = item.id_oferta ?? item.id ?? "";
  return {
    id_oferta: rawId ? String(rawId) : "",
    nombre: item.nombre || "Oferta",
    tipo: item.tipo || "PERCENT",
    porcentaje: item.porcentaje == null ? null : Number(item.porcentaje),
    prioridad: Number(item.prioridad || 0),
    fecha_inicio: item.fecha_inicio || null,
    fecha_fin: item.fecha_fin || null,
    banner_url: item.banner_url || "",
    badge_text: item.badge_text || null,
  };
}

function extractStoreName(payload, slug) {
  return (
    payload?.storeName ||
    payload?.nombre_tienda ||
    payload?.nombre ||
    payload?.tienda?.nombre_tienda ||
    payload?.tienda?.nombre ||
    prettifySlug(slug)
  );
}

function normalizeThemeConfig(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  return {
    ...DEFAULT_THEME_CONFIG,
    ...source,
    radius: Number(source.radius ?? DEFAULT_THEME_CONFIG.radius),
    category_images:
      source.category_images && typeof source.category_images === "object"
        ? source.category_images
        : {},
    show_offers: source.show_offers ?? DEFAULT_THEME_CONFIG.show_offers,
    show_featured: source.show_featured ?? DEFAULT_THEME_CONFIG.show_featured,
    category_style:
      source.category_style === "round_icons" ? "round_icons" : "chips",
    font_scale:
      source.font_scale === "sm" || source.font_scale === "lg"
        ? source.font_scale
        : "md",
  };
}

function extractTheme(payload) {
  const rawThemeId =
    payload?.tienda?.theme_id ||
    payload?.theme_id ||
    payload?.theme?.id ||
    DEFAULT_THEME_ID;
  const themeId = String(rawThemeId || DEFAULT_THEME_ID);
  const rawThemeConfig =
    payload?.tienda?.theme_config ||
    payload?.theme_config ||
    payload?.theme ||
    payload?.tema ||
    payload?.colors ||
    payload?.colores ||
    {};

  return {
    theme_id: themeId,
    theme_config: normalizeThemeConfig(rawThemeConfig),
  };
}

function extractWhatsappNumber(payload) {
  return (
    payload?.whatsapp_number ||
    payload?.tienda?.whatsapp_number ||
    payload?.store?.whatsapp_number ||
    null
  );
}

function normalizeCatalogPayload(payload, slug) {
  const rawCategories = Array.isArray(payload?.categories)
    ? payload.categories
    : Array.isArray(payload?.categorias)
      ? payload.categorias
      : [];

  const rawProducts = Array.isArray(payload?.products)
    ? payload.products
    : Array.isArray(payload?.productos)
      ? payload.productos
      : [];
  const rawOffers = Array.isArray(payload?.offers)
    ? payload.offers
    : Array.isArray(payload?.ofertas)
      ? payload.ofertas
      : [];

  return {
    storeName: extractStoreName(payload, slug),
    whatsappNumber: extractWhatsappNumber(payload),
    categories: rawCategories.map(normalizeCategory).filter((x) => x && x.id),
    products: rawProducts.map(normalizeProduct).filter((x) => x && x.id),
    offers: rawOffers.map(normalizeOffer).filter((x) => x && x.id_oferta),
    theme: extractTheme(payload),
    tienda: payload?.tienda || null,
  };
}

async function fetchCombinedCatalog(slug) {
  const payload = await fetchJson(`${BASE_URL}/public/catalog/${slug}`);
  return normalizeCatalogPayload(payload, slug);
}

async function fetchFallbackCatalog(slug) {
  const [categories, products] = await Promise.all([
    fetchJson(`${BASE_URL}/public/catalog/${slug}/categories`),
    fetchJson(`${BASE_URL}/public/catalog/${slug}/products?limit=100&offset=0`),
  ]);

  return {
    storeName: prettifySlug(slug),
    whatsappNumber: null,
    categories: (Array.isArray(categories) ? categories : [])
      .map(normalizeCategory)
      .filter((x) => x && x.id),
    products: (Array.isArray(products) ? products : [])
      .map(normalizeProduct)
      .filter((x) => x && x.id),
    offers: [],
    theme: {
      theme_id: DEFAULT_THEME_ID,
      theme_config: { ...DEFAULT_THEME_CONFIG },
    },
    tienda: null,
  };
}

export async function getPublicCatalog(slug) {
  try {
    return await fetchCombinedCatalog(slug);
  } catch (error) {
    if (String(error.message || "").includes("404")) {
      return fetchFallbackCatalog(slug);
    }
    throw error;
  }
}

export async function registerPublicWhatsappClick(slug, idProducto) {
  try {
    await fetchJson(`${BASE_URL}/public/catalog/${slug}/whatsapp-click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_producto: idProducto || null }),
    });
  } catch {
    // fire-and-forget: no bloquear UX de compra
  }
}

export function buildAssetUrl(path) {
  if (!path) return "https://placehold.co/600x400/e2e8f0/475569?text=Sin+Imagen";
  if (/^https?:\/\//i.test(path)) return path;
  if (/^(data|blob):/i.test(path)) return path;

  const base = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");
  const cleanPath = String(path).startsWith("/") ? path : `/${path}`;

  // Never build images using Vercel domains
  if (base && !base.includes("vercel.app")) {
    return `${base}${cleanPath}`;
  }

  // Fallback depending on production or development environment
  const isProd = import.meta.env.PROD;
  const apiBase = isProd
    ? "https://catalogovr-production.up.railway.app"
    : "http://127.0.0.1:8000";

  return `${apiBase}${cleanPath}`;
}

export { BASE_URL, DEFAULT_THEME_ID, DEFAULT_THEME_CONFIG };
