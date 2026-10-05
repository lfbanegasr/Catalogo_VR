import React, { useRef } from "react";
import { buildAssetUrl } from "../../../api";


export default function PdfCoverPanel({ options, updateOption, uploadCover, clearCover, uploading }) {
  const inputRef = useRef(null);
  return (
    <section className="catalog-pdf-panel">
      <div className="catalog-pdf-panel-title">
        <span>4</span>
        <div><strong>Portada</strong><small>Automática, personalizada o sin portada</small></div>
      </div>
      <div className="catalog-pdf-cover-options">
        <label><input type="radio" name="pdf-cover-mode" checked={!options.show_cover} onChange={() => updateOption("show_cover", false)} /> Sin portada</label>
        <label><input type="radio" name="pdf-cover-mode" checked={options.show_cover && !options.cover_url} onChange={() => { updateOption("show_cover", true); updateOption("cover_url", null); }} /> Portada automática</label>
        <label><input type="radio" name="pdf-cover-mode" checked={options.show_cover && !!options.cover_url} onChange={() => updateOption("show_cover", true)} /> Portada personalizada</label>
      </div>
      <div className="catalog-pdf-cover-uploader">
        <button type="button" className="catalog-pdf-cover-preview" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {options.cover_url ? <img src={buildAssetUrl(options.cover_url)} alt="Portada personalizada" /> : <span><strong>{uploading ? "Subiendo portada..." : "Elegir portada"}</strong><small>A4 vertical recomendado</small></span>}
        </button>
        <input ref={inputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => uploadCover(event.target.files?.[0])} />
        <div className="catalog-pdf-cover-controls">
          <label>Ajuste<select value={options.cover_fit} onChange={(event) => updateOption("cover_fit", event.target.value)}><option value="cover">Cubrir toda la página</option><option value="contain">Mostrar imagen completa</option></select></label>
          <label className="check-row"><input type="checkbox" checked={options.cover_text_overlay} disabled={!options.cover_url} onChange={(event) => updateOption("cover_text_overlay", event.target.checked)} /> Agregar título encima</label>
          {options.cover_url ? <button type="button" className="btn btn-danger-ghost" onClick={clearCover}>Quitar portada personalizada</button> : null}
        </div>
      </div>
    </section>
  );
}
