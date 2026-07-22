import React from 'react';

export function ToastStack({ items, onDismiss }) {
  if (!items.length) return null;
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {items.map((toast) => (
        <div key={toast.id} className={`toast-item ${toast.type === "error" ? "error" : "success"}`}>
          <div>
            <strong>{toast.type === "error" ? "Error" : "Exito"}</strong>
            <p>{toast.message}</p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => onDismiss(toast.id)}>
            Cerrar
          </button>
        </div>
      ))}
    </div>
  );
}
