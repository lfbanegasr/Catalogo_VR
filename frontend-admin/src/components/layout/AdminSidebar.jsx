import React from "react";
import {
  BrandShieldIcon,
  DashboardIcon,
  VentasIcon,
  CatalogoIcon,
  ClientesIcon,
  OfertasIcon,
  TemaIcon,
  UsuariosIcon,
  TiendasIcon,
  AuditoriaIcon,
  LogOutIcon,
  CloseIcon
} from "../common/Icons";

const ICONS_BY_KEY = {
  dashboard: DashboardIcon,
  ventas: VentasIcon,
  catalogo: CatalogoIcon,
  clientes: ClientesIcon,
  ofertas: OfertasIcon,
  tema: TemaIcon,
  usuarios: UsuariosIcon,
  tiendas: TiendasIcon,
  auditoria: AuditoriaIcon,
};

export default function AdminSidebar({
  user,
  menu,
  section,
  navOpen,
  onCloseNav,
  onNavigate,
  onLogout
}) {
  return (
    <>
      {navOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseNav}
          aria-label="Cerrar menú lateral"
        />
      )}

      <aside className={`modern-sidebar ${navOpen ? "is-open" : ""}`}>
        {/* Encabezado con Logo y Marca */}
        <div className="sidebar-header">
          <div className="brand-wrapper" onClick={() => onNavigate("dashboard")}>
            <BrandShieldIcon size={34} />
            <div className="brand-text-block">
              <h2 className="brand-title">Tienda SaaS</h2>
              <span className="brand-badge">Admin Portal</span>
            </div>
          </div>
          {navOpen && (
            <button
              type="button"
              className="logout-icon-btn mobile-only"
              onClick={onCloseNav}
              aria-label="Cerrar menú"
            >
              <CloseIcon size={18} />
            </button>
          )}
        </div>

        {/* Lista de Navegación */}
        <div className="sidebar-nav-container">
          <p className="nav-section-title">Menú Principal</p>
          <nav aria-label="Navegación del panel">
            {menu.map(([key, label]) => {
              const IconComponent = ICONS_BY_KEY[key] || DashboardIcon;
              const isActive = key === section;
              return (
                <button
                  key={key}
                  type="button"
                  className={`nav-item-btn ${isActive ? "active" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => onNavigate(key)}
                >
                  <span className="nav-icon">
                    <IconComponent size={19} />
                  </span>
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Perfil del Usuario en el Pie del Sidebar */}
        <div className="sidebar-footer-profile">
          <div className="user-avatar-circle">
            {String(user?.email || "A").charAt(0).toUpperCase()}
          </div>
          <div className="user-meta-block">
            <p className="user-email-text" title={user?.email || "admin"}>
              {user?.email || "Administrador"}
            </p>
            <span className="user-role-tag">{user?.rol || "admin"}</span>
          </div>
          <button
            type="button"
            className="logout-icon-btn"
            onClick={onLogout}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOutIcon size={18} />
          </button>
        </div>
      </aside>
    </>
  );
}
