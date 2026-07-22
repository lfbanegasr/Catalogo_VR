import React, { useState, useMemo } from 'react';

export default function ImageDropZone({
  title,
  subtitle,
  selectedFileName,
  statusText,
  errorText,
  compact = false,
  disabled = false,
  onFileSelected,
}) {
  const [dragging, setDragging] = useState(false);
  const inputId = useMemo(
    () => `image-dropzone-${Math.random().toString(36).slice(2)}`,
    [],
  );

  const pickFile = (file) => {
    if (!file || disabled) return;
    onFileSelected(file);
  };

  return (
    <div
      className={`image-dropzone ${compact ? "compact" : ""} ${dragging ? "dragging" : ""} ${disabled ? "disabled" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        pickFile(event.dataTransfer?.files?.[0]);
      }}
    >
      <div className="image-dropzone-text">
        <strong>{title}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
        {selectedFileName ? <span className="file-name">{selectedFileName}</span> : null}
        {statusText ? <span className="upload-status">{statusText}</span> : null}
        {errorText ? <span className="upload-error">{errorText}</span> : null}
      </div>
      <label className="btn btn-ghost file-btn" htmlFor={inputId}>
        Seleccionar archivo
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={disabled}
          onChange={(event) => pickFile(event.target.files?.[0])}
        />
      </label>
    </div>
  );
}
