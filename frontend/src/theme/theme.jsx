import { createContext, useContext, useEffect, useMemo } from "react";
import { DEFAULT_THEME_CONFIG, DEFAULT_THEME_ID } from "../api/api";

const THEME_META = {
  modern_banner: {
    label: "Modern Banner",
    description: "Banner superior, categorias redondas y bloques destacados.",
  },
  soft_beige: {
    label: "Soft Beige",
    description: "Header limpio, tabs y layout editorial suave.",
  },
  minimal_clean: {
    label: "Minimal Clean",
    description: "Catalogo basico, limpio y directo.",
  },
};

const ThemeContext = createContext({
  themeId: DEFAULT_THEME_ID,
  config: DEFAULT_THEME_CONFIG,
  meta: THEME_META[DEFAULT_THEME_ID],
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
    meta: THEME_META[themeId],
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
    "--font-scale": String(FONT_SCALE_MAP[next.font_scale] || FONT_SCALE_MAP.md),
    "--body-background": bodyBackgroundStyle,
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
