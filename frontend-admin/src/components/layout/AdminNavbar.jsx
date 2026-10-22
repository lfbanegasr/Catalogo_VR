import React, { useState } from "react";
import {
  MenuIcon,
  SearchIcon,
  StoreIcon,
  SunIcon,
  MoonIcon,
  BellIcon,
  ChevronDownIcon,
  ExternalLinkIcon
} from "../common/Icons";
import { useTheme } from "./ThemeContext";
import { buildPublicStoreUrl } from "../../utils";

export default function AdminNavbar({
  user,
  store,
  onOpenNav,
  onLogout
}) {
  const { theme, toggleTheme } = useTheme();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const storeName = store?.nombre_tienda || "Mi Tienda";
  const publicStoreSlug = store?.slug || "";
  const publicStoreUrl = buildPublicStoreUrl(publicStoreSlug);

  return (
    <header className="modern-navbar">
      {/* Zona Izquierda: Hamburguesa Móvil + Buscador */}
      <div className="navbar-left">
        <button
          type="button"
          className="mobile-toggle-btn"
          onClick={onOpenNav}
          aria-label="Abrir menú"
        >
          <MenuIcon size={20} />
        </button>

        <div className="nav-search-container">
          <SearchIcon size={16} />
          <input
            type="text"
            className="nav-search-input"
            placeholder="Buscar productos, clientes, pedidos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="shortcut-badge">⌘K</span>
        </div>
      </div>

      {/* Zona Derecha: Tienda, Estado, Theme Switcher, Notificaciones y Perfil */}
      <div className="navbar-right">
        {/* Selector / Indicador de Tienda */}
        <div
          className="store-select-pill"
          title={publicStoreUrl ? `Ver catálogo público: ${publicStoreUrl}` : `Tienda activa: ${storeName}`}
          onClick={() => {
            if (publicStoreUrl) {
              window.open(publicStoreUrl, "_blank", "noopener,noreferrer");
            }
          }}
        >
          <StoreIcon size={15} />
          <span className="store-name-text">{storeName}</span>
          {publicStoreSlug && <ExternalLinkIcon size={13} className="store-ext-icon" />}
        </div>

        {/* Badge de Estado En Línea */}
        <div className="status-live-badge" title="Tienda abierta y recibiendo pedidos">
          <span className="pulse-dot" />
          <span className="status-live-text">En Línea</span>
        </div>

        {/* Switcher de Tema (Claro / Oscuro) */}
        <button
          type="button"
          className="theme-switch-btn"
          onClick={toggleTheme}
          title={theme === "dark" ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
          aria-label="Cambiar tema de color"
        >
          {theme === "dark" ? <SunIcon size={18} /> : <MoonIcon size={18} />}
        </button>

        {/* Notificaciones */}
        <button
          type="button"
          className="nav-icon-btn"
          title="Notificaciones de ventas"
          aria-label="Notificaciones"
        >
          <BellIcon size={18} />
          <span className="notification-dot" />
        </button>

        {/* Chip de Perfil de Usuario */}
        <div style={{ position: "relative" }}>
          <div
            className="nav-user-chip"
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            title={user?.email}
          >
            <div className="nav-user-avatar">
              {String(user?.email || "U").charAt(0).toUpperCase()}
            </div>
            <span className="nav-user-name">
              {(user?.email || "Usuario").split("@")[0]}
            </span>
            <ChevronDownIcon size={13} className="nav-user-chevron" />
          </div>

          {userDropdownOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 8px)",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "14px",
                boxShadow: "var(--card-shadow)",
                padding: "8px",
                minWidth: "180px",
                zIndex: 60,
                display: "flex",
                flexDirection: "column",
                gap: "4px"
              }}
            >
              <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  {user?.email}
                </div>
                <div style={{ fontSize: "0.68rem", color: "var(--brand-primary)", textTransform: "uppercase", fontWeight: 700 }}>
                  Rol: {user?.rol}
                </div>
              </div>
              <button
                type="button"
                className="nav-item-btn"
                style={{ fontSize: "0.8rem", padding: "8px 10px", color: "var(--badge-danger-text)" }}
                onClick={() => {
                  setUserDropdownOpen(false);
                  onLogout();
                }}
              >
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
