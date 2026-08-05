import { useEffect, useMemo, useState } from "react";
import { api, buildAssetUrl } from "../api";

const THEME_PRESETS = {
  modern_banner: {
    label: "Modern Banner",
    description: "Banner superior, categorias visuales y bloques destacados.",
    config: {
      primary: "#E94B8A",
      secondary: "#F8BBD0",
      background: "#FFF7FA",
      text: "#1F1F1F",
      muted: "#6B7280",
      radius: 16,
      hero_image_url: "",
      hero_logo_url: "",
      hero_layout: "text_image",
      hero_kicker: "",
      hero_title: "",
      hero_subtitle: "Coleccion destacada, categorias visuales y ofertas activas.",
      hero_offer_text: "",
      hero_alignment: "left",
      hero_image_fit: "cover",
      category_images: {},
      show_offers: true,
      show_featured: true,
      category_style: "round_icons",
      font_scale: "md",
    },
  },
  soft_beige: {
    label: "Soft Beige",
    description: "Header limpio, tabs y grid editorial sobrio.",
    config: {
      primary: "#C89B8C",
      secondary: "#E7D3CA",
      background: "#F6EFEA",
      text: "#2B2B2B",
      muted: "#6B7280",
      radius: 18,
      hero_image_url: "",
      category_images: {},
      show_offers: true,
      show_featured: false,
      category_style: "chips",
      font_scale: "md",
    },
  },
  minimal_clean: {
    label: "Minimal Clean",
    description: "Vista simple sin banner, foco en producto y color.",
    config: {
      primary: "#6D28D9",
      secondary: "#EDE9FE",
      background: "#FFFFFF",
      text: "#111827",
      muted: "#6B7280",
      radius: 12,
      hero_image_url: "",
      category_images: {},
      show_offers: true,
      show_featured: false,
      category_style: "chips",
      font_scale: "sm",
    },
  },
};

const PREVIEW_PRODUCTS = [
  { id: "p1", nombre: "Producto estrella", precio: "S/ 29.90", badge: "Nuevo" },
  { id: "p2", nombre: "Oferta del dia", precio: "S/ 19.90", badge: "20% OFF" },
];

const toHex = ({ r, g, b }) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
const mix = (a, b, amount) => toHex({
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
  const colors = [...buckets].map(([key, count]) => {
    const [r, g, b] = key.split(",").map(Number);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return { r, g, b, count, saturation: max ? (max - min) / max : 0, light: (max + min) / 510 };
  }).sort((a, b) => b.count * (0.55 + b.saturation) - a.count * (0.55 + a.saturation));
  if (!colors.length) throw new Error("La imagen no contiene colores utilizables");
  const accent = colors.find((c) => c.saturation > 0.22 && c.light > 0.12 && c.light < 0.88) || colors[0];
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 12, g: 16, b: 24 };
  return [
    { name: "Equilibrada", description: "Conserva el color principal.", colors: { primary: toHex(accent), secondary: mix(accent, white, .65), background: mix(accent, white, .93), text: mix(accent, black, .82), muted: "#64748b" } },
    { name: "Suave", description: "Fondo claro y marca sutil.", colors: { primary: mix(accent, black, .12), secondary: mix(accent, white, .78), background: mix(accent, white, .97), text: "#1f2937", muted: "#6b7280" } },
    { name: "Contraste", description: "Base oscura y elegante.", colors: { primary: mix(accent, white, accent.light < .4 ? .38 : .08), secondary: mix(accent, black, .5), background: mix(accent, black, .82), text: "#f8fafc", muted: "#cbd5e1" } },
  ];
}

function normalizeThemeConfig(themeId, themeConfig) {
  const preset = THEME_PRESETS[themeId] || THEME_PRESETS.modern_banner;
  return {
    ...preset.config,
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

function buildPresetForm(themeId) {
  return buildForm(themeId, THEME_PRESETS[themeId]?.config || {});
}

function ThemePreviewCard({ themeId, active, onClick }) {
  const preset = THEME_PRESETS[themeId];
  const previewStyle = {
    "--preview-primary": preset.config.primary,
    "--preview-secondary": preset.config.secondary,
    "--preview-background": preset.config.background,
    "--preview-text": preset.config.text,
    "--preview-radius": `${preset.config.radius}px`,
  };
  return (
    <button
      type="button"
      className={`theme-preview-card ${active ? "active" : ""}`}
      style={previewStyle}
      onClick={onClick}
    >
      <div className="theme-preview-canvas">
        <div className="preview-bar" />
        <div className="preview-row">
          <span />
          <span />
          <span />
        </div>
        <div className="preview-grid">
          <div />
          <div />
          <div />
        </div>
      </div>
      <strong>{preset.label}</strong>
      <span>{preset.description}</span>
    </button>
  );
}

function PreviewCategory({ category, config, active }) {
  const imageUrl = config.category_images?.[String(category.id)] || "";
  return (
    <div className={`live-preview-category ${active ? "active" : ""}`}>
      {config.category_style === "round_icons" ? (
        <div className="live-preview-icon">
          {imageUrl ? (
            <img src={buildAssetUrl(imageUrl)} alt={category.nombre} />
          ) : (
            <span>{String(category.nombre || "C").slice(0, 1)}</span>
          )}
        </div>
      ) : null}
      <span>{category.nombre}</span>
    </div>
  );
}

function LiveThemePreview({ storeName, form, categories }) {
  const previewStyle = {
    "--live-primary": form.theme_config.primary,
    "--live-secondary": form.theme_config.secondary,
    "--live-background": form.theme_config.background,
    "--live-text": form.theme_config.text,
    "--live-muted": form.theme_config.muted,
    "--live-radius": `${form.theme_config.radius}px`,
  };
  const previewCategories = categories.slice(0, 4);
  const activeCategoryId = previewCategories[previewCategories.length - 1]?.id;
  const heroLayout = form.theme_config.hero_layout || "text_image";
  const logoUrl = form.theme_config.hero_logo_url || "";

  return (
    <section className="live-preview-card" style={previewStyle}>
      <div className={`live-preview-shell ${form.theme_id}`}>
        <div className={`live-preview-head hero-${heroLayout} align-${form.theme_config.hero_alignment || "left"}`}>
          {heroLayout === "logo_only" ? (
            <div className="live-preview-logo-only">
              {logoUrl ? <img src={buildAssetUrl(logoUrl)} alt="Logo" /> : <h4>{storeName || "Tienda Demo"}</h4>}
            </div>
          ) : null}
          {heroLayout !== "image_only" && heroLayout !== "logo_only" ? (
            <div>
              {logoUrl ? <img className="live-preview-logo" src={buildAssetUrl(logoUrl)} alt="Logo" /> : null}
              <small>{form.theme_config.hero_kicker || storeName || "Tienda Demo"}</small>
              <h4>{form.theme_config.hero_title || storeName || "Vista previa"}</h4>
              <p>{heroLayout === "offer" ? (form.theme_config.hero_offer_text || "Oferta especial") : (form.theme_config.hero_subtitle || "Asi se vera antes de guardar.")}</p>
            </div>
          ) : null}
          {form.theme_id === "modern_banner" && form.theme_config.hero_image_url && heroLayout !== "logo_only" ? (
            <img
              src={buildAssetUrl(form.theme_config.hero_image_url)}
              alt="Banner"
              className={`live-preview-hero fit-${form.theme_config.hero_image_fit || "cover"}`}
            />
          ) : null}
        </div>

        <div className={`live-preview-categories ${form.theme_config.category_style}`}>
          {(previewCategories.length ? previewCategories : [{ id: "all", nombre: "Todas" }]).map((category) => (
            <PreviewCategory
              key={category.id}
              category={category}
              config={form.theme_config}
              active={String(category.id) === String(activeCategoryId)}
            />
          ))}
        </div>

        {form.theme_config.show_featured ? (
          <div className="live-preview-block">
            <small>Destacados</small>
            <div className="live-preview-products">
              {PREVIEW_PRODUCTS.map((product) => (
                <article key={product.id} className="live-preview-product">
                  <div className="live-preview-thumb" />
                  <strong>{product.nombre}</strong>
                  <span>{product.precio}</span>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {form.theme_config.show_offers ? (
          <div className="live-preview-offer">
            <small>En oferta</small>
            <strong>Promo especial de temporada</strong>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ThemeAppearanceScreen({ isSuperadmin, Card, HelperText, StoreRefPicker }) {
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

  const selectedStore = useMemo(
    () => stores.find((item) => item.id_tienda === tenantId) || null,
    [stores, tenantId],
  );
  const selectedStoreRef = isSuperadmin
    ? selectedStore?.slug || selectedStore?.nombre_tienda || ""
    : undefined;

  const syncStore = (targetStore) => {
    setStore(targetStore);
    setForm(buildForm(targetStore?.theme_id || "modern_banner", targetStore?.theme_config));
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
      setError(err.message || "No se pudo cargar la apariencia");
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
    setForm(buildPresetForm(themeId));
    setOk(`Plantilla aplicada: ${THEME_PRESETS[themeId].label}`);
    setError("");
  };

  const resetCurrentTheme = () => {
    setForm(buildPresetForm(form.theme_id));
    setOk(`Plantilla restablecida: ${THEME_PRESETS[form.theme_id].label}`);
    setError("");
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
    event.preventDefault();
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
      setOk("Tema guardado");
      syncStore(updated);
      if (isSuperadmin) {
        setStores((current) =>
          current.map((item) => (item.id_tienda === updated.id_tienda ? updated : item)),
        );
      }
    } catch (err) {
      setError(err.message || "No se pudo guardar el tema");
    } finally {
      setSaving(false);
    }
  };

  const handleThemeAssetUpload = async (file, onSuccess, mode = "Banner") => {
    if (!file) return;
    setError("");
    setOk("");
    try {
      const uploaded = await api.uploadThemeBanner(file, selectedStoreRef);
      onSuccess(uploaded.hero_image_url || uploaded.url || "");
      setOk(`${mode} subido. Falta guardar para persistir cambios.`);
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
    setOk("Paleta aplicada en la vista previa. Guarda el tema para publicarla.");
  };

  const handleCategoryIconUpload = async (categoryId, file) => {
    if (!categoryId) return;
    setIconUploadingFor(String(categoryId));
    await handleThemeAssetUpload(file, (url) => updateCategoryImage(categoryId, url), "Icono");
    setIconUploadingFor("");
  };

  return (
    <div className="stack">
      <Card title="Apariencia del catalogo">
        {isSuperadmin ? (
          <div className="catalog-controls">
            <StoreRefPicker
              stores={stores}
              value={tenantId}
              onChange={setTenantId}
              required
              label="Tienda"
              placeholder="Buscar tienda..."
              helpText="Elige la tienda que quieres personalizar."
            />
            <div className="catalog-controls-spacer" />
          </div>
        ) : null}
        {store ? <p className="muted small">{store.nombre_tienda} ({store.slug})</p> : null}
        {loading ? <p className="muted">Cargando configuracion...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        {ok ? <p className="ok-text">{ok}</p> : null}
        {!loading && store ? (
          <form className="grid-form theme-form" onSubmit={saveTheme}>
            <div className="theme-section-head">
              <div><span>Paso 1</span><h3>Elige una plantilla</h3></div>
              <p>Puedes personalizarla después sin perder la vista previa.</p>
            </div>
            <div className="theme-preview-grid">
              {Object.keys(THEME_PRESETS).map((themeId) => (
                <ThemePreviewCard
                  key={themeId}
                  themeId={themeId}
                  active={form.theme_id === themeId}
                  onClick={() => updateThemeId(themeId)}
                />
              ))}
            </div>

            <div className="theme-preview-stage">
              <div className="theme-section-head compact">
                <div><span>Vista previa</span><h3>Así verá tu tienda el cliente</h3></div>
                <p>Los cambios aparecen aquí antes de guardarlos.</p>
              </div>
              <LiveThemePreview
                storeName={store?.nombre_tienda}
                form={form}
                categories={categories.map((category) => ({
                  id: category.id_categoria || category.id,
                  nombre: category.nombre,
                }))}
              />
            </div>

            <label>
              Plantilla activa
              <select
                value={form.theme_id}
                onChange={(event) => updateThemeId(event.target.value)}
              >
                {Object.entries(THEME_PRESETS).map(([themeId, preset]) => (
                  <option key={themeId} value={themeId}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="theme-actions-row">
              <button type="button" className="btn btn-ghost" onClick={resetCurrentTheme}>
                Restablecer plantilla
              </button>
              <HelperText text="Al cambiar de plantilla o restablecerla, se cargan sus valores por defecto." />
            </div>

            <div className="theme-grid-2">
              <label>
                Color principal
                <input
                  type="color"
                  value={form.theme_config.primary}
                  onChange={(event) => updateConfig("primary", event.target.value)}
                />
              </label>
              <label>
                Color secundario
                <input
                  type="color"
                  value={form.theme_config.secondary}
                  onChange={(event) => updateConfig("secondary", event.target.value)}
                />
              </label>
              <label>
                Fondo
                <input
                  type="color"
                  value={form.theme_config.background}
                  onChange={(event) => updateConfig("background", event.target.value)}
                />
              </label>
              <label>
                Texto principal
                <input
                  type="color"
                  value={form.theme_config.text}
                  onChange={(event) => updateConfig("text", event.target.value)}
                />
              </label>
              <label>
                Texto secundario
                <input
                  type="color"
                  value={form.theme_config.muted}
                  onChange={(event) => updateConfig("muted", event.target.value)}
                />
              </label>
              <label>
                Redondeado de tarjetas: {form.theme_config.radius}px
                <input
                  type="range"
                  min="8"
                  max="24"
                  step="2"
                  value={form.theme_config.radius}
                  onChange={(event) => updateConfig("radius", Number(event.target.value))}
                />
              </label>
            </div>

            <div className="theme-grid-2">
              <label>
                Tamaño de texto
                <select
                  value={form.theme_config.font_scale}
                  onChange={(event) => updateConfig("font_scale", event.target.value)}
                >
                  <option value="sm">Pequeño</option>
                  <option value="md">Normal</option>
                  <option value="lg">Grande</option>
                </select>
              </label>
              <label>
                Diseño de categorías
                <select
                  value={form.theme_config.category_style}
                  onChange={(event) => updateConfig("category_style", event.target.value)}
                >
                  <option value="chips">Botones simples</option>
                  <option value="round_icons">Íconos redondos</option>
                </select>
              </label>
            </div>

            <div className="theme-toggle-row">
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={!!form.theme_config.show_offers}
                  onChange={(event) => updateConfig("show_offers", event.target.checked)}
                />
                Mostrar ofertas
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={!!form.theme_config.show_featured}
                  onChange={(event) => updateConfig("show_featured", event.target.checked)}
                />
                Mostrar destacados
              </label>
            </div>

            {form.theme_id === "modern_banner" ? (
              <div className="theme-editor-section">
                <div className="theme-section-head compact">
                  <div><span>Paso 2</span><h3>Encabezado y banner</h3></div>
                  <p>Elige una composición y luego agrega solamente el contenido que necesites.</p>
                </div>

                <div className="hero-layout-picker" role="radiogroup" aria-label="Diseño del encabezado">
                  {[
                    ["text_image", "Texto + imagen", "Presentación completa"],
                    ["logo_only", "Solo logo", "Encabezado limpio"],
                    ["image_only", "Solo banner", "Imagen a todo el ancho"],
                    ["offer", "Oferta", "Promoción destacada"],
                  ].map(([value, label, help]) => (
                    <button
                      key={value}
                      type="button"
                      className={form.theme_config.hero_layout === value ? "active" : ""}
                      onClick={() => updateConfig("hero_layout", value)}
                      aria-pressed={form.theme_config.hero_layout === value}
                    >
                      <strong>{label}</strong><span>{help}</span>
                    </button>
                  ))}
                </div>

                <div className="theme-grid-2">
                  <label>
                    Alineación
                    <select value={form.theme_config.hero_alignment || "left"} onChange={(event) => updateConfig("hero_alignment", event.target.value)}>
                      <option value="left">Izquierda</option>
                      <option value="center">Centrada</option>
                    </select>
                  </label>
                  <label>
                    Ajuste de la imagen
                    <select value={form.theme_config.hero_image_fit || "cover"} onChange={(event) => updateConfig("hero_image_fit", event.target.value)}>
                      <option value="cover">Llenar el espacio</option>
                      <option value="contain">Mostrar imagen completa</option>
                    </select>
                  </label>
                </div>

                {!["logo_only", "image_only"].includes(form.theme_config.hero_layout) ? (
                  <div className="theme-grid-2">
                    <label>Texto pequeño<input value={form.theme_config.hero_kicker || ""} placeholder={store?.slug || "Mi tienda"} onChange={(event) => updateConfig("hero_kicker", event.target.value)} /></label>
                    <label>Título principal<input value={form.theme_config.hero_title || ""} placeholder={store?.nombre_tienda || "Nombre de la tienda"} onChange={(event) => updateConfig("hero_title", event.target.value)} /></label>
                    {form.theme_config.hero_layout === "offer" ? (
                      <label className="theme-field-wide">Texto de la oferta<input value={form.theme_config.hero_offer_text || ""} placeholder="20% de descuento esta semana" onChange={(event) => updateConfig("hero_offer_text", event.target.value)} /></label>
                    ) : (
                      <label className="theme-field-wide">Descripción<input value={form.theme_config.hero_subtitle || ""} placeholder="Cuenta brevemente qué ofrece tu tienda" onChange={(event) => updateConfig("hero_subtitle", event.target.value)} /></label>
                    )}
                  </div>
                ) : null}

                <div className="theme-assets-grid">
                  <div className="theme-asset-card">
                    <strong>Logo</strong><span>PNG o WEBP transparente recomendado.</span>
                    {form.theme_config.hero_logo_url ? <img src={buildAssetUrl(form.theme_config.hero_logo_url)} alt="Logo actual" /> : <div className="theme-asset-empty">Sin logo</div>}
                    <label className="btn btn-ghost file-btn">{logoUploading ? "Subiendo..." : "Elegir logo"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={logoUploading} onChange={(event) => handleLogoUpload(event.target.files?.[0])} /></label>
                    {form.theme_config.hero_logo_url ? <button type="button" className="theme-remove-asset" onClick={() => updateConfig("hero_logo_url", "")}>Quitar logo</button> : null}
                  </div>
                  <div className="theme-asset-card">
                    <strong>Imagen del banner</strong><span>Recomendado: 1600 × 700 px.</span>
                    {form.theme_config.hero_image_url ? <img src={buildAssetUrl(form.theme_config.hero_image_url)} alt="Banner actual" /> : <div className="theme-asset-empty">Sin imagen</div>}
                    <label className="btn btn-ghost file-btn">{uploading ? "Subiendo..." : "Elegir banner"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event) => handleBannerUpload(event.target.files?.[0])} /></label>
                    {form.theme_config.hero_image_url ? <button type="button" className="theme-remove-asset" onClick={() => updateConfig("hero_image_url", "")}>Quitar banner</button> : null}
                  </div>
                </div>

                <div className="theme-palette-assistant">
                  <div className="theme-section-head compact">
                    <div><span>Color inteligente</span><h3>Paletas basadas en tu imagen</h3></div>
                    <p>{analyzingPalette ? "Analizando colores…" : "Al elegir un logo o banner aparecerán sugerencias aquí."}</p>
                  </div>
                  {paletteSuggestions.length ? (
                    <div className="theme-palette-grid">
                      {paletteSuggestions.map((palette) => (
                        <button type="button" key={palette.name} onClick={() => applyPalette(palette.colors)}>
                          <div className="theme-palette-swatches" aria-hidden="true">
                            {Object.values(palette.colors).map((color, index) => <span key={index} style={{ background: color }} />)}
                          </div>
                          <strong>{palette.name}</strong>
                          <small>{palette.description}</small>
                          <em>Aplicar esta paleta</em>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="theme-palette-empty">
                      <span>Color</span>
                      <p>Sube o vuelve a elegir una imagen para obtener tres combinaciones adecuadas automáticamente.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {form.theme_config.category_style === "round_icons" ? (
              <div className="theme-category-icons">
                <div className="theme-category-icons-head">
                  <strong>Imagenes para categorias redondas</strong>
                  <span>Opcional. Si no cargas imagen, se usa una inicial simple.</span>
                </div>
                <div className="theme-category-icons-grid">
                  {categories.map((category) => {
                    const categoryId = category.id_categoria || category.id;
                    const imageUrl = form.theme_config.category_images?.[String(categoryId)] || "";
                    const busy = iconUploadingFor === String(categoryId);
                    return (
                      <div key={categoryId} className="theme-category-icon-card">
                        <div className="theme-category-icon-preview">
                          {imageUrl ? (
                            <img src={buildAssetUrl(imageUrl)} alt={category.nombre} />
                          ) : (
                            <span>{String(category.nombre || "C").slice(0, 1)}</span>
                          )}
                        </div>
                        <label>
                          {category.nombre}
                          <input
                            value={imageUrl}
                            autoComplete="off"
                            placeholder="/uploads/theme/categoria.jpg"
                            onChange={(event) => updateCategoryImage(categoryId, event.target.value)}
                          />
                        </label>
                        <label className="btn btn-ghost file-btn">
                          {busy ? "Subiendo..." : "Subir icono"}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={busy}
                            onChange={(event) => handleCategoryIconUpload(categoryId, event.target.files?.[0])}
                          />
                        </label>
                      </div>
                    );
                  })}
                  {categories.length === 0 ? (
                    <p className="muted small">No hay categorias aun para esta tienda.</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <HelperText text="La vista previa responde en vivo. Los clientes verán los cambios solamente después de guardar." />
            <div className="theme-save-bar">
              <span>Revisa la vista previa antes de publicar.</span>
              <button className="btn btn-primary" disabled={saving || (isSuperadmin && !tenantId)}>
                {saving ? "Guardando..." : "Guardar y publicar tema"}
              </button>
            </div>
          </form>
        ) : null}
      </Card>
    </div>
  );
}

export default ThemeAppearanceScreen;
