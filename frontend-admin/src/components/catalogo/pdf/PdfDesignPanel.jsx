import React from "react";
import { TEMPLATE_OPTIONS } from "./catalogPdfConfig";


function ColorField({ label, value, onChange }) {
  return (
    <label>{label}<span className="catalog-pdf-color"><input type="color" value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} /><input value={value} maxLength="7" onChange={(event) => onChange(event.target.value)} /></span></label>
  );
}


export default function PdfDesignPanel({ options, updateOption, selectTemplate }) {
  return (
    <section className="catalog-pdf-panel">
      <div className="catalog-pdf-panel-title">
        <span>2</span>
        <div><strong>Diseño de la revista</strong><small>Elige una plantilla y personaliza sus detalles</small></div>
      </div>
      <div className="catalog-pdf-template-grid">
        {TEMPLATE_OPTIONS.map((template) => (
          <button key={template.id} type="button" className={`catalog-pdf-template-card ${options.template === template.id ? "is-selected" : ""}`} onClick={() => selectTemplate(template)}>
            <span className={`catalog-pdf-template-thumb is-${template.id}`}><i /><i /><i /></span>
            <strong>{template.name}</strong>
            <small>{template.description}</small>
          </button>
        ))}
      </div>
      <div className="catalog-pdf-form-grid catalog-pdf-design-fields">
        <label className="is-wide">Título de portada<input value={options.title} maxLength="100" onChange={(event) => updateOption("title", event.target.value)} /></label>
        <label className="is-wide">Subtítulo<input value={options.subtitle} maxLength="180" onChange={(event) => updateOption("subtitle", event.target.value)} /></label>
        <label>Productos por página<select value={options.products_per_page} disabled={options.template === "editorial"} onChange={(event) => updateOption("products_per_page", Number(event.target.value))}><option value="2">2 productos</option><option value="3">3 productos</option><option value="4">4 productos</option></select></label>
        <label>Orden<select value={options.sort_by} onChange={(event) => updateOption("sort_by", event.target.value)}><option value="name">Nombre A-Z</option><option value="price_asc">Menor precio</option><option value="price_desc">Mayor precio</option><option value="newest">Más recientes</option></select></label>
        <label>Fondo<select value={options.background_style} onChange={(event) => updateOption("background_style", event.target.value)}><option value="solid">Sólido</option><option value="gradient">Degradado</option><option value="organic">Círculos orgánicos</option><option value="editorial">Bloques editoriales</option></select></label>
        <label>Diseño del precio<select value={options.price_style} onChange={(event) => updateOption("price_style", event.target.value)}><option value="circle">Medallón circular</option><option value="pill">Cápsula</option><option value="block">Bloque</option></select></label>
        <label>Forma de imagen<select value={options.image_shape} onChange={(event) => updateOption("image_shape", event.target.value)}><option value="auto">Según plantilla</option><option value="rounded">Redondeada</option><option value="square">Cuadrada</option><option value="circle">Circular</option></select></label>
        <label>Ajuste de imagen<select value={options.image_fit} onChange={(event) => updateOption("image_fit", event.target.value)}><option value="auto">Usar ajuste del producto</option><option value="contain">Mostrar imagen completa</option><option value="cover">Rellenar espacio</option></select></label>
        <ColorField label="Principal" value={options.primary_color} onChange={(value) => updateOption("primary_color", value)} />
        <ColorField label="Secundario" value={options.secondary_color} onChange={(value) => updateOption("secondary_color", value)} />
        <ColorField label="Fondo inicial" value={options.background_color} onChange={(value) => updateOption("background_color", value)} />
        <ColorField label="Fondo final" value={options.gradient_end_color} onChange={(value) => updateOption("gradient_end_color", value)} />
        <ColorField label="Texto" value={options.text_color} onChange={(value) => updateOption("text_color", value)} />
        <ColorField label="Precio" value={options.price_color} onChange={(value) => updateOption("price_color", value)} />
      </div>
      <div className="catalog-pdf-checks catalog-pdf-visibility">
        <label><input type="checkbox" checked={options.show_description} onChange={(event) => updateOption("show_description", event.target.checked)} /> Mostrar descripción</label>
        <label><input type="checkbox" checked={options.show_attributes} onChange={(event) => updateOption("show_attributes", event.target.checked)} /> Mostrar atributos</label>
      </div>
    </section>
  );
}
