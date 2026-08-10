import { useEffect, useMemo, useRef, useState } from "react";

const FIT_OPTIONS = new Set(["cover", "contain", "auto"]);
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value)));

export function categoryCoverDefaults(category) {
  return {
    fit: FIT_OPTIONS.has(category?.imagen_fit_default) ? category.imagen_fit_default : "cover",
    positionX: clamp(category?.imagen_posicion_x_default ?? 50, 0, 100),
    positionY: clamp(category?.imagen_posicion_y_default ?? 30, 0, 100),
    zoom: clamp(category?.imagen_zoom_default ?? 100, 80, 200),
    background: /^#[0-9A-Fa-f]{6}$/.test(category?.imagen_fondo_default || "")
      ? category.imagen_fondo_default
      : "#F8F5F2",
  };
}

export function productCoverState(product, category) {
  const inherited = !product?.imagen_fit;
  const defaults = categoryCoverDefaults(category);
  return {
    inherited,
    values: {
      fit: FIT_OPTIONS.has(product?.imagen_fit) ? product.imagen_fit : defaults.fit,
      positionX: clamp(product?.imagen_posicion_x ?? defaults.positionX, 0, 100),
      positionY: clamp(product?.imagen_posicion_y ?? defaults.positionY, 0, 100),
      zoom: clamp(product?.imagen_zoom ?? defaults.zoom, 80, 200),
      background: /^#[0-9A-Fa-f]{6}$/.test(product?.imagen_fondo || "")
        ? product.imagen_fondo
        : defaults.background,
    },
  };
}

export function coverPayload(values, inherited = false) {
  if (inherited) {
    return {
      imagen_fit: null,
      imagen_posicion_x: null,
      imagen_posicion_y: null,
      imagen_zoom: null,
      imagen_fondo: null,
    };
  }
  return {
    imagen_fit: FIT_OPTIONS.has(values.fit) ? values.fit : "cover",
    imagen_posicion_x: Math.round(clamp(values.positionX, 0, 100)),
    imagen_posicion_y: Math.round(clamp(values.positionY, 0, 100)),
    imagen_zoom: Math.round(clamp(values.zoom, 80, 200)),
    imagen_fondo: /^#[0-9A-Fa-f]{6}$/.test(values.background || "") ? values.background : null,
  };
}

function RangeControl({ label, value, min, max, suffix = "%", onChange, disabled }) {
  return (
    <label className="cover-range-control">
      <span><strong>{label}</strong><output>{Math.round(value)}{suffix}</output></span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export default function ProductCoverEditor({
  open,
  imageUrl,
  file,
  product,
  category,
  busy = false,
  onCancel,
  onApply,
}) {
  const defaults = useMemo(() => categoryCoverDefaults(category), [category]);
  const initial = useMemo(() => productCoverState(product, category), [product, category]);
  const [inherited, setInherited] = useState(initial.inherited);
  const [values, setValues] = useState(initial.values);
  const [autoFit, setAutoFit] = useState("cover");
  const dragRef = useRef(null);
  const stageRef = useRef(null);
  const objectUrl = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  const resolvedImageUrl = objectUrl || imageUrl || "";

  useEffect(() => () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  useEffect(() => {
    if (!open) return;
    const next = productCoverState(product, category);
    setInherited(next.inherited);
    setValues(next.values);
    setAutoFit("cover");
  }, [open, product, category, file]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const displayed = inherited ? defaults : values;
  const resolvedFit = displayed.fit === "auto" ? autoFit : displayed.fit;
  const updateValue = (key, value) => {
    setInherited(false);
    setValues((current) => ({ ...current, [key]: value }));
  };
  const applyPreset = (preset) => {
    setInherited(false);
    setValues((current) => ({ ...current, ...preset }));
  };
  const imageStyle = {
    objectFit: resolvedFit,
    objectPosition: `${displayed.positionX}% ${displayed.positionY}%`,
    transform: `scale(${displayed.zoom / 100})`,
  };

  const beginDrag = (event) => {
    if (busy || inherited) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      positionX: values.positionX,
      positionY: values.positionY,
    };
  };
  const moveDrag = (event) => {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || !stage || drag.pointerId !== event.pointerId) return;
    const rect = stage.getBoundingClientRect();
    const nextX = clamp(drag.positionX - ((event.clientX - drag.x) / Math.max(1, rect.width)) * 100, 0, 100);
    const nextY = clamp(drag.positionY - ((event.clientY - drag.y) / Math.max(1, rect.height)) * 100, 0, 100);
    setValues((current) => ({ ...current, positionX: nextX, positionY: nextY }));
  };
  const endDrag = (event) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  return (
    <div className="cover-editor-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onCancel();
    }}>
      <section className="cover-editor-modal" role="dialog" aria-modal="true" aria-labelledby="cover-editor-title">
        <header className="cover-editor-head">
          <div>
            <span>Portada del producto</span>
            <h2 id="cover-editor-title">{file ? "Previsualizar antes de subir" : "Ajustar imagen existente"}</h2>
            <p>La imagen original se conserva; solo cambia cómo se muestra en las tarjetas.</p>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} aria-label="Cerrar">×</button>
        </header>

        <div className="cover-editor-layout">
          <div className="cover-preview-column">
            <div
              ref={stageRef}
              className={`cover-preview-stage ${inherited ? "is-inherited" : ""}`}
              style={{ backgroundColor: displayed.background }}
              onPointerDown={beginDrag}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              {resolvedImageUrl ? (
                <img
                  src={resolvedImageUrl}
                  alt="Previsualización de portada"
                  draggable="false"
                  style={imageStyle}
                  onLoad={(event) => {
                    const ratio = event.currentTarget.naturalWidth / Math.max(1, event.currentTarget.naturalHeight);
                    setAutoFit(ratio < 0.9 || ratio > 1.1 ? "contain" : "cover");
                  }}
                />
              ) : <span>Sin imagen</span>}
              {!inherited ? <small>Arrastra para cambiar el encuadre</small> : null}
            </div>
            <div className="cover-card-preview">
              <div className="cover-card-preview-media" style={{ backgroundColor: displayed.background }}>
                {resolvedImageUrl ? <img src={resolvedImageUrl} alt="Vista en tarjeta" style={imageStyle} draggable="false" /> : null}
              </div>
              <div><strong>{product?.nombre || "Nombre del producto"}</strong><span>Así se verá en el catálogo</span></div>
            </div>
          </div>

          <div className="cover-editor-controls">
            <div className="cover-inherit-panel">
              <div><strong>Configuración de categoría</strong><span>{category?.nombre || "Sin categoría"}</span></div>
              <label className="cover-switch"><input type="checkbox" checked={inherited} onChange={(event) => {
                setInherited(event.target.checked);
                if (!event.target.checked) setValues({ ...defaults });
              }} /><span>Usar valor predeterminado</span></label>
            </div>

            <div className="cover-presets" aria-label="Ajustes rápidos">
              <button type="button" onClick={() => applyPreset({ fit: "contain", positionX: 50, positionY: 50, zoom: 100 })}>Collar completo<small>Sin recortes</small></button>
              <button type="button" onClick={() => applyPreset({ fit: "cover", positionX: 50, positionY: 30, zoom: 100 })}>Llenar cuadro<small>Portada tradicional</small></button>
              <button type="button" onClick={() => applyPreset({ fit: "auto", positionX: 50, positionY: 50, zoom: 100 })}>Automático<small>Según proporción</small></button>
            </div>

            <label className="cover-select-control">
              <span>Modo de encaje</span>
              <select value={displayed.fit} disabled={inherited} onChange={(event) => updateValue("fit", event.target.value)}>
                <option value="cover">Rellenar el cuadro</option>
                <option value="contain">Mostrar imagen completa</option>
                <option value="auto">Automático según imagen</option>
              </select>
            </label>

            <RangeControl label="Posición horizontal" value={displayed.positionX} min={0} max={100} disabled={inherited} onChange={(value) => updateValue("positionX", value)} />
            <RangeControl label="Posición vertical" value={displayed.positionY} min={0} max={100} disabled={inherited} onChange={(value) => updateValue("positionY", value)} />
            <RangeControl label="Zoom" value={displayed.zoom} min={80} max={200} disabled={inherited} onChange={(value) => updateValue("zoom", value)} />

            <div className="cover-background-control">
              <label><span>Color de fondo</span><input type="color" value={displayed.background} disabled={inherited} onChange={(event) => updateValue("background", event.target.value.toUpperCase())} /></label>
              <button type="button" disabled={inherited} onClick={() => updateValue("background", "#F8F5F2")}>Restablecer</button>
            </div>

            <button type="button" className="cover-reset-position" disabled={inherited} onClick={() => setValues((current) => ({ ...current, positionX: 50, positionY: 50, zoom: 100 }))}>Centrar y restablecer zoom</button>
          </div>
        </div>

        <footer className="cover-editor-footer">
          <span>{inherited ? "Se aplicará automáticamente el ajuste de la categoría." : "Este ajuste solo afectará a este producto."}</span>
          <div>
            <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancelar</button>
            <button type="button" className="btn btn-primary" disabled={busy || !resolvedImageUrl} onClick={() => onApply({
              file,
              inherited,
              values: inherited ? defaults : values,
              payload: coverPayload(values, inherited),
            })}>{busy ? "Aplicando…" : file ? "Aplicar y subir" : "Guardar ajuste"}</button>
          </div>
        </footer>
      </section>
    </div>
  );
}