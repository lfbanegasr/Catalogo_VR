export const TEMPLATE_OPTIONS = [
  {
    id: "minimal",
    name: "Minimalista",
    description: "Cuadrícula limpia, tarjetas suaves y lectura rápida.",
    defaults: { products_per_page: 4, background_style: "gradient", image_shape: "rounded", price_style: "pill" },
  },
  {
    id: "organic",
    name: "Orgánico",
    description: "Círculos, formas suaves y precios tipo medallón.",
    defaults: { products_per_page: 3, background_style: "organic", image_shape: "circle", price_style: "circle" },
  },
  {
    id: "editorial",
    name: "Editorial",
    description: "Un producto protagonista y composiciones asimétricas.",
    defaults: { products_per_page: 3, background_style: "editorial", image_shape: "square", image_fit: "cover", price_style: "block" },
  },
  {
    id: "photographic",
    name: "Fotográfico",
    description: "Conserva imágenes completas y superpone la información.",
    defaults: { products_per_page: 4, background_style: "solid", image_shape: "rounded", image_fit: "contain", price_style: "pill" },
  },
];


export const DEFAULT_OPTIONS = {
  include_descendants: true,
  include_uncategorized: true,
  only_active_products: true,
  show_cover: true,
  show_description: false,
  show_attributes: false,
  template: "minimal",
  products_per_page: 4,
  sort_by: "name",
  title: "Catálogo de productos",
  subtitle: "",
  primary_color: "#9E4B63",
  secondary_color: "#D8A9B6",
  background_color: "#F8F5F2",
  gradient_end_color: "#F1E4E8",
  text_color: "#2D2630",
  muted_color: "#746A75",
  price_color: "#9E4B63",
  background_style: "gradient",
  decorative_intensity: "balanced",
  price_style: "pill",
  image_shape: "auto",
  image_fit: "auto",
  cover_url: null,
  cover_fit: "cover",
  cover_text_overlay: false,
  smart_layout: true,
  smart_image_analysis: true,
  use_florence: false,
  enable_background_removal: false,
  product_overrides: [],
  page_overrides: [],
};


export function categoryLabels(categories) {
  const byId = new Map(categories.map((item) => [String(item.id_categoria), item]));
  return categories.map((category) => {
    const names = [category.nombre];
    const visited = new Set([String(category.id_categoria)]);
    let parentId = category.id_categoria_padre ? String(category.id_categoria_padre) : "";
    while (parentId && byId.has(parentId) && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = byId.get(parentId);
      names.unshift(parent.nombre);
      parentId = parent.id_categoria_padre ? String(parent.id_categoria_padre) : "";
    }
    return { ...category, label: names.join(" / ") };
  });
}


export function storePdfDefaults(store, current) {
  const theme = store?.theme_config || {};
  const savedPdf = theme.catalog_pdf || {};
  return {
    ...current,
    subtitle: store?.nombre_tienda || "",
    primary_color: theme.primary || current.primary_color,
    secondary_color: theme.secondary || current.secondary_color,
    background_color: theme.background || current.background_color,
    text_color: theme.text || current.text_color,
    muted_color: theme.muted || current.muted_color,
    cover_url: savedPdf.cover_url || null,
  };
}
