import React, { useEffect, useMemo, useState } from "react";
import { api, buildAssetUrl } from "../api";
import ImageDropZone from "./ImageDropZone";
import {
  TemaIcon,
  PaletteIcon,
  LayoutIcon,
  ShareIcon,
  SlidersIcon,
  CheckIcon,
  SmartphoneIcon,
  MonitorIcon,
  SparklesIcon,
  RefreshIcon,
  TagIcon,
} from "./common/Icons";

const GRADIENT_PRESETS = [
  { name: "Beige Suave", start: "#F6EFEA", end: "#E7D3CA", angle: 135, type: "linear" },
  { name: "Atardecer Rosa", start: "#FFF7FA", end: "#F8BBD0", angle: 135, type: "linear" },
  { name: "Lavanda Elegante", start: "#F3F4F6", end: "#EDE9FE", angle: 135, type: "linear" },
  { name: "Menta Fresca", start: "#F0FDF4", end: "#DCFCE7", angle: 135, type: "linear" },
  { name: "Cielo Azul", start: "#E0F2FE", end: "#BAE6FD", angle: 135, type: "linear" },
  { name: "Urbano Oscuro", start: "#1E293B", end: "#0F172A", angle: 135, type: "linear" },
];

const CARD_PRESETS = {
  minimal_luxury: {
    label: "Minimal Luxury",
    sector: "Moda & Joyería",
    description: "Editorial 3:4 vertical, esquinas suaves, botón circular flotante sobre foto y hover a segunda imagen.",
    config: {
      card_style: "minimal_luxury",
      card_aspect_ratio: "3:4",
      card_image_fit: "cover",
      card_action_type: "floating_plus",
      card_show_stock: true,
      card_show_specs: false,
      card_show_discount_badge: true,
      card_hover_secondary_img: true,
      card_hover_zoom: true,
      card_shadow: "soft",
      card_border: "none",
      card_radius: 10,
    },
  },
  urban_street: {
    label: "Urban Street",
    sector: "Sneakers & Streetwear",
    description: "Vertical 4:5 de alto impacto, tipografía bold, badge de drop destacado, borde contrastado y botón píldora 'Añadir +'.",
    config: {
      card_style: "urban_street",
      card_aspect_ratio: "4:5",
      card_image_fit: "cover",
      card_action_type: "footer_pill",
      card_show_stock: true,
      card_show_specs: true,
      card_show_discount_badge: true,
      card_hover_secondary_img: true,
      card_hover_zoom: true,
      card_shadow: "elevated",
      card_border: "contrast",
      card_radius: 6,
    },
  },
  tech_bento: {
    label: "Tech Bento",
    sector: "Tecnología & Hardware",
    description: "Cuadrado 1:1 nítido, chips de especificaciones visibles (RAM/Almacenamiento), punto de stock y doble botón.",
    config: {
      card_style: "tech_bento",
      card_aspect_ratio: "1:1",
      card_image_fit: "contain",
      card_action_type: "dual_action",
      card_show_stock: true,
      card_show_specs: true,
      card_show_discount_badge: true,
      card_hover_secondary_img: false,
      card_hover_zoom: true,
      card_shadow: "soft",
      card_border: "subtle",
      card_radius: 14,
    },
  },
  warm_deco: {
    label: "Nordic Warm",
    sector: "Muebles, Hogar & Deco",
    description: "Panorámico 4:3, esquinas curvas (16px), sombras cálidas, etiquetas de material noble y botón sobrio de detalles.",
    config: {
      card_style: "warm_deco",
      card_aspect_ratio: "4:3",
      card_image_fit: "cover",
      card_action_type: "view_only",
      card_show_stock: false,
      card_show_specs: true,
      card_show_discount_badge: true,
      card_hover_secondary_img: true,
      card_hover_zoom: true,
      card_shadow: "soft",
      card_border: "subtle",
      card_radius: 16,
    },
  },
  gourmet_express: {
    label: "Gourmet Express",
    sector: "Gastronomía & Delicatessen",
    description: "Cuadrado 1:1 centrado en foto apetecible, píldoras de ingredientes y botón de pedido rápido para agilidad.",
    config: {
      card_style: "gourmet_express",
      card_aspect_ratio: "1:1",
      card_image_fit: "cover",
      card_action_type: "footer_pill",
      card_show_stock: false,
      card_show_specs: true,
      card_show_discount_badge: true,
      card_hover_secondary_img: false,
      card_hover_zoom: true,
      card_shadow: "soft",
      card_border: "subtle",
      card_radius: 18,
    },
  },
};

const THEME_PRESETS = {
  modern_banner: {
    label: "Modern Banner",
    sector: "Cosmética & Belleza",
    description: "Banner superior visual, categorías dinámicas y ofertas destacadas.",
    config: {
      primary: "#E94B8A",
      secondary: "#F8BBD0",
      background: "#FFF7FA",
      text: "#1F1F1F",
      muted: "#6B7280",
      radius: 16,
      card_style: "minimal_luxury",
      card_aspect_ratio: "1:1",
      card_image_fit: "cover",
      card_action_type: "floating_plus",
      card_show_stock: true,
      card_show_specs: true,
      card_show_discount_badge: true,
      card_hover_secondary_img: true,
      card_hover_zoom: true,
      card_shadow: "soft",
      card_border: "subtle",
      card_radius: 14,
      hero_image_url: "",
      hero_logo_url: "",
      hero_layout: "text_image",
      hero_kicker: "",
      hero_title: "",
      hero_subtitle: "Colección destacada, categorías visuales y ofertas activas.",
      hero_offer_text: "",
      hero_alignment: "left",
      hero_image_fit: "cover",
      category_images: {},
      show_offers: true,
      show_featured: true,
      category_style: "round_icons",
      font_scale: "md",
      side_menu_title: "",
      side_menu_text: "",
      contact_phone: "",
      contact_email: "",
      contact_whatsapp: "",
      social_instagram: "",
      social_tiktok: "",
      social_facebook: "",
    },
  },
  soft_beige: {
    label: "Soft Beige",
    sector: "Boutique & Bienestar",
    description: "Header limpio, paleta cálida y navegación sutil tipo chips.",
    config: {
      primary: "#C89B8C",
      secondary: "#E7D3CA",
      background: "#F6EFEA",
      text: "#2B2B2B",
      muted: "#6B7280",
      radius: 18,
      card_style: "warm_deco",
      card_aspect_ratio: "3:4",
      card_image_fit: "cover",
      card_action_type: "floating_plus",
      card_show_stock: true,
      card_show_specs: false,
      card_show_discount_badge: true,
      card_hover_secondary_img: true,
      card_hover_zoom: true,
      card_shadow: "soft",
      card_border: "none",
      card_radius: 16,
      hero_image_url: "",
      hero_logo_url: "",
      hero_layout: "text_image",
      hero_kicker: "",
      hero_title: "",
      hero_subtitle: "Diseño minimalista con tonos neutros y experiencia elegante.",
      hero_offer_text: "",
      hero_alignment: "left",
      hero_image_fit: "cover",
      category_images: {},
      show_offers: true,
      show_featured: false,
      category_style: "chips",
      font_scale: "md",
      side_menu_title: "",
      side_menu_text: "",
      contact_phone: "",
      contact_email: "",
      contact_whatsapp: "",
      social_instagram: "",
      social_tiktok: "",
      social_facebook: "",
    },
  },
  minimal_clean: {
    label: "Minimal Clean",
    sector: "Multirubro Minimal",
    description: "Vista minimalista ultra nítida, foco en producto y colores vibrantes.",
    config: {
      primary: "#6D28D9",
      secondary: "#EDE9FE",
      background: "#FFFFFF",
      text: "#111827",
      muted: "#6B7280",
      radius: 12,
      card_style: "minimal_luxury",
      card_aspect_ratio: "1:1",
      card_image_fit: "cover",
      card_action_type: "floating_plus",
      card_show_stock: true,
      card_show_specs: false,
      card_show_discount_badge: true,
      card_hover_secondary_img: true,
      card_hover_zoom: true,
      card_shadow: "none",
      card_border: "subtle",
      card_radius: 10,
      hero_image_url: "",
      hero_logo_url: "",
      hero_layout: "text_image",
      hero_kicker: "",
      hero_title: "",
      hero_subtitle: "Enfoque 100% en el catálogo con carga veloz y contraste alto.",
      hero_offer_text: "",
      hero_alignment: "left",
      hero_image_fit: "cover",
      category_images: {},
      show_offers: true,
      show_featured: false,
      category_style: "chips",
      font_scale: "sm",
      side_menu_title: "",
      side_menu_text: "",
      contact_phone: "",
      contact_email: "",
      contact_whatsapp: "",
      social_instagram: "",
      social_tiktok: "",
      social_facebook: "",
    },
  },
  luxe_minimal: {
    label: "Luxe Minimalist",
    sector: "Moda, Ropa & Lujo",
    description: "Estilo editorial Zara / Mango: fotos 3:4 verticales, estética limpia y tipografía elegante.",
    config: {
      primary: "#111827",
      secondary: "#F3F4F6",
      background: "#FAFAFA",
      text: "#111827",
      muted: "#6B7280",
      radius: 8,
      card_style: "minimal_luxury",
      card_aspect_ratio: "3:4",
      card_image_fit: "cover",
      card_action_type: "floating_plus",
      card_show_stock: true,
      card_show_specs: false,
      card_show_discount_badge: true,
      card_hover_secondary_img: true,
      card_hover_zoom: true,
      card_shadow: "soft",
      card_border: "none",
      card_radius: 8,
      hero_image_url: "",
      hero_logo_url: "",
      hero_layout: "text_image",
      hero_kicker: "NOUVELLE COLLECTION",
      hero_title: "",
      hero_subtitle: "Prendas y piezas seleccionadas con estética impecable y diseño contemporáneo.",
      hero_offer_text: "",
      hero_alignment: "center",
      hero_image_fit: "cover",
      category_images: {},
      show_offers: true,
      show_featured: true,
      category_style: "chips",
      font_scale: "md",
      side_menu_title: "",
      side_menu_text: "",
      contact_phone: "",
      contact_email: "",
      contact_whatsapp: "",
      social_instagram: "",
      social_tiktok: "",
      social_facebook: "",
    },
  },
  urban_street: {
    label: "Urban Streetwear",
    sector: "Streetwear & Sneakers",
    description: "Energía urbana de alto impacto: fotos 4:5 verticales, ticker marquee continuo y drops.",
    config: {
      primary: "#FF4500",
      secondary: "#1F2937",
      background: "#0F172A",
      text: "#F9FAFB",
      muted: "#9CA3AF",
      radius: 6,
      card_style: "urban_street",
      card_aspect_ratio: "4:5",
      card_image_fit: "cover",
      card_action_type: "footer_pill",
      card_show_stock: true,
      card_show_specs: true,
      card_show_discount_badge: true,
      card_hover_secondary_img: true,
      card_hover_zoom: true,
      card_shadow: "elevated",
      card_border: "contrast",
      card_radius: 6,
      hero_image_url: "",
      hero_logo_url: "",
      hero_layout: "text_image",
      hero_kicker: "EXCLUSIVE DROP 2026",
      hero_title: "",
      hero_subtitle: "Sneakers, prendas oversize y accesorios auténticos inspirados en el asfalto.",
      hero_offer_text: "• NUEVOS DROPS • STOCK LIMITADO • ENVÍO RÁPIDO • EXCLUSIVO EN LÍNEA •",
      hero_alignment: "left",
      hero_image_fit: "cover",
      category_images: {},
      show_offers: true,
      show_featured: true,
      category_style: "chips",
      font_scale: "lg",
      side_menu_title: "",
      side_menu_text: "",
      contact_phone: "",
      contact_email: "",
      contact_whatsapp: "",
      social_instagram: "",
      social_tiktok: "",
      social_facebook: "",
    },
  },
  tech_modern: {
    label: "Tech Nova",
    sector: "Tecnología & Gadgets",
    description: "Diseño Bento Apple/hardware: acentos azul neón, chips de especificaciones y gran nitidez.",
    config: {
      primary: "#0284C7",
      secondary: "#E0F2FE",
      background: "#F8FAFC",
      text: "#0F172A",
      muted: "#64748B",
      radius: 14,
      card_style: "tech_bento",
      card_aspect_ratio: "1:1",
      card_image_fit: "contain",
      card_action_type: "dual_action",
      card_show_stock: true,
      card_show_specs: true,
      card_show_discount_badge: true,
      card_hover_secondary_img: false,
      card_hover_zoom: true,
      card_shadow: "soft",
      card_border: "subtle",
      card_radius: 14,
      hero_image_url: "",
      hero_logo_url: "",
      hero_layout: "text_image",
      hero_kicker: "INNOVACIÓN DIGITAL",
      hero_title: "",
      hero_subtitle: "Gadgets de última generación, accesorios inteligentes y electrónica de precisión.",
      hero_offer_text: "",
      hero_alignment: "left",
      hero_image_fit: "cover",
      category_images: {},
      show_offers: true,
      show_featured: true,
      category_style: "chips",
      font_scale: "md",
      side_menu_title: "",
      side_menu_text: "",
      contact_phone: "",
      contact_email: "",
      contact_whatsapp: "",
      social_instagram: "",
      social_tiktok: "",
      social_facebook: "",
    },
  },
  home_deco: {
    label: "Nordic Living",
    sector: "Muebles, Hogar & Deco",
    description: "Minimalismo escandinavo: fotos panorámicas 4:3, tonos tierra y espacios aireados.",
    config: {
      primary: "#7C6354",
      secondary: "#EDE5DE",
      background: "#FAF7F2",
      text: "#292524",
      muted: "#78716C",
      radius: 16,
      card_style: "warm_deco",
      card_aspect_ratio: "4:3",
      card_image_fit: "cover",
      card_action_type: "view_only",
      card_show_stock: false,
      card_show_specs: true,
      card_show_discount_badge: true,
      card_hover_secondary_img: true,
      card_hover_zoom: true,
      card_shadow: "soft",
      card_border: "subtle",
      card_radius: 16,
      hero_image_url: "",
      hero_logo_url: "",
      hero_layout: "text_image",
      hero_kicker: "ESPACIOS CON ALMA",
      hero_title: "",
      hero_subtitle: "Muebles, iluminación y detalles cálidos que transforman cada rincón de tu hogar.",
      hero_offer_text: "",
      hero_alignment: "center",
      hero_image_fit: "cover",
      category_images: {},
      show_offers: true,
      show_featured: true,
      category_style: "chips",
      font_scale: "md",
      side_menu_title: "",
      side_menu_text: "",
      contact_phone: "",
      contact_email: "",
      contact_whatsapp: "",
      social_instagram: "",
      social_tiktok: "",
      social_facebook: "",
    },
  },
  gourmet_food: {
    label: "Gourmet Bistro",
    sector: "Café, Panadería & Gastronomía",
    description: "Carta artesanal gastronómica: tonos ámbar caramelo, fotos apetecibles e íconos redondos.",
    config: {
      primary: "#B45309",
      secondary: "#FEF3C7",
      background: "#FFFCF7",
      text: "#291809",
      muted: "#78716C",
      radius: 18,
      card_style: "gourmet_express",
      card_aspect_ratio: "1:1",
      card_image_fit: "cover",
      card_action_type: "footer_pill",
      card_show_stock: false,
      card_show_specs: true,
      card_show_discount_badge: true,
      card_hover_secondary_img: false,
      card_hover_zoom: true,
      card_shadow: "soft",
      card_border: "subtle",
      card_radius: 18,
      hero_image_url: "",
      hero_logo_url: "",
      hero_layout: "text_image",
      hero_kicker: "HORNEADO FRESCO CADA MAÑANA",
      hero_title: "",
      hero_subtitle: "Preparaciones hechas con dedicación, ingredientes seleccionados y frescura inigualable.",
      hero_offer_text: "",
      hero_alignment: "center",
      hero_image_fit: "cover",
      category_images: {},
      show_offers: true,
      show_featured: true,
      category_style: "round_icons",
      font_scale: "md",
      side_menu_title: "",
      side_menu_text: "",
      contact_phone: "",
      contact_email: "",
      contact_whatsapp: "",
      social_instagram: "",
      social_tiktok: "",
      social_facebook: "",
    },
  },
};

const PREVIEW_PRODUCTS = [
  { id: "p1", nombre: "Producto Estrella", precio: "49.90", badge: "Nuevo" },
  { id: "p2", nombre: "Edición Limitada", precio: "29.90", badge: "20% OFF" },
];

const toHex = ({ r, g, b }) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

const mix = (a, b, amount) =>
  toHex({
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  });

async function buildPaletteSuggestions(file) {
  const image = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 48;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, 48, 48);
  image.close?.();
  const data = context.getImageData(0, 0, 48, 48).data;
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 16) {
    if (data[i + 3] < 160) continue;
    const values = [data[i], data[i + 1], data[i + 2]].map((v) => Math.round(v / 24) * 24);
    const light = (Math.max(...values) + Math.min(...values)) / 510;
    if (light > 0.96) continue;
    const key = values.join(",");
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  const colors = [...buckets]
    .map(([key, count]) => {
      const [r, g, b] = key.split(",").map(Number);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      return { r, g, b, count, saturation: max ? (max - min) / max : 0, light: (max + min) / 510 };
    })
    .sort((a, b) => b.count * (0.55 + b.saturation) - a.count * (0.55 + a.saturation));

  if (!colors.length) throw new Error("La imagen no contiene colores utilizables");
  const accent = colors.find((c) => c.saturation > 0.22 && c.light > 0.12 && c.light < 0.88) || colors[0];
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 12, g: 16, b: 24 };

  return [
    {
      name: "Equilibrada",
      description: "Tono principal fiel con fondos sutiles.",
      colors: {
        primary: toHex(accent),
        secondary: mix(accent, white, 0.65),
        background: mix(accent, white, 0.93),
        text: mix(accent, black, 0.82),
        muted: "#64748b",
      },
    },
    {
      name: "Suave",
      description: "Fondo luminoso y acentos elegantes.",
      colors: {
        primary: mix(accent, black, 0.12),
        secondary: mix(accent, white, 0.78),
        background: mix(accent, white, 0.97),
        text: "#1f2937",
        muted: "#6b7280",
      },
    },
    {
      name: "Contraste",
      description: "Base profunda con acentos de alto impacto.",
      colors: {
        primary: mix(accent, white, accent.light < 0.4 ? 0.38 : 0.08),
        secondary: mix(accent, black, 0.5),
        background: mix(accent, black, 0.82),
        text: "#f8fafc",
        muted: "#cbd5e1",
      },
    },
  ];
}

function normalizeThemeConfig(themeId, themeConfig) {
  const preset = THEME_PRESETS[themeId] || THEME_PRESETS.modern_banner;
  return {
    ...preset.config,
    card_style: "minimal_luxury",
    card_aspect_ratio: "3:4",
    card_image_fit: "cover",
    card_action_type: "floating_plus",
    card_show_stock: true,
    card_show_specs: true,
    card_show_discount_badge: true,
    card_hover_secondary_img: true,
    card_hover_zoom: true,
    card_shadow: "soft",
    card_border: "subtle",
    card_radius: 12,
    ...(themeConfig || {}),
    category_images:
      themeConfig?.category_images && typeof themeConfig.category_images === "object"
        ? themeConfig.category_images
        : {},
  };
}

function buildForm(themeId, themeConfig) {
  return {
    theme_id: themeId,
    theme_config: normalizeThemeConfig(themeId, themeConfig),
  };
}

function buildPresetForm(themeId, currentConfig = {}) {
  const preset = THEME_PRESETS[themeId] || THEME_PRESETS.modern_banner;
  return {
    theme_id: themeId,
    theme_config: {
      ...preset.config,
      // Preservar configuración de cards si ya existía
      card_style: currentConfig.card_style || preset.config.card_style,
      card_aspect_ratio: currentConfig.card_aspect_ratio || preset.config.card_aspect_ratio,
      card_image_fit: currentConfig.card_image_fit || preset.config.card_image_fit,
      card_action_type: currentConfig.card_action_type || preset.config.card_action_type,
      card_show_stock: currentConfig.card_show_stock ?? preset.config.card_show_stock,
      card_show_specs: currentConfig.card_show_specs ?? preset.config.card_show_specs,
      card_show_discount_badge: currentConfig.card_show_discount_badge ?? preset.config.card_show_discount_badge,
      card_hover_secondary_img: currentConfig.card_hover_secondary_img ?? preset.config.card_hover_secondary_img,
      card_hover_zoom: currentConfig.card_hover_zoom ?? preset.config.card_hover_zoom,
      card_shadow: currentConfig.card_shadow || preset.config.card_shadow,
      card_border: currentConfig.card_border || preset.config.card_border,
      card_radius: currentConfig.card_radius ?? preset.config.card_radius,

      // Preservar textos personalizados por el comerciante si ya existían
      hero_kicker: currentConfig.hero_kicker !== undefined ? currentConfig.hero_kicker : preset.config.hero_kicker,
      hero_title: currentConfig.hero_title !== undefined ? currentConfig.hero_title : preset.config.hero_title,
      hero_subtitle: currentConfig.hero_subtitle !== undefined ? currentConfig.hero_subtitle : preset.config.hero_subtitle,
      hero_offer_text: currentConfig.hero_offer_text !== undefined ? currentConfig.hero_offer_text : preset.config.hero_offer_text,

      // Preservar siempre portadas, logos y multimedia cargada
      hero_image_url: currentConfig.hero_image_url || "",
      hero_logo_url: currentConfig.hero_logo_url || "",
      hero_image_fit: currentConfig.hero_image_fit || preset.config.hero_image_fit || "cover",
      category_images: currentConfig.category_images || {},

      // Preservar datos de contacto y redes si ya fueron completados
      side_menu_title: currentConfig.side_menu_title || "",
      side_menu_text: currentConfig.side_menu_text || "",
      contact_phone: currentConfig.contact_phone || "",
      contact_email: currentConfig.contact_email || "",
      contact_whatsapp: currentConfig.contact_whatsapp || "",
      social_instagram: currentConfig.social_instagram || "",
      social_tiktok: currentConfig.social_tiktok || "",
      social_facebook: currentConfig.social_facebook || "",
    },
  };
}

/* ==========================================================================
   SUBCOMPONENTS: MINI PRESET CARD & LIVE SIMULATOR
   ========================================================================== */

function ThemePresetCard({ themeId, active, onClick }) {
  const preset = THEME_PRESETS[themeId];
  const cardStyle = {
    "--preset-primary": preset.config.primary,
    "--preset-secondary": preset.config.secondary,
    "--preset-bg": preset.config.background,
  };

  return (
    <button
      type="button"
      className={`theme-preset-card ${active ? "active" : ""}`}
      style={cardStyle}
      onClick={onClick}
    >
      <div className="theme-preset-mini-canvas">
        <div className="theme-preset-bar" />
        <div className="theme-preset-chips">
          <span />
          <span />
          <span />
        </div>
        <div className="theme-preset-cards">
          <div />
          <div />
          <div />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
        <strong>{preset.label}</strong>
        {active && (
          <span style={{ color: "var(--brand-primary)", fontWeight: 700, fontSize: "0.75rem", flexShrink: 0 }}>
            ✓ Activo
          </span>
        )}
      </div>
      {preset.sector && (
        <span
          style={{
            alignSelf: "flex-start",
            fontSize: "0.68rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            padding: "2px 7px",
            borderRadius: "4px",
            background: "rgba(0,0,0,0.06)",
            color: "var(--text-muted)",
            margin: "3px 0 5px",
          }}
        >
          {preset.sector}
        </span>
      )}
      <span>{preset.description}</span>
    </button>
  );
}

function LiveStoreSimulator({ storeName, form, categories, deviceMode, currencySymbol }) {
  const cfg = form.theme_config;

  let liveBodyBackground = "";
  if (cfg.background_type === "linear") {
    const angle = cfg.background_gradient_angle ?? 135;
    const start = cfg.background_gradient_start || cfg.secondary;
    const end = cfg.background_gradient_end || cfg.background;
    liveBodyBackground = `linear-gradient(${angle}deg, ${start}, ${end})`;
  } else if (cfg.background_type === "radial") {
    const start = cfg.background_gradient_start || cfg.secondary;
    const end = cfg.background_gradient_end || cfg.background;
    liveBodyBackground = `radial-gradient(circle, ${start}, ${end})`;
  } else {
    liveBodyBackground = cfg.background || "#ffffff";
  }

  const previewStyle = {
    "--live-primary": cfg.primary,
    "--live-secondary": cfg.secondary,
    "--live-background": cfg.background,
    "--live-body-background": liveBodyBackground,
    "--live-text": cfg.text,
    "--live-muted": cfg.muted,
    "--live-radius": `${cfg.radius}px`,
  };

  const previewCategories = categories.length
    ? categories.slice(0, 4)
    : [
        { id: "1", nombre: "Novedades" },
        { id: "2", nombre: "Destacados" },
        { id: "3", nombre: "Ofertas" },
      ];

  const logoUrl = cfg.hero_logo_url || "";
  const symbol = currencySymbol || "S/";

  return (
    <div className={`theme-device-frame ${deviceMode}`} style={{ maxWidth: "100%", boxSizing: "border-box" }}>
      {deviceMode === "mobile" && <div className="theme-device-notch" />}
      <div
        className="live-preview-shell"
        style={{
          ...previewStyle,
          minHeight: "440px",
          background: liveBodyBackground,
          color: cfg.text,
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          fontFamily: "system-ui, sans-serif",
          boxSizing: "border-box",
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          overflowX: "hidden",
        }}
      >
        {/* Top Store Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            background: "rgba(255, 255, 255, 0.75)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            borderRadius: `calc(${cfg.radius}px - 4px)`,
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            width: "100%",
            maxWidth: "100%",
            boxSizing: "border-box",
            minWidth: 0,
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1, overflow: "hidden" }}>
            {logoUrl ? (
              <img
                src={buildAssetUrl(logoUrl)}
                alt="Logo"
                style={{ height: "30px", maxWidth: "90px", objectFit: "contain", flexShrink: 0 }}
              />
            ) : (
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: cfg.primary,
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 800,
                  fontSize: "14px",
                  flexShrink: 0,
                }}
              >
                {String(storeName || "T").slice(0, 1)}
              </div>
            )}
            <strong style={{ fontSize: "0.92rem", color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {storeName || "Mi Tienda Online"}
            </strong>
          </div>
          <span style={{ fontSize: "12px", color: cfg.primary, fontWeight: 700, flexShrink: 0 }}>
            🛒 2
          </span>
        </div>

        {/* Hero Banner */}
        {cfg.hero_image_url ? (
          <div
            style={{
              width: "100%",
              maxWidth: "100%",
              boxSizing: "border-box",
              height: deviceMode === "mobile" ? "120px" : "150px",
              borderRadius: `calc(${cfg.radius}px - 2px)`,
              overflow: "hidden",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
          >
            <img
              src={buildAssetUrl(cfg.hero_image_url)}
              alt="Banner"
              style={{
                width: "100%",
                height: "100%",
                objectFit: cfg.hero_image_fit || "cover",
                display: "block",
              }}
            />
          </div>
        ) : (
          <div
            style={{
              padding: "16px",
              borderRadius: `calc(${cfg.radius}px - 2px)`,
              background: `linear-gradient(135deg, ${cfg.primary}, ${cfg.secondary})`,
              color: "#fff",
              textAlign: "center",
              width: "100%",
              maxWidth: "100%",
              boxSizing: "border-box",
              minWidth: 0,
            }}
          >
            {cfg.hero_kicker && (
              <span
                style={{
                  display: "inline-block",
                  fontSize: "0.68rem",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  background: "rgba(0,0,0,0.18)",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  marginBottom: "6px",
                }}
              >
                {cfg.hero_kicker}
              </span>
            )}
            <h4 style={{ margin: "0 0 4px", fontSize: "1.05rem", fontWeight: 800, wordBreak: "break-word" }}>
              {cfg.hero_title || storeName || "Colección Exclusiva"}
            </h4>
            <p style={{ margin: 0, fontSize: "0.78rem", opacity: 0.92, wordBreak: "break-word" }}>
              {cfg.hero_subtitle || "Encuentra tus productos favoritos con envíos a todo el país"}
            </p>
          </div>
        )}

        {/* Categories Bar */}
        <div style={{ width: "100%", maxWidth: "100%", minWidth: 0, overflow: "hidden", boxSizing: "border-box" }}>
          <div
            style={{
              display: "flex",
              gap: "8px",
              overflowX: "auto",
              paddingBottom: "4px",
              scrollbarWidth: "none",
              WebkitOverflowScrolling: "touch",
              width: "100%",
              maxWidth: "100%",
              minWidth: 0,
              boxSizing: "border-box",
            }}
          >
            {previewCategories.map((cat, i) => {
              const catImg = cfg.category_images?.[String(cat.id)];
              const isActive = i === 0;

              if (cfg.category_style === "round_icons") {
                return (
                  <div
                    key={cat.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "4px",
                      minWidth: "62px",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "50%",
                        border: `2px solid ${isActive ? cfg.primary : "transparent"}`,
                        padding: "2px",
                        background: "#fff",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                        overflow: "hidden",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      {catImg ? (
                        <img
                          src={buildAssetUrl(catImg)}
                          alt={cat.nombre}
                          style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
                        />
                      ) : (
                        <span style={{ fontSize: "14px", fontWeight: 700, color: cfg.primary }}>
                          {String(cat.nombre || "C").slice(0, 1)}
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: isActive ? 700 : 500,
                        color: cfg.text,
                        textAlign: "center",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {cat.nombre}
                    </span>
                  </div>
                );
              }

              // Chips style
              return (
                <div
                  key={cat.id}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "999px",
                    background: isActive ? cfg.primary : "rgba(255,255,255,0.8)",
                    color: isActive ? "#fff" : cfg.text,
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                    cursor: "pointer",
                  }}
                >
                  {cat.nombre}
                </div>
              );
            })}
          </div>
        </div>

        {/* Promotional Offer */}
        {cfg.show_offers && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: `calc(${cfg.radius}px - 4px)`,
              background: `color-mix(in srgb, ${cfg.primary} 15%, #ffffff)`,
              border: `1px solid color-mix(in srgb, ${cfg.primary} 30%, transparent)`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              minWidth: 0,
              width: "100%",
              boxSizing: "border-box",
              gap: "8px",
            }}
          >
            <div style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 800,
                  color: cfg.primary,
                  textTransform: "uppercase",
                  display: "block",
                }}
              >
                🔥 {cfg.hero_kicker || "Oferta Especial"}
              </span>
              <strong style={{ fontSize: "0.84rem", color: cfg.text, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {cfg.hero_offer_text || "Descuento de Temporada Activo"}
              </strong>
            </div>
            <span
              style={{
                fontSize: "0.74rem",
                padding: "3px 8px",
                borderRadius: "6px",
                background: cfg.primary,
                color: "#fff",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              Ver promo
            </span>
          </div>
        )}

        {/* Featured Products */}
        {cfg.show_featured && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "auto", minWidth: 0, width: "100%", boxSizing: "border-box" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: cfg.muted, textTransform: "uppercase" }}>
              Destacados
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px", minWidth: 0, width: "100%", boxSizing: "border-box" }}>
              {PREVIEW_PRODUCTS.map((prod) => {
                const cardAspect = cfg.card_aspect_ratio === "4:5" ? "4/5" : cfg.card_aspect_ratio === "3:4" ? "3/4" : cfg.card_aspect_ratio === "4:3" ? "4/3" : "1/1";
                const cardRadius = `${cfg.card_radius ?? cfg.radius}px`;
                const cardShadow = cfg.card_shadow === "elevated" ? "0 8px 20px rgba(0,0,0,0.12)" : cfg.card_shadow === "none" ? "none" : "0 2px 8px rgba(0,0,0,0.06)";
                const cardBorder = cfg.card_border === "contrast" ? "1.5px solid rgba(0,0,0,0.18)" : cfg.card_border === "subtle" ? "1px solid rgba(0,0,0,0.08)" : "none";
                const showBadge = cfg.card_show_discount_badge ?? true;
                const showStock = cfg.card_show_stock ?? true;
                const showSpecs = cfg.card_show_specs ?? true;
                const actionType = cfg.card_action_type || "floating_plus";

                return (
                  <div
                    key={prod.id}
                    style={{
                      background: "#ffffff",
                      borderRadius: cardRadius,
                      padding: "10px",
                      boxShadow: cardShadow,
                      border: cardBorder,
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      minWidth: 0,
                      boxSizing: "border-box",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        aspectRatio: cardAspect,
                        maxHeight: "100px",
                        borderRadius: `calc(${cardRadius} - 4px)`,
                        background: `linear-gradient(135deg, color-mix(in srgb, ${cfg.secondary} 40%, #ffffff), color-mix(in srgb, ${cfg.primary} 15%, #ffffff))`,
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      {showBadge && prod.badge && (
                        <span
                          style={{
                            position: "absolute",
                            top: "6px",
                            left: "6px",
                            fontSize: "0.65rem",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: cfg.primary,
                            color: "#fff",
                            fontWeight: 700,
                          }}
                        >
                          {prod.badge}
                        </span>
                      )}

                      {actionType === "floating_plus" && (
                        <button
                          type="button"
                          style={{
                            position: "absolute",
                            bottom: "6px",
                            right: "6px",
                            width: "22px",
                            height: "22px",
                            borderRadius: "50%",
                            background: cfg.primary,
                            color: "#fff",
                            border: "none",
                            fontSize: "11px",
                            fontWeight: 700,
                            display: "grid",
                            placeItems: "center",
                            cursor: "pointer",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                          }}
                        >
                          +
                        </button>
                      )}
                    </div>

                    {showSpecs && (
                      <div style={{ display: "flex", gap: "3px" }}>
                        <span style={{ fontSize: "0.6rem", padding: "1px 4px", borderRadius: "3px", background: "rgba(0,0,0,0.05)", color: cfg.muted }}>
                          Talla M
                        </span>
                      </div>
                    )}

                    <strong style={{ fontSize: "0.8rem", color: "#111827", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {prod.nombre}
                    </strong>

                    {showStock && (
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#10b981" }} />
                        <span style={{ fontSize: "0.66rem", fontWeight: 600, color: "#059669" }}>En stock</span>
                      </div>
                    )}

                    <div style={{
                      display: "flex",
                      flexDirection: actionType === "footer_pill" ? "column" : "row",
                      justifyContent: "space-between",
                      alignItems: actionType === "footer_pill" ? "stretch" : "center",
                      gap: "4px",
                      marginTop: "2px",
                    }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 800, color: cfg.primary }}>
                        {symbol} {prod.precio}
                      </span>

                      {actionType === "footer_pill" && (
                        <button
                          type="button"
                          style={{
                            width: "100%",
                            padding: "3px 6px",
                            borderRadius: "999px",
                            border: "none",
                            background: cfg.primary,
                            color: "#fff",
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Añadir +
                        </button>
                      )}

                      {actionType === "dual_action" && (
                        <div style={{ display: "flex", gap: "3px" }}>
                          <span style={{ fontSize: "0.68rem", color: cfg.muted, fontWeight: 600 }}>Ver</span>
                          <button
                            type="button"
                            style={{
                              border: "none",
                              background: cfg.primary,
                              color: "#fff",
                              borderRadius: "4px",
                              padding: "2px 5px",
                              fontSize: "0.66rem",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            +
                          </button>
                        </div>
                      )}

                      {(actionType === "floating_plus" || actionType === "view_only") && (
                        <span style={{ fontSize: "0.7rem", color: cfg.primary, fontWeight: 700 }}>
                          Ver →
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   CARD STUDIO: INTERACTIVE CARD EDITOR COMPONENT
   ========================================================================== */

function InteractiveCardStudio({ form, updateConfig, symbol = "S/", setOk }) {
  const cfg = form.theme_config;
  const [testState, setTestState] = useState("in_stock");
  const [testDarkBg, setTestDarkBg] = useState(false);
  const [addedAnimation, setAddedAnimation] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleApplyPreset = (presetKey) => {
    const preset = CARD_PRESETS[presetKey];
    if (!preset) return;
    Object.entries(preset.config).forEach(([k, v]) => {
      updateConfig(k, v);
    });
    if (setOk) {
      setOk(`Plantilla de tarjeta '${preset.label}' aplicada. Recuerda guardar y publicar.`);
    }
  };

  const handleTestClick = (e) => {
    e.stopPropagation();
    if (testState === "out_of_stock") return;
    setAddedAnimation(true);
    setTimeout(() => setAddedAnimation(false), 1400);
  };

  const cardStyle = cfg.card_style || "minimal_luxury";
  const aspectRatio = cfg.card_aspect_ratio || "3:4";
  const aspectCss = aspectRatio === "4:5" ? "4/5" : aspectRatio === "3:4" ? "3/4" : aspectRatio === "4:3" ? "4/3" : "1/1";
  const imageFit = cfg.card_image_fit || "cover";
  const radius = cfg.card_radius ?? cfg.radius ?? 12;
  const shadow = cfg.card_shadow || "soft";
  const border = cfg.card_border || "subtle";
  const actionType = cfg.card_action_type || "floating_plus";
  const showStock = cfg.card_show_stock ?? true;
  const showSpecs = cfg.card_show_specs ?? true;
  const showDiscountBadge = cfg.card_show_discount_badge ?? true;
  const hoverSecondaryImg = cfg.card_hover_secondary_img ?? true;
  const hoverZoom = cfg.card_hover_zoom ?? true;

  const mockProduct = {
    name: "Sneaker Urban Horizon V2",
    price: "89.90",
    originalPrice: "120.00",
    discount: "25%",
    specs: ["Talla 42", "Edición Limitada"],
    stockText: testState === "out_of_stock" ? "Agotado" : testState === "low_stock" ? "Últimas 2 uds." : "En stock",
    stockClass: testState === "out_of_stock" ? "out" : testState === "low_stock" ? "low" : "available",
    primaryImage: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80",
    secondaryImage: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=600&q=80",
  };

  const isAvailable = testState !== "out_of_stock";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
      {/* 1. Presets Rápidos */}
      <div className="theme-panel-card">
        <div className="theme-card-header">
          <h3>
            <SparklesIcon size={18} style={{ color: "var(--brand-primary)" }} />
            1. Presets de Tarjeta por Rubro
          </h3>
          <p>Configura en 1 clic la combinación recomendada de proporción, botón de compra y badges según tu rubro.</p>
        </div>

        <div className="card-preset-grid">
          {Object.entries(CARD_PRESETS).map(([key, preset]) => {
            const isActive = cardStyle === key;
            return (
              <button
                type="button"
                key={key}
                className={`card-preset-btn ${isActive ? "active" : ""}`}
                onClick={() => handleApplyPreset(key)}
              >
                <div className="card-preset-top">
                  <span className="card-preset-name">{preset.label}</span>
                  {isActive ? (
                    <span style={{ color: "var(--brand-primary)", fontWeight: 700, fontSize: "0.74rem" }}>✓ Activo</span>
                  ) : (
                    <span className="card-preset-badge">{preset.sector}</span>
                  )}
                </div>
                <p className="card-preset-desc">{preset.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Geometría y Proporción */}
      <div className="theme-panel-card">
        <div className="theme-card-header">
          <h3>
            <LayoutIcon size={18} style={{ color: "var(--brand-primary)" }} />
            2. Proporción de Foto y Geometría
          </h3>
          <p>Define la silueta de las imágenes y el nivel de redondeado de las tarjetas.</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <label>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "8px" }}>
              Proporción de Foto (Aspect Ratio)
            </span>
            <div className="card-ratio-grid">
              {[
                { ratio: "3:4", label: "Vertical 3:4", sub: "Editorial Moda", iconWidth: 24, iconHeight: 32 },
                { ratio: "4:5", label: "Vertical 4:5", sub: "Streetwear Drops", iconWidth: 24, iconHeight: 30 },
                { ratio: "1:1", label: "Cuadrado 1:1", sub: "Universal & Tech", iconWidth: 26, iconHeight: 26 },
                { ratio: "4:3", label: "Panorámico 4:3", sub: "Hogar & Muebles", iconWidth: 32, iconHeight: 24 },
              ].map((item) => (
                <button
                  type="button"
                  key={item.ratio}
                  className={`card-ratio-btn ${aspectRatio === item.ratio ? "active" : ""}`}
                  onClick={() => updateConfig("card_aspect_ratio", item.ratio)}
                >
                  <div className="card-ratio-icon" style={{ width: `${item.iconWidth}px`, height: `${item.iconHeight}px` }}>
                    {item.ratio}
                  </div>
                  <strong style={{ fontSize: "0.82rem" }}>{item.label}</strong>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{item.sub}</span>
                </button>
              ))}
            </div>
          </label>

          <div className="theme-grid-2col" style={{ gap: "14px" }}>
            <label>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                Ajuste de Imagen
              </span>
              <select
                value={imageFit}
                onChange={(e) => updateConfig("card_image_fit", e.target.value)}
              >
                <option value="cover">Llenar y recortar proporcionalmente (Cover - Recomendado)</option>
                <option value="contain">Mostrar imagen completa sin cortes (Contain)</option>
              </select>
            </label>

            <label>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                Sombra de la Tarjeta
              </span>
              <select
                value={shadow}
                onChange={(e) => updateConfig("card_shadow", e.target.value)}
              >
                <option value="none">Sin sombra (Plano minimal)</option>
                <option value="soft">Sombra suave y sutil (Elegante)</option>
                <option value="elevated">Sombra elevada (Flotante moderna)</option>
              </select>
            </label>
          </div>

          <div className="theme-grid-2col" style={{ gap: "14px" }}>
            <label>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                Borde Perimetral
              </span>
              <select
                value={border}
                onChange={(e) => updateConfig("card_border", e.target.value)}
              >
                <option value="none">Sin borde</option>
                <option value="subtle">Borde sutil (1px discreto)</option>
                <option value="contrast">Borde contrastado (1.5px nítido)</option>
              </select>
            </label>

            <div className="theme-range-row" style={{ marginTop: 0 }}>
              <div className="theme-range-header">
                <span>Redondeado de Tarjeta</span>
                <span className="theme-range-badge">{radius} px</span>
              </div>
              <input
                type="range"
                min="4"
                max="24"
                step="2"
                value={radius}
                onChange={(e) => updateConfig("card_radius", Number(e.target.value))}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Elementos Visibles */}
      <div className="theme-panel-card">
        <div className="theme-card-header">
          <h3>
            <SlidersIcon size={18} style={{ color: "var(--brand-primary)" }} />
            3. Elementos Visibles y Micro-interacciones
          </h3>
          <p>Activa o desactiva elementos clave para mantener la tarjeta tan limpia como desees.</p>
        </div>

        <div className="card-toggle-list">
          <label className="card-toggle-row">
            <div className="card-toggle-text">
              <span className="card-toggle-title">Mostrar Badge de Descuento (-XX%)</span>
              <span className="card-toggle-desc">Etiqueta flotante con porcentaje de oferta si el producto tiene descuento.</span>
            </div>
            <div className="card-switch">
              <input
                type="checkbox"
                checked={!!showDiscountBadge}
                onChange={(e) => updateConfig("card_show_discount_badge", e.target.checked)}
              />
              <span className="card-switch-slider" />
            </div>
          </label>

          <label className="card-toggle-row">
            <div className="card-toggle-text">
              <span className="card-toggle-title">Mostrar Indicador de Stock</span>
              <span className="card-toggle-desc">Píldora con punto luminoso ('En stock', 'Últimas unidades', 'Agotado').</span>
            </div>
            <div className="card-switch">
              <input
                type="checkbox"
                checked={!!showStock}
                onChange={(e) => updateConfig("card_show_stock", e.target.checked)}
              />
              <span className="card-switch-slider" />
            </div>
          </label>

          <label className="card-toggle-row">
            <div className="card-toggle-text">
              <span className="card-toggle-title">Mostrar Chips de Atributos Clave</span>
              <span className="card-toggle-desc">Muestra atributos destacados (Talla, Memoria, Material, Color) si están configurados.</span>
            </div>
            <div className="card-switch">
              <input
                type="checkbox"
                checked={!!showSpecs}
                onChange={(e) => updateConfig("card_show_specs", e.target.checked)}
              />
              <span className="card-switch-slider" />
            </div>
          </label>

          <label className="card-toggle-row">
            <div className="card-toggle-text">
              <span className="card-toggle-title">Hover a Segunda Imagen</span>
              <span className="card-toggle-desc">Si el producto tiene 2 o más fotos, muestra la segunda al posar el cursor sobre la tarjeta.</span>
            </div>
            <div className="card-switch">
              <input
                type="checkbox"
                checked={!!hoverSecondaryImg}
                onChange={(e) => updateConfig("card_hover_secondary_img", e.target.checked)}
              />
              <span className="card-switch-slider" />
            </div>
          </label>

          <label className="card-toggle-row">
            <div className="card-toggle-text">
              <span className="card-toggle-title">Micro-Zoom al Posar Cursor</span>
              <span className="card-toggle-desc">Efecto suave de acercamiento en la foto para realzar la textura del producto.</span>
            </div>
            <div className="card-switch">
              <input
                type="checkbox"
                checked={!!hoverZoom}
                onChange={(e) => updateConfig("card_hover_zoom", e.target.checked)}
              />
              <span className="card-switch-slider" />
            </div>
          </label>
        </div>
      </div>

      {/* 4. Estilo de Acción y Compra */}
      <div className="theme-panel-card">
        <div className="theme-card-header">
          <h3>
            <ShareIcon size={18} style={{ color: "var(--brand-primary)" }} />
            4. Estilo de Acción y Botón de Compra
          </h3>
          <p>Selecciona cómo interactúan los clientes con tus productos directamente desde el catálogo.</p>
        </div>

        <div className="card-action-grid">
          {[
            {
              type: "floating_plus",
              title: "Botón Circular Flotante (+)",
              desc: "Botón sobre la foto al estilo Zara/Apple. No ocupa espacio y mantiene la tarjeta limpia.",
            },
            {
              type: "footer_pill",
              title: "Botón Píldora Inferior",
              desc: "Botón alargado 'Añadir +' de alto contraste en el pie de la tarjeta.",
            },
            {
              type: "dual_action",
              title: "Doble Botón (Ver + Añadir)",
              desc: "Ofrece dos acciones independientes: botón para abrir detalle y botón para agregar al carrito.",
            },
            {
              type: "view_only",
              title: "Solo Ver Detalles",
              desc: "Botón sobrio 'Ver detalles'. Ideal para catálogos de cotización, consultas o muebles.",
            },
          ].map((act) => (
            <button
              type="button"
              key={act.type}
              className={`card-action-btn ${actionType === act.type ? "active" : ""}`}
              onClick={() => updateConfig("card_action_type", act.type)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="card-action-title">{act.title}</span>
                {actionType === act.type && (
                  <span style={{ color: "var(--brand-primary)", fontWeight: 700, fontSize: "0.75rem" }}>✓</span>
                )}
              </div>
              <span className="card-action-desc">{act.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 5. Simulador Interactivo de Tarjeta en Vivo */}
      <div className="card-simulator-wrapper">
        <div className="card-simulator-toolbar">
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <strong style={{ fontSize: "0.92rem", color: "var(--text-primary)" }}>
              Simulador Interactivo en Vivo
            </strong>
            <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
              Prueba la interacción, hover y botones tal como los experimentará tu cliente.
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <div className="card-simulator-states">
              {[
                { id: "in_stock", label: "En Stock" },
                { id: "sale", label: "En Oferta" },
                { id: "low_stock", label: "Stock Bajo" },
                { id: "out_of_stock", label: "Agotado" },
              ].map((st) => (
                <button
                  type="button"
                  key={st.id}
                  className={`card-sim-state-btn ${testState === st.id ? "active" : ""}`}
                  onClick={() => setTestState(st.id)}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="card-sim-state-btn"
              onClick={() => setTestDarkBg(!testDarkBg)}
              title="Cambiar fondo de prueba"
            >
              {testDarkBg ? "☀️ Fondo Claro" : "🌙 Fondo Oscuro"}
            </button>
          </div>
        </div>

        <div className={`card-simulator-stage ${testDarkBg ? "dark-bg" : "light-bg"}`}>
          <div
            className="card-interactive-preview"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
              borderRadius: `${radius}px`,
              boxShadow:
                shadow === "elevated"
                  ? "0 14px 35px rgba(0,0,0,0.16)"
                  : shadow === "soft"
                  ? "0 4px 18px rgba(0,0,0,0.08)"
                  : "none",
              border:
                border === "contrast"
                  ? "1.5px solid rgba(0,0,0,0.22)"
                  : border === "subtle"
                  ? "1px solid rgba(0,0,0,0.08)"
                  : "none",
            }}
          >
            {/* Media Area */}
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: aspectCss,
                overflow: "hidden",
                background: "#f1f5f9",
                borderRadius: `${Math.max(radius - 2, 0)}px ${Math.max(radius - 2, 0)}px 0 0`,
              }}
            >
              <img
                src={isHovered && hoverSecondaryImg ? mockProduct.secondaryImage : mockProduct.primaryImage}
                alt="Demo"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: imageFit,
                  transition: "transform 0.35s ease, opacity 0.25s ease",
                  transform: isHovered && hoverZoom ? "scale(1.06)" : "scale(1)",
                  display: "block",
                }}
              />

              {/* Badges */}
              <div style={{ position: "absolute", top: "8px", left: "8px", display: "flex", gap: "4px", zIndex: 2 }}>
                {showDiscountBadge && (testState === "sale" || testState === "in_stock") && (
                  <span
                    style={{
                      background: cfg.primary,
                      color: "#fff",
                      fontSize: "0.68rem",
                      fontWeight: 800,
                      padding: "3px 7px",
                      borderRadius: "6px",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                    }}
                  >
                    -{mockProduct.discount}
                  </span>
                )}
                {testState === "out_of_stock" && (
                  <span
                    style={{
                      background: "#ef4444",
                      color: "#fff",
                      fontSize: "0.68rem",
                      fontWeight: 800,
                      padding: "3px 7px",
                      borderRadius: "6px",
                    }}
                  >
                    Agotado
                  </span>
                )}
              </div>

              {/* Floating button */}
              {actionType === "floating_plus" && (
                <button
                  type="button"
                  onClick={handleTestClick}
                  disabled={!isAvailable}
                  style={{
                    position: "absolute",
                    bottom: "10px",
                    right: "10px",
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: addedAnimation ? "#10b981" : cfg.primary,
                    color: "#fff",
                    border: "none",
                    display: "grid",
                    placeItems: "center",
                    cursor: isAvailable ? "pointer" : "not-allowed",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.16)",
                    transition: "all 0.2s ease",
                    transform: addedAnimation ? "scale(1.15)" : "scale(1)",
                    opacity: isAvailable ? 1 : 0.45,
                    zIndex: 3,
                  }}
                  title={addedAnimation ? "¡Añadido!" : "Probar añadir al pedido"}
                >
                  {addedAnimation ? "✓" : "+"}
                </button>
              )}
            </div>

            {/* Card Body */}
            <div style={{ padding: "12px 14px 8px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {showSpecs && (
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                  {mockProduct.specs.map((sp, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: "0.68rem",
                        fontWeight: 600,
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: "rgba(0,0,0,0.06)",
                        color: testDarkBg ? "#94a3b8" : "#64748b",
                      }}
                    >
                      {sp}
                    </span>
                  ))}
                </div>
              )}

              <h4
                style={{
                  margin: 0,
                  fontSize: "0.92rem",
                  fontWeight: 700,
                  color: testDarkBg ? "#f8fafc" : "#0f172a",
                  lineHeight: 1.3,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {mockProduct.name}
              </h4>

              {showStock && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background:
                        mockProduct.stockClass === "out"
                          ? "#ef4444"
                          : mockProduct.stockClass === "low"
                          ? "#f59e0b"
                          : "#10b981",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      color:
                        mockProduct.stockClass === "out"
                          ? "#ef4444"
                          : mockProduct.stockClass === "low"
                          ? "#f59e0b"
                          : "#10b981",
                    }}
                  >
                    {mockProduct.stockText}
                  </span>
                </div>
              )}
            </div>

            {/* Card Footer */}
            <div
              style={{
                padding: "8px 14px 14px",
                display: "flex",
                flexDirection: actionType === "footer_pill" ? "column" : "row",
                justifyContent: "space-between",
                alignItems: actionType === "footer_pill" ? "stretch" : "center",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                <span
                  style={{
                    fontSize: "1.05rem",
                    fontWeight: 800,
                    color: cfg.primary,
                  }}
                >
                  {symbol} {mockProduct.price}
                </span>
                {(testState === "sale" || testState === "in_stock") && (
                  <span style={{ fontSize: "0.76rem", color: "#94a3b8", textDecoration: "line-through" }}>
                    {symbol} {mockProduct.originalPrice}
                  </span>
                )}
              </div>

              {actionType === "footer_pill" && (
                <button
                  type="button"
                  onClick={handleTestClick}
                  disabled={!isAvailable}
                  style={{
                    width: "100%",
                    height: "34px",
                    borderRadius: "999px",
                    background: addedAnimation ? "#10b981" : cfg.primary,
                    color: "#fff",
                    border: "none",
                    fontWeight: 700,
                    fontSize: "0.78rem",
                    cursor: isAvailable ? "pointer" : "not-allowed",
                    opacity: isAvailable ? 1 : 0.45,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    transition: "all 0.18s ease",
                  }}
                >
                  {addedAnimation ? "✓ Agregado al pedido" : "+ Añadir al pedido"}
                </button>
              )}

              {actionType === "dual_action" && (
                <div style={{ display: "flex", gap: "4px" }}>
                  <button
                    type="button"
                    style={{
                      padding: "5px 9px",
                      borderRadius: "6px",
                      border: "1px solid rgba(0,0,0,0.1)",
                      background: "transparent",
                      fontSize: "0.74rem",
                      fontWeight: 600,
                      color: testDarkBg ? "#f8fafc" : "#1e293b",
                      cursor: "pointer",
                    }}
                  >
                    Ver
                  </button>
                  <button
                    type="button"
                    onClick={handleTestClick}
                    disabled={!isAvailable}
                    style={{
                      padding: "5px 9px",
                      borderRadius: "6px",
                      border: "none",
                      background: addedAnimation ? "#10b981" : cfg.primary,
                      color: "#fff",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      cursor: isAvailable ? "pointer" : "not-allowed",
                      opacity: isAvailable ? 1 : 0.45,
                    }}
                  >
                    {addedAnimation ? "✓" : "+ Añadir"}
                  </button>
                </div>
              )}

              {(actionType === "floating_plus" || actionType === "view_only") && (
                <span
                  style={{
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    color: cfg.primary,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "2px",
                  }}
                >
                  {actionType === "view_only" ? "Ver detalles →" : "Ver →"}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   SECTOR TEXT PRESETS & CATALOG TEXT STUDIO
   ========================================================================== */

const SECTOR_TEXT_PRESETS = [
  {
    id: "vehiculos",
    label: "🚗 Vehículos & Autos",
    kicker: "VEHÍCULOS SELECCIONADOS",
    title: "",
    subtitle: "Autos seminuevos certificados, repuestos y servicio integral con entrega inmediata.",
    offer: "🚗 Financiamiento disponible y garantía certificada de 1 año",
  },
  {
    id: "moda",
    label: "👗 Ropa & Moda",
    kicker: "NUEVA COLECCIÓN",
    title: "",
    subtitle: "Prendas de autor, calzado y accesorios seleccionados para realzar tu estilo propio.",
    offer: "✨ 20% OFF en prendas seleccionadas de temporada",
  },
  {
    id: "cosmetica",
    label: "💄 Cosmética & Belleza",
    kicker: "CUIDADO & BIENESTAR",
    title: "",
    subtitle: "Fórmulas puras, cosmética premium y tratamientos para cuidar de ti todos los días.",
    offer: "🌸 Envío gratis en compras mayores a Bs. 150",
  },
  {
    id: "muebles",
    label: "🛋️ Muebles & Hogar",
    kicker: "ESPACIOS CON ESTILO",
    title: "",
    subtitle: "Muebles, iluminación y detalles cálidos que transforman cada rincón de tu hogar.",
    offer: "📦 Envíos protegidos y servicio de armado a domicilio",
  },
  {
    id: "tecnologia",
    label: "💻 Tecnología & Gadgets",
    kicker: "INNOVACIÓN DIGITAL",
    title: "",
    subtitle: "Gadgets de última generación, accesorios inteligentes y electrónica con garantía oficial.",
    offer: "⚡ Despacho express en 24 horas y garantía de fábrica",
  },
  {
    id: "gastronomia",
    label: "🍔 Gastronomía & Café",
    kicker: "SABOR ARTESANAL",
    title: "",
    subtitle: "Elaborado fresco cada mañana con ingredientes seleccionados y dedicación artesanal.",
    offer: "🔥 Promoción del día: combos familiares con 15% de descuento",
  },
  {
    id: "general",
    label: "📦 Tienda Multirubro",
    kicker: "CATÁLOGO OFICIAL",
    title: "",
    subtitle: "Catálogo completo con productos seleccionados, stock en tiempo real y envíos rápidos.",
    offer: "🔥 Descuentos especiales por tiempo limitado",
  },
];

function CatalogTextEditor({ form, updateConfig, setOk }) {
  const cfg = form.theme_config;

  const applySectorText = (preset) => {
    updateConfig("hero_kicker", preset.kicker);
    if (preset.title) updateConfig("hero_title", preset.title);
    updateConfig("hero_subtitle", preset.subtitle);
    updateConfig("hero_offer_text", preset.offer);
    if (setOk) setOk(`Textos sugeridos de "${preset.label}" cargados. Puedes editarlos libremente.`);
  };

  return (
    <div className="theme-panel-card">
      <div className="theme-card-header">
        <h3>
          <LayoutIcon size={18} style={{ color: "var(--brand-primary)" }} />
          Textos y Encabezados del Catálogo
        </h3>
        <p>
          Personaliza los textos para que se adapten a tu negocio (ropa, vehículos, cosmética, tecnología, muebles, etc.). Los cambios se ven al instante en el simulador.
        </p>
      </div>

      {/* Sugerencias rápidas por rubro comercial */}
      <div style={{ marginBottom: "16px" }}>
        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Sugerencias rápidas por rubro (1 Clic)
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {SECTOR_TEXT_PRESETS.map((preset) => (
            <button
              type="button"
              key={preset.id}
              onClick={() => applySectorText(preset)}
              style={{
                fontSize: "0.78rem",
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: "999px",
                border: "1px solid var(--border-subtle)",
                background: "var(--bg-surface-elevated, var(--bg-surface))",
                color: "var(--text-primary)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--brand-primary)";
                e.currentTarget.style.color = "var(--brand-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-subtle)";
                e.currentTarget.style.color = "var(--text-primary)";
              }}
              title={`Cargar textos de ejemplo para ${preset.label}`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div className="theme-grid-2col" style={{ gap: "14px" }}>
          <label>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>
              Etiqueta o Kicker Superior
            </span>
            <input
              type="text"
              placeholder="Ej: NUEVA COLECCIÓN, VEHÍCULOS SELECCIONADOS..."
              value={cfg.hero_kicker || ""}
              onChange={(e) => updateConfig("hero_kicker", e.target.value)}
            />
            <small style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
              Antetítulo o etiqueta superior destacada.
            </small>
          </label>

          <label>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>
              Título o Slogan Principal
            </span>
            <input
              type="text"
              placeholder="Dejar vacío para usar el nombre de la tienda"
              value={cfg.hero_title || ""}
              onChange={(e) => updateConfig("hero_title", e.target.value)}
            />
            <small style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
              Opcional. Si se deja vacío se muestra el nombre de tu tienda.
            </small>
          </label>
        </div>

        <label>
          <span style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>
            Subtítulo o Propuesta de Valor
          </span>
          <textarea
            rows={2}
            placeholder="Describe tu propuesta de valor, tipo de productos o lema de tu tienda..."
            value={cfg.hero_subtitle || ""}
            onChange={(e) => updateConfig("hero_subtitle", e.target.value)}
            style={{ width: "100%", resize: "vertical", boxSizing: "border-box" }}
          />
          <small style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
            Texto descriptivo que se adapta a cualquier rubro (muebles, vehículos, ropa, etc.).
          </small>
        </label>

        <label>
          <span style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>
            Cintillo Promocional / Ticker de Ofertas
          </span>
          <input
            type="text"
            placeholder="Ej: 🔥 ENVÍO GRATIS EN PEDIDOS MAYORES A BS 100 • FINANCIAMIENTO DISPONIBLE"
            value={cfg.hero_offer_text || ""}
            onChange={(e) => updateConfig("hero_offer_text", e.target.value)}
          />
          <small style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
            Aparece como banner destacado de ofertas, cintillo o ticker de novedades.
          </small>
        </label>
      </div>
    </div>
  );
}

/* ==========================================================================
   MAIN COMPONENT: THEME APPEARANCE SCREEN
   ========================================================================== */

export default function ThemeAppearanceScreen({ isSuperadmin, Card, HelperText, StoreRefPicker }) {
  const [stores, setStores] = useState([]);
  const [tenantId, setTenantId] = useState("");
  const [store, setStore] = useState(null);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(buildForm("modern_banner"));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [analyzingPalette, setAnalyzingPalette] = useState(false);
  const [paletteSuggestions, setPaletteSuggestions] = useState([]);
  const [iconUploadingFor, setIconUploadingFor] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  // Tabs state: "presets_colors", "branding", "categories", "social", "general"
  const [activeTab, setActiveTab] = useState("presets_colors");

  // Device view mode: "mobile" | "desktop"
  const [deviceMode, setDeviceMode] = useState("mobile");

  // General Store info (Currency + Whatsapp)
  const [storeWhatsapp, setStoreWhatsapp] = useState("");
  const [storeCurrency, setStoreCurrency] = useState("S/");
  const [savingGeneral, setSavingGeneral] = useState(false);

  const selectedStore = useMemo(
    () => stores.find((item) => item.id_tienda === tenantId) || null,
    [stores, tenantId]
  );

  const selectedStoreRef = isSuperadmin
    ? selectedStore?.slug || selectedStore?.nombre_tienda || ""
    : undefined;

  const syncStore = (targetStore) => {
    setStore(targetStore);
    setForm(buildForm(targetStore?.theme_id || "modern_banner", targetStore?.theme_config));
    if (targetStore) {
      setStoreWhatsapp(targetStore.whatsapp_number || "");
      setStoreCurrency(targetStore.currency_symbol || "S/");
    }
  };

  const loadCategories = async (storeRef) => {
    try {
      const data = await api.listCategorias(storeRef);
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      setCategories([]);
    }
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      if (isSuperadmin) {
        const data = await api.adminListTiendas();
        setStores(data);
        const activeId = tenantId || data[0]?.id_tienda || "";
        setTenantId(activeId);
        const targetStore = data.find((item) => item.id_tienda === activeId) || null;
        syncStore(targetStore);
        await loadCategories(targetStore?.slug || targetStore?.nombre_tienda || "");
      } else {
        const myStore = await api.adminGetMyStore();
        syncStore(myStore);
        await loadCategories(undefined);
      }
    } catch (err) {
      setError(err.message || "No se pudo cargar la configuración de apariencia");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!isSuperadmin || !tenantId || stores.length === 0) return;
    const targetStore = stores.find((item) => item.id_tienda === tenantId) || null;
    syncStore(targetStore);
    loadCategories(targetStore?.slug || targetStore?.nombre_tienda || "");
  }, [isSuperadmin, tenantId, stores]);

  const updateThemeId = (themeId) => {
    setForm((current) => buildPresetForm(themeId, current.theme_config));
    setOk(`Plantilla aplicada: ${THEME_PRESETS[themeId].label}. Tus logos y portadas cargadas se mantuvieron.`);
    setError("");
  };

  const resetCurrentTheme = () => {
    if (window.confirm("¿Deseas restablecer los colores y estilos de la plantilla? Tus logos y portadas cargadas se conservarán.")) {
      setForm((current) => buildPresetForm(current.theme_id, current.theme_config));
      setOk(`Plantilla restablecida a valores por defecto: ${THEME_PRESETS[form.theme_id].label}`);
      setError("");
    }
  };

  const updateConfig = (key, value) => {
    setForm((current) => ({
      ...current,
      theme_config: {
        ...current.theme_config,
        [key]: value,
      },
    }));
  };

  const updateCategoryImage = (categoryId, url) => {
    setForm((current) => ({
      ...current,
      theme_config: {
        ...current.theme_config,
        category_images: {
          ...(current.theme_config.category_images || {}),
          [String(categoryId)]: url,
        },
      },
    }));
  };

  const saveTheme = async (event) => {
    if (event) event.preventDefault();
    setSaving(true);
    setError("");
    setOk("");
    try {
      const payload = {
        theme_id: form.theme_id,
        theme_config: form.theme_config,
      };
      const updated = isSuperadmin
        ? await api.adminUpdateTiendaTheme(tenantId, payload)
        : await api.meUpdateTheme(payload);

      setOk("¡Tema y apariencia guardados exitosamente!");
      syncStore(updated);
      if (isSuperadmin) {
        setStores((current) =>
          current.map((item) => (item.id_tienda === updated.id_tienda ? updated : item))
        );
      }
    } catch (err) {
      setError(err.message || "No se pudo guardar el tema");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGeneral = async (e) => {
    e.preventDefault();
    setSavingGeneral(true);
    setError("");
    setOk("");
    try {
      const updated = await api.adminUpdateMyStore({
        whatsapp_number: storeWhatsapp || null,
        currency_symbol: storeCurrency || "S/",
      });
      syncStore(updated);
      setOk("Ajustes generales de la tienda actualizados con éxito");
    } catch (err) {
      setError(err.message || "No se pudo actualizar los ajustes generales");
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleThemeAssetUpload = async (file, onSuccess, mode = "Banner") => {
    if (!file) return;
    setError("");
    setOk("");
    try {
      const uploaded = await api.uploadThemeBanner(file, selectedStoreRef);
      onSuccess(uploaded.hero_image_url || uploaded.url || "");
      setOk(`${mode} subido correctamente. Recuerda guardar el tema para publicar.`);
    } catch (err) {
      setError(err.message || `No se pudo subir ${mode.toLowerCase()}`);
    }
  };

  const handleBannerUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setAnalyzingPalette(true);
    const analysis = buildPaletteSuggestions(file)
      .then(setPaletteSuggestions)
      .catch(() => setPaletteSuggestions([]))
      .finally(() => setAnalyzingPalette(false));

    await handleThemeAssetUpload(file, (url) => updateConfig("hero_image_url", url), "Banner");
    await analysis;
    setUploading(false);
  };

  const handleLogoUpload = async (file) => {
    if (!file) return;
    setLogoUploading(true);
    setAnalyzingPalette(true);
    const analysis = buildPaletteSuggestions(file)
      .then(setPaletteSuggestions)
      .catch(() => setPaletteSuggestions([]))
      .finally(() => setAnalyzingPalette(false));

    await handleThemeAssetUpload(file, (url) => updateConfig("hero_logo_url", url), "Logo");
    await analysis;
    setLogoUploading(false);
  };

  const applyPalette = (colors) => {
    setForm((current) => ({
      ...current,
      theme_config: { ...current.theme_config, ...colors },
    }));
    setOk("Paleta inteligente aplicada al tema. Guarda para persistir cambios.");
  };

  const handleCategoryIconUpload = async (categoryId, file) => {
    if (!categoryId) return;
    setIconUploadingFor(String(categoryId));
    await handleThemeAssetUpload(file, (url) => updateCategoryImage(categoryId, url), "Ícono");
    setIconUploadingFor("");
  };

  return (
    <div className="theme-studio-container">
      {/* Top Header & Global Actions */}
      <div className="theme-studio-topbar">
        <div className="theme-studio-meta">
          <div className="theme-studio-badge-row">
            <h1 className="theme-studio-title">Estudio de Tema y Apariencia</h1>
            <span className="theme-studio-badge">
              <TemaIcon size={14} />
              {THEME_PRESETS[form.theme_id]?.label || "Modern Banner"}
            </span>
            {store && (
              <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 600 }}>
                • {store.nombre_tienda} ({store.slug})
              </span>
            )}
          </div>
          <p className="theme-studio-desc">
            Personaliza colores, banners, tipografía y la experiencia visual de tu tienda en tiempo real.
          </p>
        </div>

        <div className="theme-studio-actions">
          {isSuperadmin && StoreRefPicker && (
            <div className="theme-store-picker-wrap">
              <StoreRefPicker
                stores={stores}
                value={tenantId}
                onChange={setTenantId}
                required
                label=""
                placeholder="Seleccionar tienda..."
                helpText=""
              />
            </div>
          )}

          <button
            type="button"
            className="btn btn-ghost"
            onClick={resetCurrentTheme}
            title="Restablecer a valores de la plantilla"
          >
            Restablecer
          </button>

          <button
            type="button"
            className="theme-save-btn"
            disabled={saving || (isSuperadmin && !tenantId)}
            onClick={saveTheme}
          >
            {saving ? "Guardando..." : "Guardar y publicar"}
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {error ? (
        <div className="alert alert-danger" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{error}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setError("")}>✕</button>
        </div>
      ) : null}

      {ok ? (
        <div className="alert alert-success" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{ok}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOk("")}>✕</button>
        </div>
      ) : null}

      {/* Studio Navigation Tabs */}
      <div className="theme-studio-nav">
        <button
          type="button"
          className={`theme-tab-pill ${activeTab === "presets_colors" ? "active" : ""}`}
          onClick={() => setActiveTab("presets_colors")}
        >
          <PaletteIcon size={16} />
          <span>Plantillas y Colores</span>
        </button>

        <button
          type="button"
          className={`theme-tab-pill ${activeTab === "branding" ? "active" : ""}`}
          onClick={() => setActiveTab("branding")}
        >
          <LayoutIcon size={16} />
          <span>Identidad, Textos y Banner</span>
        </button>

        <button
          type="button"
          className={`theme-tab-pill ${activeTab === "cards" ? "active" : ""}`}
          onClick={() => setActiveTab("cards")}
        >
          <SparklesIcon size={16} />
          <span>Editor de Tarjetas</span>
        </button>

        <button
          type="button"
          className={`theme-tab-pill ${activeTab === "categories" ? "active" : ""}`}
          onClick={() => setActiveTab("categories")}
        >
          <TagIcon size={16} />
          <span>Estilos de Categorías</span>
        </button>

        <button
          type="button"
          className={`theme-tab-pill ${activeTab === "social" ? "active" : ""}`}
          onClick={() => setActiveTab("social")}
        >
          <ShareIcon size={16} />
          <span>Contacto y Redes</span>
        </button>

        <button
          type="button"
          className={`theme-tab-pill ${activeTab === "general" ? "active" : ""}`}
          onClick={() => setActiveTab("general")}
        >
          <SlidersIcon size={16} />
          <span>Ajustes Generales</span>
        </button>
      </div>

      {/* Main 2-Column Studio Grid */}
      <div className="theme-studio-layout">
        {/* Left Column: Panel Controls */}
        <div className="theme-controls-pane">
          {/* TAB 1: PLANTILLAS Y COLORES */}
          {activeTab === "presets_colors" && (
            <>
              {/* Presets Card */}
              <div className="theme-panel-card">
                <div className="theme-card-header">
                  <h3>
                    <LayoutIcon size={18} style={{ color: "var(--brand-primary)" }} />
                    1. Elige una Plantilla Base
                  </h3>
                  <p>Selecciona una estructura inicial. Podrás modificar cualquier color sin perder cambios.</p>
                </div>

                <div className="theme-preset-grid">
                  {Object.keys(THEME_PRESETS).map((tId) => (
                    <ThemePresetCard
                      key={tId}
                      themeId={tId}
                      active={form.theme_id === tId}
                      onClick={() => updateThemeId(tId)}
                    />
                  ))}
                </div>
              </div>

              {/* Color Matrix Card */}
              <div className="theme-panel-card">
                <div className="theme-card-header">
                  <h3>
                    <PaletteIcon size={18} style={{ color: "var(--brand-primary)" }} />
                    2. Paleta de Colores de Marca
                  </h3>
                  <p>Define los colores representativos de tu tienda online.</p>
                </div>

                <div className="theme-color-matrix">
                  <div className="theme-color-item">
                    <label>
                      <span>Color Principal (Botones, Acentos)</span>
                    </label>
                    <div className="theme-color-input-pill">
                      <input
                        type="color"
                        value={form.theme_config.primary}
                        onChange={(e) => updateConfig("primary", e.target.value)}
                      />
                      <span className="theme-color-hex">{form.theme_config.primary}</span>
                    </div>
                  </div>

                  <div className="theme-color-item">
                    <label>
                      <span>Color Secundario (Acentos Suaves)</span>
                    </label>
                    <div className="theme-color-input-pill">
                      <input
                        type="color"
                        value={form.theme_config.secondary}
                        onChange={(e) => updateConfig("secondary", e.target.value)}
                      />
                      <span className="theme-color-hex">{form.theme_config.secondary}</span>
                    </div>
                  </div>

                  <div className="theme-color-item">
                    <label>
                      <span>Color de Texto Principal</span>
                    </label>
                    <div className="theme-color-input-pill">
                      <input
                        type="color"
                        value={form.theme_config.text}
                        onChange={(e) => updateConfig("text", e.target.value)}
                      />
                      <span className="theme-color-hex">{form.theme_config.text}</span>
                    </div>
                  </div>

                  <div className="theme-color-item">
                    <label>
                      <span>Color de Texto Atenuado</span>
                    </label>
                    <div className="theme-color-input-pill">
                      <input
                        type="color"
                        value={form.theme_config.muted}
                        onChange={(e) => updateConfig("muted", e.target.value)}
                      />
                      <span className="theme-color-hex">{form.theme_config.muted}</span>
                    </div>
                  </div>
                </div>

                {/* Background Selector */}
                <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  <label>
                    <span style={{ fontWeight: 600, fontSize: "0.85rem", display: "block", marginBottom: "6px" }}>
                      Tipo de Fondo del Catálogo
                    </span>
                    <select
                      value={form.theme_config.background_type || "solid"}
                      onChange={(e) => updateConfig("background_type", e.target.value)}
                    >
                      <option value="solid">Color sólido (Sobrio y limpio)</option>
                      <option value="linear">Degradado lineal (Moderno)</option>
                      <option value="radial">Degradado radial (Focal)</option>
                    </select>
                  </label>

                  {form.theme_config.background_type === "linear" || form.theme_config.background_type === "radial" ? (
                    <div className="theme-grid-2col" style={{ gap: "12px" }}>
                      <div className="theme-color-item">
                        <label>Color Inicio</label>
                        <div className="theme-color-input-pill">
                          <input
                            type="color"
                            value={form.theme_config.background_gradient_start || form.theme_config.secondary}
                            onChange={(e) => updateConfig("background_gradient_start", e.target.value)}
                          />
                          <span className="theme-color-hex">
                            {form.theme_config.background_gradient_start || form.theme_config.secondary}
                          </span>
                        </div>
                      </div>

                      <div className="theme-color-item">
                        <label>Color Fin</label>
                        <div className="theme-color-input-pill">
                          <input
                            type="color"
                            value={form.theme_config.background_gradient_end || form.theme_config.background}
                            onChange={(e) => updateConfig("background_gradient_end", e.target.value)}
                          />
                          <span className="theme-color-hex">
                            {form.theme_config.background_gradient_end || form.theme_config.background}
                          </span>
                        </div>
                      </div>

                      {form.theme_config.background_type === "linear" && (
                        <div style={{ gridColumn: "1 / -1" }}>
                          <div className="theme-range-row">
                            <div className="theme-range-header">
                              <span>Ángulo del Degradado</span>
                              <span className="theme-range-badge">{form.theme_config.background_gradient_angle ?? 135}°</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="360"
                              step="15"
                              value={form.theme_config.background_gradient_angle ?? 135}
                              onChange={(e) => updateConfig("background_gradient_angle", Number(e.target.value))}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="theme-color-item">
                      <label>Color de Fondo Sólido</label>
                      <div className="theme-color-input-pill">
                        <input
                          type="color"
                          value={form.theme_config.background}
                          onChange={(e) => updateConfig("background", e.target.value)}
                        />
                        <span className="theme-color-hex">{form.theme_config.background}</span>
                      </div>
                    </div>
                  )}

                  {/* Quick Gradient Swatches */}
                  <div className="theme-gradient-presets">
                    <span className="preset-label">Fondos Prediseñados Rápidos:</span>
                    <div className="preset-swatches">
                      {GRADIENT_PRESETS.map((gp) => (
                        <button
                          key={gp.name}
                          type="button"
                          className="preset-swatch-btn"
                          title={gp.name}
                          style={{ background: `linear-gradient(135deg, ${gp.start}, ${gp.end})` }}
                          onClick={() => {
                            setForm((cur) => ({
                              ...cur,
                              theme_config: {
                                ...cur.theme_config,
                                background_type: gp.type,
                                background_gradient_start: gp.start,
                                background_gradient_end: gp.end,
                                background_gradient_angle: gp.angle,
                              },
                            }));
                            setOk(`Fondo aplicado: ${gp.name}`);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Typography & Geometry Card */}
              <div className="theme-panel-card">
                <div className="theme-card-header">
                  <h3>
                    <SlidersIcon size={18} style={{ color: "var(--brand-primary)" }} />
                    3. Geometría y Visibilidad
                  </h3>
                  <p>Ajusta el radio de bordes de las tarjetas y visibilidad de secciones.</p>
                </div>

                <div className="theme-range-row">
                  <div className="theme-range-header">
                    <span>Redondeado de Tarjetas y Botones</span>
                    <span className="theme-range-badge">{form.theme_config.radius} px</span>
                  </div>
                  <input
                    type="range"
                    min="8"
                    max="24"
                    step="2"
                    value={form.theme_config.radius}
                    onChange={(e) => updateConfig("radius", Number(e.target.value))}
                  />
                </div>

                <div className="theme-grid-2col" style={{ gap: "12px", marginTop: "12px" }}>
                  <label>
                    <span style={{ fontSize: "0.84rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                      Proporción de Foto en Tarjetas (Aspect Ratio)
                    </span>
                    <select
                      value={form.theme_config.card_aspect_ratio || "3:4"}
                      onChange={(e) => updateConfig("card_aspect_ratio", e.target.value)}
                    >
                      <option value="3:4">Vertical Editorial 3:4 (Moda, Ropa, Calzado, Cosmética)</option>
                      <option value="4:5">Vertical Streetwear 4:5 (Streetwear, Sneakers, Vestimenta)</option>
                      <option value="1:1">Cuadrado Universal 1:1 (Joyas, Gadgets, Gastronomía)</option>
                      <option value="4:3">Horizontal Panorámico 4:3 (Muebles, Hogar, Laptops)</option>
                    </select>
                  </label>

                  <label>
                    <span style={{ fontSize: "0.84rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                      Escala de Texto
                    </span>
                    <select
                      value={form.theme_config.font_scale}
                      onChange={(e) => updateConfig("font_scale", e.target.value)}
                    >
                      <option value="sm">Compacta (Pequeña)</option>
                      <option value="md">Estándar (Equilibrada)</option>
                      <option value="lg">Prominente (Grande)</option>
                    </select>
                  </label>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" }}>
                  <label className="check-row" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="checkbox"
                      checked={!!form.theme_config.show_offers}
                      onChange={(e) => updateConfig("show_offers", e.target.checked)}
                    />
                    <span style={{ fontSize: "0.84rem", fontWeight: 600 }}>Mostrar bloque de Ofertas</span>
                  </label>

                  <label className="check-row" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="checkbox"
                      checked={!!form.theme_config.show_featured}
                      onChange={(e) => updateConfig("show_featured", e.target.checked)}
                    />
                    <span style={{ fontSize: "0.84rem", fontWeight: 600 }}>Mostrar Productos Destacados</span>
                  </label>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: IDENTIDAD VISUAL, TEXTOS Y BANNER */}
          {activeTab === "branding" && (
            <>
              <CatalogTextEditor
                form={form}
                updateConfig={updateConfig}
                setOk={setOk}
              />

              <div className="theme-panel-card">
                <div className="theme-card-header">
                  <h3>
                    <LayoutIcon size={18} style={{ color: "var(--brand-primary)" }} />
                    Logo Superior y Banner Hero
                  </h3>
                  <p>Configura las imágenes principales de la cabecera de tu tienda virtual.</p>
                </div>

              <div className="theme-asset-grid">
                {/* Logo Uploader */}
                <div className="theme-asset-card">
                  <div className="theme-asset-card-head">
                    <div>
                      <strong>Logo de Encabezado</strong>
                      <span>PNG o WebP transparente recomendado</span>
                    </div>
                    {form.theme_config.hero_logo_url ? (
                      <button
                        type="button"
                        className="theme-remove-asset"
                        onClick={() => updateConfig("hero_logo_url", "")}
                      >
                        Quitar
                      </button>
                    ) : null}
                  </div>

                  <ImageDropZone
                    className="theme-asset-dropzone theme-logo-dropzone"
                    title={form.theme_config.hero_logo_url ? "Arrastra para reemplazar el logo" : "Arrastra aquí tu logo"}
                    subtitle="Formatos PNG, JPG, WebP · Hasta 5 MB"
                    previewUrl={form.theme_config.hero_logo_url ? buildAssetUrl(form.theme_config.hero_logo_url) : ""}
                    previewAlt="Logo actual"
                    statusText={logoUploading ? "Subiendo logo…" : ""}
                    buttonLabel={form.theme_config.hero_logo_url ? "Cambiar logo" : "Elegir archivo"}
                    disabled={logoUploading}
                    onFileSelected={handleLogoUpload}
                  />
                </div>

                {/* Banner Uploader */}
                <div className="theme-asset-card">
                  <div className="theme-asset-card-head">
                    <div>
                      <strong>Banner Superior (Hero)</strong>
                      <span>Recomendado: 1600 × 400 px</span>
                    </div>
                    {form.theme_config.hero_image_url ? (
                      <button
                        type="button"
                        className="theme-remove-asset"
                        onClick={() => updateConfig("hero_image_url", "")}
                      >
                        Quitar
                      </button>
                    ) : null}
                  </div>

                  <ImageDropZone
                    className="theme-asset-dropzone theme-banner-dropzone"
                    title={form.theme_config.hero_image_url ? "Arrastra para reemplazar banner" : "Arrastra aquí el banner"}
                    subtitle="Formatos JPG, WebP · Hasta 5 MB"
                    previewUrl={form.theme_config.hero_image_url ? buildAssetUrl(form.theme_config.hero_image_url) : ""}
                    previewAlt="Banner actual"
                    statusText={uploading ? "Subiendo banner…" : ""}
                    buttonLabel={form.theme_config.hero_image_url ? "Cambiar banner" : "Elegir archivo"}
                    disabled={uploading}
                    onFileSelected={handleBannerUpload}
                  />
                </div>
              </div>

              {/* Banner Fit Mode */}
              <label style={{ marginTop: "10px" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                  Ajuste de la Imagen del Banner
                </span>
                <select
                  value={form.theme_config.hero_image_fit || "cover"}
                  onChange={(e) => updateConfig("hero_image_fit", e.target.value)}
                >
                  <option value="cover">Llenar y recortar proporcionalmente (Cover - Recomendado)</option>
                  <option value="contain">Mostrar imagen completa sin recortar (Contain)</option>
                </select>
              </label>

              {/* Intelligent Palette Extractor */}
              <div className="theme-palette-assistant">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <SparklesIcon size={18} style={{ color: "var(--brand-primary)" }} />
                  <strong style={{ fontSize: "0.94rem", color: "var(--text-primary)" }}>
                    Extractor Inteligente de Paletas
                  </strong>
                </div>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  {analyzingPalette
                    ? "Analizando cromática de la imagen subida…"
                    : "Al subir un logo o banner, se extraen automáticamente 3 paletas equilibradas para aplicar con 1 clic."}
                </p>

                {paletteSuggestions.length > 0 ? (
                  <div className="theme-palette-grid">
                    {paletteSuggestions.map((palette) => (
                      <button
                        type="button"
                        key={palette.name}
                        className="theme-palette-btn"
                        onClick={() => applyPalette(palette.colors)}
                      >
                        <div className="theme-palette-swatches">
                          {Object.values(palette.colors).map((c, idx) => (
                            <span key={idx} style={{ background: c }} />
                          ))}
                        </div>
                        <strong>{palette.name}</strong>
                        <small>{palette.description}</small>
                        <em>Aplicar esta paleta</em>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: "14px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.82rem" }}>
                    Sube una imagen para obtener sugerencias armónicas automáticas.
                  </div>
                )}
              </div>
            </div>
            </>
          )}
 
          {/* TAB: EDITOR DE TARJETAS */}
          {activeTab === "cards" && (
            <InteractiveCardStudio
              form={form}
              updateConfig={updateConfig}
              symbol={storeCurrency}
              setOk={setOk}
            />
          )}

          {/* TAB 3: ESTILOS DE CATEGORÍAS */}
          {activeTab === "categories" && (
            <div className="theme-panel-card">
              <div className="theme-card-header">
                <h3>
                  <TagIcon size={18} style={{ color: "var(--brand-primary)" }} />
                  Estilo de Categorías del Catálogo
                </h3>
                <p>Elige entre navegación por botones simples (chips) o círculos con foto de categoría.</p>
              </div>

              <label>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                  Modo de Presentación de Categorías
                </span>
                <select
                  value={form.theme_config.category_style}
                  onChange={(e) => updateConfig("category_style", e.target.value)}
                >
                  <option value="chips">Botones simples deslizables (Chips)</option>
                  <option value="round_icons">Íconos redondos con foto personalizada</option>
                </select>
              </label>

              {form.theme_config.category_style === "round_icons" ? (
                <div style={{ marginTop: "14px" }}>
                  <div style={{ marginBottom: "12px" }}>
                    <strong style={{ fontSize: "0.92rem", color: "var(--text-primary)", display: "block" }}>
                      Fotos de Categorías
                    </strong>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      Sube una imagen para cada categoría. Si no se sube foto, se mostrará su inicial.
                    </span>
                  </div>

                  <div className="theme-category-icons-grid">
                    {categories.map((cat) => {
                      const catId = cat.id_categoria || cat.id;
                      const imgUrl = form.theme_config.category_images?.[String(catId)] || "";
                      const isBusy = iconUploadingFor === String(catId);

                      return (
                        <div key={catId} className="theme-category-icon-card">
                          <div className="theme-category-icon-preview">
                            {imgUrl ? (
                              <img src={buildAssetUrl(imgUrl)} alt={cat.nombre} />
                            ) : (
                              <span>{String(cat.nombre || "C").slice(0, 1)}</span>
                            )}
                          </div>

                          <div style={{ textAlign: "center", fontWeight: 700, fontSize: "0.88rem", color: "var(--text-primary)" }}>
                            {cat.nombre}
                          </div>

                          <label className="btn btn-ghost file-btn" style={{ textAlign: "center", cursor: "pointer" }}>
                            {isBusy ? "Subiendo…" : imgUrl ? "Cambiar foto" : "Subir foto"}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              disabled={isBusy}
                              style={{ display: "none" }}
                              onChange={(e) => handleCategoryIconUpload(catId, e.target.files?.[0])}
                            />
                          </label>
                        </div>
                      );
                    })}

                    {categories.length === 0 && (
                      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                        Aún no hay categorías registradas en esta tienda.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 4: CONTACTO Y REDES */}
          {activeTab === "social" && (
            <div className="theme-panel-card">
              <div className="theme-card-header">
                <h3>
                  <ShareIcon size={18} style={{ color: "var(--brand-primary)" }} />
                  Menú Lateral, Contacto y Redes Sociales
                </h3>
                <p>Información de atención que aparecerá en el menú lateral desplegable para el cliente.</p>
              </div>

              <div className="theme-grid-2col" style={{ gap: "16px" }}>
                <label>
                  <span>Título en el Menú</span>
                  <input
                    value={form.theme_config.side_menu_title || ""}
                    placeholder={store?.nombre_tienda || "Mi Tienda"}
                    onChange={(e) => updateConfig("side_menu_title", e.target.value)}
                  />
                </label>

                <label>
                  <span>Slogan o Horarios</span>
                  <input
                    value={form.theme_config.side_menu_text || ""}
                    placeholder="Atención lun a sáb 9:00 - 19:00"
                    onChange={(e) => updateConfig("side_menu_text", e.target.value)}
                  />
                </label>

                <label>
                  <span>WhatsApp de Atención al Cliente</span>
                  <input
                    value={form.theme_config.contact_whatsapp || ""}
                    placeholder="+591 70000000 o +51 999999999"
                    onChange={(e) => updateConfig("contact_whatsapp", e.target.value)}
                  />
                </label>

                <label>
                  <span>Teléfono Directo</span>
                  <input
                    value={form.theme_config.contact_phone || ""}
                    placeholder="+591 70000000"
                    onChange={(e) => updateConfig("contact_phone", e.target.value)}
                  />
                </label>

                <label>
                  <span>Correo Electrónico de Contacto</span>
                  <input
                    type="email"
                    value={form.theme_config.contact_email || ""}
                    placeholder="contacto@mitienda.com"
                    onChange={(e) => updateConfig("contact_email", e.target.value)}
                  />
                </label>

                <label>
                  <span>Instagram</span>
                  <input
                    value={form.theme_config.social_instagram || ""}
                    placeholder="@mitienda"
                    onChange={(e) => updateConfig("social_instagram", e.target.value)}
                  />
                </label>

                <label>
                  <span>TikTok</span>
                  <input
                    value={form.theme_config.social_tiktok || ""}
                    placeholder="@mitienda"
                    onChange={(e) => updateConfig("social_tiktok", e.target.value)}
                  />
                </label>

                <label>
                  <span>Facebook</span>
                  <input
                    value={form.theme_config.social_facebook || ""}
                    placeholder="mitienda o enlace a fanpage"
                    onChange={(e) => updateConfig("social_facebook", e.target.value)}
                  />
                </label>
              </div>
            </div>
          )}

          {/* TAB 5: AJUSTES GENERALES (MONEDA Y WHATSAPP TIENDA) */}
          {activeTab === "general" && (
            <div className="theme-panel-card">
              <div className="theme-card-header">
                <h3>
                  <SlidersIcon size={18} style={{ color: "var(--brand-primary)" }} />
                  Configuración Comercial y Moneda
                </h3>
                <p>Establece el número receptor de pedidos por WhatsApp y el símbolo monetario de tu catálogo.</p>
              </div>

              <form onSubmit={handleSaveGeneral} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <label>
                  <span style={{ fontWeight: 600, fontSize: "0.85rem", display: "block", marginBottom: "6px" }}>
                    Número de WhatsApp para Pedidos (Checkout)
                  </span>
                  <input
                    value={storeWhatsapp}
                    autoComplete="off"
                    placeholder="+591 70000000"
                    onChange={(e) => setStoreWhatsapp(e.target.value)}
                  />
                  <small style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginTop: "4px", display: "block" }}>
                    Usa formato internacional con código de país (ej. +591 o +51). A este número llegarán las órdenes del carrito.
                  </small>
                </label>

                <label>
                  <span style={{ fontWeight: 600, fontSize: "0.85rem", display: "block", marginBottom: "6px" }}>
                    Símbolo de Moneda (ej. Bs, S/, $, USD)
                  </span>
                  <input
                    value={storeCurrency}
                    autoComplete="off"
                    placeholder="Bs"
                    maxLength={10}
                    onChange={(e) => setStoreCurrency(e.target.value)}
                    required
                  />
                  <small style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginTop: "4px", display: "block" }}>
                    Símbolo monetario mostrado en los precios de los productos y comprobantes.
                  </small>
                </label>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingGeneral}
                  style={{ alignSelf: "flex-start", marginTop: "6px" }}
                >
                  {savingGeneral ? "Guardando ajustes…" : "Guardar Ajustes Comerciales"}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right Column: Sticky Live Store Simulator */}
        <div className="theme-simulator-sticky">
          <div className="theme-simulator-topbar">
            <div className="theme-live-tag">
              <span className="theme-live-dot" />
              <span>Vista Previa en Vivo</span>
            </div>

            <div className="theme-simulator-device-switch">
              <button
                type="button"
                className={`theme-device-btn ${deviceMode === "mobile" ? "active" : ""}`}
                onClick={() => setDeviceMode("mobile")}
                title="Vista móvil (360px)"
              >
                <SmartphoneIcon size={14} />
                <span>Móvil</span>
              </button>

              <button
                type="button"
                className={`theme-device-btn ${deviceMode === "desktop" ? "active" : ""}`}
                onClick={() => setDeviceMode("desktop")}
                title="Vista escritorio"
              >
                <MonitorIcon size={14} />
                <span>Escritorio</span>
              </button>
            </div>
          </div>

          {/* Simulator Canvas */}
          <LiveStoreSimulator
            storeName={store?.nombre_tienda}
            form={form}
            categories={categories.map((c) => ({
              id: c.id_categoria || c.id,
              nombre: c.nombre,
            }))}
            deviceMode={deviceMode}
            currencySymbol={storeCurrency}
          />

          <div style={{ textAlign: "center", fontSize: "0.78rem", color: "var(--text-muted)" }}>
            Los cambios se reflejan en tiempo real. Pulsa <strong>Guardar y publicar</strong> para aplicarlos a tus clientes.
          </div>
        </div>
      </div>
    </div>
  );
}
