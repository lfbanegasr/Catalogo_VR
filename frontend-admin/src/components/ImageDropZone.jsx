import React, { useMemo, useState } from "react";

const DEFAULT_ACCEPT = "image/jpeg,image/png,image/webp";
const DEFAULT_TYPES = new Set(DEFAULT_ACCEPT.split(","));
const DEFAULT_MAX_SIZE = 5 * 1024 * 1024;

export default function ImageDropZone({
  title,
  subtitle,
  selectedFileName,
  statusText,
  errorText,
  compact = false,
  disabled = false,
  className = "",
  buttonLabel = "Seleccionar archivo",
  previewUrl = "",
  previewAlt = "Vista previa de la imagen",
  accept = DEFAULT_ACCEPT,
  maxSizeBytes = DEFAULT_MAX_SIZE,
  onFileSelected,
}) {
  const [dragging, setDragging] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [lastFileName, setLastFileName] = useState("");
  const inputId = useMemo(
    () => `image-dropzone-${Math.random().toString(36).slice(2)}`,
    [],
  );

  const pickFile = (file) => {
    if (!file || disabled) return;
    const allowedTypes = accept === DEFAULT_ACCEPT
      ? DEFAULT_TYPES
      : new Set(String(accept).split(",").map((value) => value.trim()).filter(Boolean));

    if (!allowedTypes.has(file.type)) {
      setValidationError("Formato no permitido. Usa JPG, PNG o WEBP.");
      return;
    }
    if (file.size > maxSizeBytes) {
      setValidationError(`La imagen supera el máximo de ${Math.round(maxSizeBytes / 1024 / 1024)} MB.`);
      return;
    }

    setValidationError("");
    setLastFileName(file.name || "");
    onFileSelected(file);
  };

  return (
    <div
      className={`image-dropzone ${className} ${compact ? "compact" : ""} ${dragging ? "dragging" : ""} ${disabled ? "disabled" : ""}`.trim()}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        pickFile(event.dataTransfer?.files?.[0]);
      }}
    >
      {previewUrl ? (
        <div className="image-dropzone-preview">
          <img src={previewUrl} alt={previewAlt} />
        </div>
      ) : (
        <span className="image-dropzone-icon" aria-hidden="true">↥</span>
      )}
      <div className="image-dropzone-text">
        <strong>{dragging ? "Suelta la imagen aquí" : title}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
        {(lastFileName || selectedFileName) ? <span className="file-name">{lastFileName || selectedFileName}</span> : null}
        {statusText ? <span className="upload-status">{statusText}</span> : null}
        {(validationError || errorText) ? <span className="upload-error">{validationError || errorText}</span> : null}
      </div>
      <label className="btn btn-ghost file-btn" htmlFor={inputId}>
        {buttonLabel}
        <input
          id={inputId}
          type="file"
          accept={accept}
          disabled={disabled}
          onChange={(event) => {
            pickFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>
    </div>
  );
}