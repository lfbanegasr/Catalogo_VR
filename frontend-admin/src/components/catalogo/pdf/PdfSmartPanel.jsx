import React from "react";


const KIND_LABELS = {
  product: "Foto de producto",
  lifestyle: "Producto en contexto",
  promotional: "Diseño con texto",
  missing: "Sin imagen",
  invalid: "Imagen inválida",
};


export default function PdfSmartPanel({
  options,
  updateOption,
  intelligence,
  aiStatus,
  analyzing,
  onAnalyze,
  onApplySuggestion,
}) {
  const kinds = intelligence?.summary?.kinds || {};
  const florenceAvailable = Boolean(aiStatus?.florence?.available);
  const removalAvailable = Boolean(aiStatus?.background_removal?.available);
  return (
    <section className="catalog-pdf-panel catalog-pdf-smart-panel">
      <div className="catalog-pdf-panel-title">
        <span>4</span>
        <div><strong>Diseño inteligente</strong><small>Analiza imágenes, contenido y composición antes de generar</small></div>
      </div>

      <div className="catalog-pdf-smart-options">
        <label><input type="checkbox" checked={options.smart_layout} onChange={(event) => updateOption("smart_layout", event.target.checked)} /> Evitar colisiones y adaptar páginas</label>
        <label><input type="checkbox" checked={options.smart_image_analysis} onChange={(event) => updateOption("smart_image_analysis", event.target.checked)} /> Clasificar imágenes automáticamente</label>
        <label className={!florenceAvailable ? "is-disabled" : ""}>
          <input type="checkbox" checked={options.use_florence && florenceAvailable} disabled={!florenceAvailable} onChange={(event) => updateOption("use_florence", event.target.checked)} />
          Analizar con Florence-2
          <small>{florenceAvailable ? "Disponible en este servidor" : "Requiere instalar el paquete de IA y el modelo"}</small>
        </label>
        <label className={!removalAvailable ? "is-disabled" : ""}>
          <input type="checkbox" checked={options.enable_background_removal && removalAvailable} disabled={!removalAvailable} onChange={(event) => updateOption("enable_background_removal", event.target.checked)} />
          Quitar fondos automáticamente
          <small>{removalAvailable ? "Procesamiento local con rembg" : "Función opcional no instalada"}</small>
        </label>
      </div>

      <button type="button" className="btn btn-secondary catalog-pdf-analyze-btn" disabled={analyzing} onClick={onAnalyze}>
        {analyzing ? "Analizando catálogo..." : "Analizar productos y sugerir diseño"}
      </button>

      {intelligence ? (
        <div className="catalog-pdf-smart-result">
          <div className="catalog-pdf-kind-summary">
            {Object.entries(kinds).filter(([, count]) => count).map(([kind, count]) => (
              <span key={kind}><strong>{count}</strong>{KIND_LABELS[kind] || kind}</span>
            ))}
          </div>
          <div className="catalog-pdf-smart-recommendation">
            <div>
              <strong>Recomendación automática</strong>
              <small>Plantilla {intelligence.summary.recommended_template} · imágenes {intelligence.summary.recommended_image_fit}</small>
            </div>
            <button type="button" className="btn btn-secondary" onClick={onApplySuggestion}>Aplicar recomendación</button>
          </div>
          {intelligence.summary.warnings?.length ? (
            <ul className="catalog-pdf-smart-warnings">
              {intelligence.summary.warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
