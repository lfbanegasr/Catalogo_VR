import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../../api";
import CatalogPdfPreview from "./CatalogPdfPreview";
import PdfContentPanel from "./PdfContentPanel";
import PdfCoverPanel from "./PdfCoverPanel";
import PdfDesignPanel from "./PdfDesignPanel";
import PdfInspirationPanel from "./PdfInspirationPanel";
import PdfPageEditor, { buildEditorPages } from "./PdfPageEditor";
import PdfSmartPanel from "./PdfSmartPanel";
import { DEFAULT_OPTIONS, categoryLabels, storePdfDefaults } from "./catalogPdfConfig";
import "../CatalogPdfDownload.css";
import "./CatalogPdfAdvanced.css";
import "./CatalogPdfSmart.css";


export default function CatalogPdfSmartDownload({ categories = [], products = [], store = null, tiendaRef, disabled = false }) {
  const [allCategories, setAllCategories] = useState(true);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [palette, setPalette] = useState(null);
  const [intelligence, setIntelligence] = useState(null);
  const [aiStatus, setAiStatus] = useState(null);
  const [paletteBusy, setPaletteBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const labeledCategories = useMemo(() => categoryLabels(categories), [categories]);

  const draftKey = useMemo(() => `catalog-pdf-layout:${store?.id_tienda || tiendaRef || "default"}`, [store?.id_tienda, tiendaRef]);
  useEffect(() => {
    setOptions((current) => {
      const base = storePdfDefaults(store, current);
      try {
        const saved = JSON.parse(localStorage.getItem(draftKey) || "{}");
        return {
          ...base,
          product_overrides: Array.isArray(saved.product_overrides) ? saved.product_overrides : base.product_overrides,
          page_overrides: Array.isArray(saved.page_overrides) ? saved.page_overrides : base.page_overrides,
        };
      } catch {
        return base;
      }
    });
  }, [draftKey, store?.id_tienda]);
  useEffect(() => {
    if (disabled) return;
    localStorage.setItem(draftKey, JSON.stringify({
      product_overrides: options.product_overrides || [],
      page_overrides: options.page_overrides || [],
    }));
  }, [disabled, draftKey, options.page_overrides, options.product_overrides]);
  useEffect(() => {
    if (disabled) return;
    api.catalogPdfAiStatus().then(setAiStatus).catch(() => setAiStatus(null));
  }, [disabled]);
  useEffect(() => {
    const known = new Set(categories.map((item) => String(item.id_categoria)));
    setSelectedCategoryIds((current) => current.filter((id) => known.has(id)));
  }, [categories]);

  const selectedWithDescendants = useMemo(() => {
    const resolved = new Set(selectedCategoryIds);
    if (!options.include_descendants) return resolved;
    let changed = true;
    while (changed) {
      changed = false;
      categories.forEach((category) => {
        const parentId = category.id_categoria_padre ? String(category.id_categoria_padre) : "";
        const id = String(category.id_categoria);
        if (parentId && resolved.has(parentId) && !resolved.has(id)) { resolved.add(id); changed = true; }
      });
    }
    return resolved;
  }, [categories, options.include_descendants, selectedCategoryIds]);

  const includedProducts = useMemo(() => products.filter((product) => {
    if (options.only_active_products && !product.activo) return false;
    const categoryId = String(product.id_categoria_principal || product.id_categoria || "");
    if (!categoryId) return options.include_uncategorized;
    return allCategories || selectedWithDescendants.has(categoryId);
  }), [allCategories, options.include_uncategorized, options.only_active_products, products, selectedWithDescendants]);

  const overrideOrders = useMemo(() => new Map((options.product_overrides || []).map((item) => [String(item.product_id), item.order])), [options.product_overrides]);
  const orderedProducts = useMemo(() => includedProducts.map((product, index) => ({ product, index, order: overrideOrders.get(String(product.id_producto)) ?? index }))
    .sort((a, b) => a.order - b.order || a.index - b.index).map((item) => item.product), [includedProducts, overrideOrders]);
  const includedCategoryCount = useMemo(() => new Set(includedProducts.map((product) => String(product.id_categoria_principal || product.id_categoria || "")).filter(Boolean)).size, [includedProducts]);
  const pageCapacity = options.template === "editorial" ? 3 : Number(options.products_per_page);
  const estimatedPages = buildEditorPages(orderedProducts, labeledCategories, pageCapacity).length + (options.show_cover ? 1 : 0);
  const analysisById = useMemo(() => new Map((intelligence?.products || []).map((item) => [String(item.product_id), item])), [intelligence]);

  const updateOption = (key, value) => { setOptions((current) => ({ ...current, [key]: value })); setMessage(""); };
  const selectTemplate = (template) => { setOptions((current) => ({ ...current, template: template.id, ...template.defaults })); setMessage(""); };
  const toggleCategory = (categoryId) => {
    const id = String(categoryId);
    setSelectedCategoryIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setAllCategories(false);
  };

  const analyzePalette = async (file) => {
    if (!file) return;
    setPaletteBusy(true); setError("");
    try { setPalette(await api.extractCatalogPdfPalette(file)); setMessage("Paleta extraída. Elige una combinación para aplicarla."); }
    catch (analysisError) { setError(analysisError.message || "No se pudo analizar la imagen."); }
    finally { setPaletteBusy(false); }
  };
  const applySuggestion = (suggestion) => { setOptions((current) => ({ ...current, ...suggestion })); setMessage(`Paleta ${suggestion.name.toLowerCase()} aplicada.`); };

  const analyzeCatalog = async () => {
    if (!includedProducts.length) return;
    setAnalyzing(true); setError(""); setMessage("");
    try {
      const result = await api.analyzeCatalogPdf({ product_ids: includedProducts.map((item) => item.id_producto), use_florence: options.use_florence }, tiendaRef);
      setIntelligence(result);
      setMessage(result.ai?.florence_used ? "Análisis completado con Florence-2." : "Análisis visual local completado.");
    } catch (analysisError) { setError(analysisError.message || "No se pudo analizar el catálogo."); }
    finally { setAnalyzing(false); }
  };

  const applyIntelligentSuggestion = () => {
    if (!intelligence) return;
    const suggestion = intelligence.palette?.suggestions?.[0] || {};
    setOptions((current) => ({
      ...current,
      ...suggestion,
      template: intelligence.summary.recommended_template,
      image_fit: intelligence.summary.recommended_image_fit,
      background_style: intelligence.summary.recommended_template === "editorial" ? "editorial" : "gradient",
      smart_layout: true,
      smart_image_analysis: true,
    }));
    setPalette(intelligence.palette || null);
    setMessage("Diseño inteligente aplicado; aún puedes ajustar cada página.");
  };

  const uploadCover = async (file) => {
    if (!file) return;
    setCoverUploading(true); setError("");
    try { const result = await api.uploadCatalogPdfCover(file, tiendaRef); setOptions((current) => ({ ...current, show_cover: true, cover_url: result.cover_url })); setMessage("Portada personalizada guardada."); }
    catch (uploadError) { setError(uploadError.message || "No se pudo subir la portada."); }
    finally { setCoverUploading(false); }
  };
  const clearCover = async () => {
    setError("");
    try { await api.clearCatalogPdfCover(tiendaRef); setOptions((current) => ({ ...current, cover_url: null, show_cover: true })); setMessage("Se usará la portada automática."); }
    catch (clearError) { setError(clearError.message || "No se pudo quitar la portada."); }
  };

  const downloadPdf = async () => {
    if (!allCategories && selectedCategoryIds.length === 0) { setError("Selecciona al menos una categoría o elige todo el catálogo."); return; }
    if (!includedProducts.length) { setError("No hay productos que coincidan con esta selección."); return; }
    const colorKeys = ["primary_color", "secondary_color", "background_color", "gradient_end_color", "text_color", "muted_color", "price_color"];
    if (colorKeys.some((key) => !/^#[0-9A-Fa-f]{6}$/.test(options[key]))) { setError("Todos los colores deben tener el formato #RRGGBB."); return; }
    setDownloading(true); setError(""); setMessage("");
    try {
      const result = await api.downloadCatalogPdf({ ...options, category_ids: allCategories ? [] : selectedCategoryIds }, tiendaRef);
      const objectUrl = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a"); anchor.href = objectUrl; anchor.download = result.filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setMessage("Catálogo inteligente generado y descargado correctamente.");
    } catch (downloadError) { setError(downloadError.message || "No se pudo generar el catálogo PDF."); }
    finally { setDownloading(false); }
  };

  if (disabled) return <div className="catalog-pdf-empty"><strong>Selecciona una tienda</strong><span>Elige la tienda que deseas exportar.</span></div>;
  return (
    <section className="catalog-pdf-builder">
      <header className="catalog-pdf-hero">
        <div><span className="catalog-pdf-eyebrow">Constructor editorial inteligente</span><h2>Descargar catálogo PDF</h2><p>Genera una propuesta automática y corrige individualmente los productos que lo necesiten.</p></div>
        <div className="catalog-pdf-summary"><span><strong>{includedProducts.length}</strong> productos</span><span><strong>{includedCategoryCount}</strong> categorías</span><span><strong>{estimatedPages}</strong> páginas aprox.</span></div>
      </header>
      <div className="catalog-pdf-layout catalog-pdf-advanced-layout">
        <div className="catalog-pdf-settings">
          <PdfContentPanel allCategories={allCategories} setAllCategories={setAllCategories} labeledCategories={labeledCategories} products={products} selectedCategoryIds={selectedCategoryIds} toggleCategory={toggleCategory} options={options} updateOption={updateOption} />
          <PdfDesignPanel options={options} updateOption={updateOption} selectTemplate={selectTemplate} />
          <PdfInspirationPanel analyzePalette={analyzePalette} palette={palette} applySuggestion={applySuggestion} />
          <PdfSmartPanel options={options} updateOption={updateOption} intelligence={intelligence} aiStatus={aiStatus} analyzing={analyzing} onAnalyze={analyzeCatalog} onApplySuggestion={applyIntelligentSuggestion} />
          <PdfPageEditor products={includedProducts} categories={labeledCategories} options={options} updateOption={updateOption} analysisById={analysisById} />
          <PdfCoverPanel options={options} updateOption={updateOption} uploadCover={uploadCover} clearCover={clearCover} uploading={coverUploading} />
        </div>
        <aside className="catalog-pdf-preview-panel">
          <div className="catalog-pdf-panel-title"><span>6</span><div><strong>Vista previa</strong><small>Incluye ajustes de orden, recorte y visibilidad</small></div></div>
          <CatalogPdfPreview options={options} store={store} products={orderedProducts} categoryCount={includedCategoryCount} />
          {paletteBusy ? <p className="catalog-pdf-feedback">Analizando colores...</p> : null}
          {error ? <p className="catalog-pdf-feedback is-error">{error}</p> : null}
          {message ? <p className="catalog-pdf-feedback is-success">{message}</p> : null}
          <button type="button" className="btn btn-primary catalog-pdf-download-btn" disabled={downloading || !includedProducts.length} onClick={downloadPdf}>{downloading ? "Generando PDF..." : "Descargar catálogo PDF"}</button>
          <small className="catalog-pdf-download-note">El PDF final utiliza las mismas reglas adaptativas del editor.</small>
        </aside>
      </div>
    </section>
  );
}
