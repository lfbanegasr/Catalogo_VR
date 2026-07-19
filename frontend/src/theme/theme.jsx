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
  const variables = {
    "--color-primary": next.primary,
    "--color-secondary": next.secondary,
    "--color-background": next.background,
    "--color-surface": "#FFFFFF",
    "--color-text": next.text,
    "--color-muted": next.muted,
    "--radius-base": `${next.radius}px`,
    "--radius-lg": `${Math.max(next.radius + 6, next.radius)}px`,
    "--font-scale": String(FONT_SCALE_MAP[next.font_scale] || FONT_SCALE_MAP.md),
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
