import { createContext, useContext, useEffect, useMemo } from "react";
import { DEFAULT_THEME_CONFIG, DEFAULT_THEME_ID } from "../api/api";

const THEME_META = {
  luxe_minimal: {
    label: "Luxe Minimalist",
    badge: "Moda & Calzado",
    description: "Estilo Zara / Apple con fotos 3:4 verticales, tipografía refinada y máxima atención al producto.",
  },
  urban_street: {
    label: "Urban Streetwear",
    badge: "Sneakers & Street",
    description: "Fotos 4:5 verticales, alto contraste, badges dinámicos para drops y ropa urbana.",
  },
  tech_modern: {
    label: "Tech & Gadgets",
    badge: "Tecnología",
    description: "Banner Bento interactivo, fichas con especificaciones y stock visible en tiempo real.",
  },
  home_deco: {
    label: "Home & Scandinavian",
    badge: "Hogar & Muebles",
    description: "Tonos cálidos, fotos ambientadas en salas iluminadas y etiquetas de materiales nobles.",
  },
  gourmet_food: {
    label: "Gourmet & Delicatessen",
    badge: "Café & Gastronomía",
    description: "Fotos apaisadas apetecibles, etiquetas de ingredientes y botón directo a WhatsApp.",
  },
  modern_banner: {
    label: "Modern Banner",
    badge: "Clásico",
    description: "Banner superior, categorías redondas y bloques destacados.",
  },
  soft_beige: {
    label: "Soft Beige",
    badge: "Editorial",
    description: "Header limpio, tabs y layout editorial suave.",
  },
  minimal_clean: {
    label: "Minimal Clean",
    badge: "Compacto",
    description: "Catálogo básico, limpio y directo.",
  },
};

const ThemeContext = createContext({
  themeId: DEFAULT_THEME_ID,
  config: DEFAULT_THEME_CONFIG,
  meta: THEME_META[DEFAULT_THEME_ID] || THEME_META.modern_banner,
});

const FONT_SCALE_MAP = {
  sm: 0.94,
  md: 1,
  lg: 1.08,
};

function clampRadius(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_THEME_CONFIG.radius;
  return Math.max(6, Math.min(28, numeric));
}

function parseHexColor(value, fallback = { r: 255, g: 255, b: 255 }) {
  const match = String(value || "").trim().match(/^#([0-9a-f]{6})$/i);
  if (!match) return fallback;
  const number = Number.parseInt(match[1], 16);
  return { r: number >> 16, g: (number >> 8) & 255, b: number & 255 };
}

function colorBrightness(value) {
  const { r, g, b } = parseHexColor(value);
  return (r * 299 + g * 587 + b * 114) / 255000;
}

function blendHex(value, target, amount) {
  const source = parseHexColor(value);
  const mixed = ["r", "g", "b"].map((key) => (
    Math.round(source[key] + (target[key] - source[key]) * amount)
      .toString(16).padStart(2, "0")
  ));
  return `#${mixed.join("")}`;
}

export function normalizeThemeConfig(config = {}) {
  const source = config && typeof config === "object" ? config : {};
  return {
    ...DEFAULT_THEME_CONFIG,
    ...source,
    radius: clampRadius(source.radius ?? DEFAULT_THEME_CONFIG.radius),
    category_images:
      source.category_images && typeof source.category_images === "object"
        ? source.category_images
        : {},
    hero_layout: ["text_image", "logo_only", "image_only", "offer"].includes(source.hero_layout)
      ? source.hero_layout
      : DEFAULT_THEME_CONFIG.hero_layout,
    hero_alignment: source.hero_alignment === "center" ? "center" : "left",
    hero_image_fit: source.hero_image_fit === "contain" ? "contain" : "cover",
    show_offers: source.show_offers ?? DEFAULT_THEME_CONFIG.show_offers,
    show_featured: source.show_featured ?? DEFAULT_THEME_CONFIG.show_featured,
    category_style:
      source.category_style === "round_icons" ? "round_icons" : "chips",
    card_style: ["minimal_luxury", "urban_street", "tech_bento", "warm_deco", "gourmet_express"].includes(source.card_style)
      ? source.card_style
      : DEFAULT_THEME_CONFIG.card_style,
    card_aspect_ratio: ["3:4", "4:5", "1:1", "4:3"].includes(source.card_aspect_ratio)
      ? source.card_aspect_ratio
      : "3:4",
    card_image_fit: source.card_image_fit === "contain" ? "contain" : "cover",
    card_action_type: ["floating_plus", "footer_pill", "dual_action", "view_only"].includes(source.card_action_type)
      ? source.card_action_type
      : DEFAULT_THEME_CONFIG.card_action_type,
    card_show_stock: source.card_show_stock ?? DEFAULT_THEME_CONFIG.card_show_stock,
    card_show_specs: source.card_show_specs ?? DEFAULT_THEME_CONFIG.card_show_specs,
    card_show_discount_badge: source.card_show_discount_badge ?? DEFAULT_THEME_CONFIG.card_show_discount_badge,
    card_hover_secondary_img: source.card_hover_secondary_img ?? DEFAULT_THEME_CONFIG.card_hover_secondary_img,
    card_hover_zoom: source.card_hover_zoom ?? DEFAULT_THEME_CONFIG.card_hover_zoom,
    card_shadow: ["none", "soft", "elevated"].includes(source.card_shadow)
      ? source.card_shadow
      : DEFAULT_THEME_CONFIG.card_shadow,
    card_border: ["none", "subtle", "contrast"].includes(source.card_border)
      ? source.card_border
      : DEFAULT_THEME_CONFIG.card_border,
    card_radius: clampRadius(source.card_radius ?? source.radius ?? DEFAULT_THEME_CONFIG.card_radius),
    font_scale:
      source.font_scale === "sm" || source.font_scale === "lg"
        ? source.font_scale
        : "md",
  };
}

export function resolveTheme(theme) {
  const requestedThemeId = String(theme?.theme_id || DEFAULT_THEME_ID);
  const themeId = THEME_META[requestedThemeId] ? requestedThemeId : DEFAULT_THEME_ID;
  const config = normalizeThemeConfig(theme?.theme_config);
  return {
    themeId,
    config,
    meta: THEME_META[themeId] || THEME_META.modern_banner,
  };
}

export function applyThemeVariables(config = DEFAULT_THEME_CONFIG) {
  const root = document.documentElement;
  const next = normalizeThemeConfig(config);
  const darkBackground = colorBrightness(next.background) < 0.45;
  const surface = darkBackground
    ? blendHex(next.background, { r: 255, g: 255, b: 255 }, 0.08)
    : "#FFFFFF";

  let bodyBackgroundStyle = "";
  if (next.background_type === "linear") {
    const angle = next.background_gradient_angle ?? 135;
    const start = next.background_gradient_start || next.secondary;
    const end = next.background_gradient_end || next.background;
    bodyBackgroundStyle = `linear-gradient(${angle}deg, ${start}, ${end})`;
  } else if (next.background_type === "radial") {
    const start = next.background_gradient_start || next.secondary;
    const end = next.background_gradient_end || next.background;
    bodyBackgroundStyle = `radial-gradient(circle, ${start}, ${end})`;
  } else {
    // Default solid + glow
    bodyBackgroundStyle = `radial-gradient(circle at top left, color-mix(in srgb, ${next.secondary} 35%, transparent), transparent 36%), linear-gradient(180deg, color-mix(in srgb, ${next.background} 92%, #ffffff), ${next.background})`;
  }

  const aspectMap = {
    "3:4": "3 / 4",
    "4:5": "4 / 5",
    "1:1": "1 / 1",
    "4:3": "4 / 3",
  };
  const cardRatio = aspectMap[next.card_aspect_ratio] || "3 / 4";

  const variables = {
    "--color-primary": next.primary,
    "--color-secondary": next.secondary,
    "--color-background": next.background,
    "--color-surface": surface,
    "--color-on-primary": colorBrightness(next.primary) > 0.64 ? "#111827" : "#FFFFFF",
    "--color-text": next.text,
    "--color-muted": next.muted,
    "--radius-base": `${next.radius}px`,
    "--radius-lg": `${Math.max(next.radius + 6, next.radius)}px`,
    "--card-radius": `${next.card_radius ?? next.radius}px`,
    "--font-scale": String(FONT_SCALE_MAP[next.font_scale] || FONT_SCALE_MAP.md),
    "--body-background": bodyBackgroundStyle,
    "--card-aspect-ratio": cardRatio,
  };

  Object.entries(variables).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

export function ThemeProvider({ theme, children }) {
  const resolved = useMemo(() => resolveTheme(theme), [theme]);

  useEffect(() => {
    applyThemeVariables(resolved.config);
  }, [resolved]);

  return (
    <ThemeContext.Provider value={resolved}>{children}</ThemeContext.Provider>
  );
}

export function useThemeConfig() {
  return useContext(ThemeContext);
}

export const themeRegistry = THEME_META;
