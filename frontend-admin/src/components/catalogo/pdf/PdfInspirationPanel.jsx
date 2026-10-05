import React, { useRef, useState } from "react";


export default function PdfInspirationPanel({ analyzePalette, palette, applySuggestion }) {
  const inputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const selectFile = async (file) => {
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    await analyzePalette(file);
  };

  return (
    <section className="catalog-pdf-panel">
      <div className="catalog-pdf-panel-title">
        <span>3</span>
        <div><strong>Inspiración visual</strong><small>Extrae una paleta desde una imagen de referencia</small></div>
      </div>
      <div className="catalog-pdf-inspiration">
        <button type="button" className="catalog-pdf-upload-box" onClick={() => inputRef.current?.click()}>
          {previewUrl ? <img src={previewUrl} alt="Referencia visual" /> : <span><strong>Subir imagen de referencia</strong><small>JPG, PNG o WEBP. No se guarda.</small></span>}
        </button>
        <input ref={inputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectFile(event.target.files?.[0])} />
        {palette?.colors?.length ? <div className="catalog-pdf-swatches">{palette.colors.map((color) => <span key={color} title={color} style={{ background: color }} />)}</div> : null}
      </div>
      {palette?.suggestions?.length ? (
        <div className="catalog-pdf-palette-suggestions">
          {palette.suggestions.map((suggestion) => (
            <button key={suggestion.name} type="button" onClick={() => applySuggestion(suggestion)}>
              <span>{[suggestion.primary_color, suggestion.secondary_color, suggestion.background_color, suggestion.text_color].map((color) => <i key={color} style={{ background: color }} />)}</span>
              <strong>{suggestion.name}</strong>
            </button>
          ))}
        </div>
      ) : <p className="muted small">La referencia propone colores; la distribución seguirá usando una plantilla estable.</p>}
    </section>
  );
}
