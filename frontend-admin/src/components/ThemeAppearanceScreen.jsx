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

  return (
    <section className="live-preview-card" style={previewStyle}>
      <div className={`live-preview-shell ${form.theme_id}`}>
        <div className="live-preview-head">
          <div>
            <small>{storeName || "Tienda Demo"}</small>
            <h4>Vista previa</h4>
            <p>Asi se vera antes de guardar.</p>
          </div>
          {form.theme_id === "modern_banner" && form.theme_config.hero_image_url ? (
            <img
              src={buildAssetUrl(form.theme_config.hero_image_url)}
              alt="Banner"
              className="live-preview-hero"
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
    setUploading(true);
    await handleThemeAssetUpload(file, (url) => updateConfig("hero_image_url", url), "Banner");
    setUploading(false);
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

            <LiveThemePreview
              storeName={store?.nombre_tienda}
              form={form}
              categories={categories.map((category) => ({
                id: category.id_categoria || category.id,
                nombre: category.nombre,
              }))}
            />

            <label>
              Theme activo
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
                Primary
                <input
                  type="color"
                  value={form.theme_config.primary}
                  onChange={(event) => updateConfig("primary", event.target.value)}
                />
              </label>
              <label>
                Secondary
                <input
                  type="color"
                  value={form.theme_config.secondary}
                  onChange={(event) => updateConfig("secondary", event.target.value)}
                />
              </label>
              <label>
                Background
                <input
                  type="color"
                  value={form.theme_config.background}
                  onChange={(event) => updateConfig("background", event.target.value)}
                />
              </label>
              <label>
                Text
                <input
                  type="color"
                  value={form.theme_config.text}
                  onChange={(event) => updateConfig("text", event.target.value)}
                />
              </label>
              <label>
                Muted
                <input
                  type="color"
                  value={form.theme_config.muted}
                  onChange={(event) => updateConfig("muted", event.target.value)}
                />
              </label>
              <label>
                Radius
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
                Font scale
                <select
                  value={form.theme_config.font_scale}
                  onChange={(event) => updateConfig("font_scale", event.target.value)}
                >
                  <option value="sm">sm</option>
                  <option value="md">md</option>
                  <option value="lg">lg</option>
                </select>
              </label>
              <label>
                Category style
                <select
                  value={form.theme_config.category_style}
                  onChange={(event) => updateConfig("category_style", event.target.value)}
                >
                  <option value="chips">chips</option>
                  <option value="round_icons">round_icons</option>
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
              <div className="theme-banner-tools">
                <label>
                  Hero image URL
                  <input
                    value={form.theme_config.hero_image_url || ""}
                    autoComplete="off"
                    placeholder="/uploads/theme/hero.jpg"
                    onChange={(event) => updateConfig("hero_image_url", event.target.value)}
                  />
                </label>
                <label className="btn btn-ghost file-btn">
                  {uploading ? "Subiendo..." : "Subir banner"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploading}
                    onChange={(event) => handleBannerUpload(event.target.files?.[0])}
                  />
                </label>
                {form.theme_config.hero_image_url ? (
                  <a
                    href={buildAssetUrl(form.theme_config.hero_image_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="current-image-link"
                  >
                    Abrir banner actual
                  </a>
                ) : null}
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

            <HelperText text="La vista previa responde en vivo a colores, plantilla y category_style antes de guardar." />
            <button className="btn btn-primary" disabled={saving || (isSuperadmin && !tenantId)}>
              {saving ? "Guardando..." : "Guardar tema"}
            </button>
          </form>
        ) : null}
      </Card>
    </div>
  );
}

export default ThemeAppearanceScreen;
