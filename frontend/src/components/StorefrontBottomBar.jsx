import React from "react";
import { useCart } from "../context/CartContext";
import { useCurrency } from "../context/CurrencyContext";
import { formatPrice } from "../utils/price";

export default function StorefrontBottomBar({
  onOpenCart,
  onGoHome,
  onOpenCategories,
  onFocusSearch,
}) {
  const { cartCount, cartTotal } = useCart();
  const currencySymbol = useCurrency();

  const handleHomeClick = () => {
    if (onGoHome) {
      onGoHome();
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleCategoriesClick = () => {
    if (onOpenCategories) {
      onOpenCategories();
    } else {
      const catElem = document.querySelector(".category-nav, .catalog-section.toolbar");
      if (catElem) {
        catElem.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const handleSearchClick = () => {
    if (onFocusSearch) {
      onFocusSearch();
    } else {
      const searchInput = document.querySelector(".catalog-search input");
      if (searchInput) {
        searchInput.scrollIntoView({ behavior: "smooth", block: "center" });
        searchInput.focus();
      }
    }
  };

  return (
    <nav className="storefront-bottom-bar" aria-label="Navegación rápida de tienda">
      <button
        type="button"
        className="bottom-bar-item"
        onClick={handleHomeClick}
        aria-label="Ir al inicio"
      >
        <span className="bottom-bar-icon">
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </span>
        <span className="bottom-bar-label">Inicio</span>
      </button>

      <button
        type="button"
        className="bottom-bar-item"
        onClick={handleCategoriesClick}
        aria-label="Ver categorías"
      >
        <span className="bottom-bar-icon">
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        </span>
        <span className="bottom-bar-label">Categorías</span>
      </button>

      <button
        type="button"
        className="bottom-bar-item"
        onClick={handleSearchClick}
        aria-label="Buscar productos"
      >
        <span className="bottom-bar-icon">
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <span className="bottom-bar-label">Buscar</span>
      </button>

      <button
        type="button"
        className={`bottom-bar-item bottom-bar-cart ${cartCount > 0 ? "has-items" : ""}`}
        onClick={onOpenCart}
        aria-label={`Ver carrito, ${cartCount} productos`}
      >
        <span className="bottom-bar-icon cart-icon-wrap">
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          {cartCount > 0 ? (
            <span className="bottom-bar-badge" aria-hidden="true">{cartCount}</span>
          ) : null}
        </span>
        <span className="bottom-bar-label">
          {cartCount > 0 && cartTotal > 0 ? formatPrice(cartTotal, currencySymbol) : "Bolsa"}
        </span>
      </button>
    </nav>
  );
}
