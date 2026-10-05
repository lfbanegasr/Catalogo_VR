import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { CartProvider } from "./context/CartContext";
import { CustomerAccountProvider } from "./context/CustomerAccountContext";
import "./styles/global.css";

// Preconnect dinámico basado en VITE_API_BASE si está configurado
const apiBase = import.meta.env.VITE_API_BASE;
if (apiBase) {
  try {
    const origin = new URL(apiBase, window.location.href).origin;
    if (origin !== window.location.origin) {
      const link = document.createElement("link");
      link.rel = "preconnect";
      link.href = origin;
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    }
  } catch {
    // Si la URL no es válida se ignora de forma segura
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <CustomerAccountProvider>
      <CartProvider>
        <App />
      </CartProvider>
    </CustomerAccountProvider>
  </React.StrictMode>
);
