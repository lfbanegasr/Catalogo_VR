import React, { useEffect, useMemo, useState } from "react";
import { api, clearToken, getToken, setToken } from "./api";
import ThemeAppearanceScreen from "./components/ThemeAppearanceScreen";
import StoreRefPicker from "./components/StoreRefPicker";
import { Card, HelperText } from "./components/Card";
import StoreWhatsappCard from "./components/tema/StoreWhatsappCard";
import { LoginPage, ForgotPasswordPage, ResetPasswordPage } from "./components/auth/LoginScreens";
import TiendasScreen from "./components/tiendas/TiendasScreen";
import UsuariosScreen from "./components/usuarios/UsuariosScreen";
import CatalogoScreen from "./components/catalogo/CatalogoScreen";
import VentasScreen from "./components/ventas/VentasScreen";
import ClientesScreen from "./components/clientes/ClientesScreen";
import OffersScreen from "./components/catalogo/OffersScreen";
import AuditoriaScreen from "./components/auditoria/AuditoriaScreen";
import DashboardScreen from "./components/dashboard/DashboardScreen";

const canUseCatalog = (rol) => ["superadmin", "admin", "empleado"].includes(rol);

function menuByRole(role) {
  if (role === "superadmin") {
    return [
      ["tiendas", "Tiendas"],
      ["usuarios", "Usuarios"],
      ["catalogo", "Catalogo"],
      ["tema", "Tema"],
      ["ofertas", "Ofertas"],
      ["auditoria", "Auditoria"]
    ];
  }
  if (role === "admin") {
    return [
      ["dashboard", "Dashboard"],
      ["ventas", "Ventas"],
      ["clientes", "Clientes"],
      ["catalogo", "Catalogo"],
      ["tema", "Tema"],
      ["ofertas", "Ofertas"],
      ["usuarios", "Empleados"] // Administradores pueden gestionar empleados
    ];
  }
  if (role === "empleado") {
    return [
      ["dashboard", "Dashboard"],
      ["ventas", "Ventas"],
      ["clientes", "Clientes"],
      ["catalogo", "Catalogo"],
      ["ofertas", "Ofertas"]
    ];
  }
  return [["dashboard", "Dashboard"]];
}

function usePath() {
  const [path, setPath] = useState(window.location.pathname || "/admin/login");
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname || "/admin/login");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const go = (to) => {
    if (to === path) return;
    window.history.pushState({}, "", to);
    setPath(to);
  };
  return { path, go };
}

function Layout({ user, section, onSection, onLogout, children }) {
  const [navOpen, setNavOpen] = useState(false);
  const menu = useMemo(() => menuByRole(user.rol), [user.rol]);
  const labelForSection = useMemo(() => {
    const item = menu.find(([key]) => key === section);
    return item ? item[1] : section;
  }, [menu, section]);

  useEffect(() => {
    setNavOpen(false);
  }, [section]);

  const navigateTo = (key) => {
    setNavOpen(false);
    onSection(key);
  };

  return (
    <div className="admin-shell">
      <header className="mobile-admin-bar">
        <button
          type="button"
          className="admin-icon-button"
          aria-label="Abrir menú"
          aria-expanded={navOpen}
          onClick={() => setNavOpen(true)}
        >
          <span /><span /><span />
        </button>
        <div className="mobile-admin-title">
          <small>Administración</small>
          <strong>{labelForSection}</strong>
        </div>
        <button type="button" className="mobile-logout" onClick={onLogout}>Salir</button>
      </header>

      {navOpen ? <button type="button" className="sidebar-backdrop" aria-label="Cerrar menú" onClick={() => setNavOpen(false)} /> : null}

      <aside className={`sidebar ${navOpen ? "is-open" : ""}`}>
        <div className="brand">
          <div className="brand-heading">
            <span className="brand-mark" aria-hidden="true">TS</span>
            <div>
              <p className="eyebrow">Tienda SaaS</p>
              <h2>Administración</h2>
            </div>
          </div>
          <button type="button" className="sidebar-close" aria-label="Cerrar menú" onClick={() => setNavOpen(false)}>×</button>
        </div>

        <div className="sidebar-profile">
          <span className="profile-avatar" aria-hidden="true">{String(user.email || "A").charAt(0).toUpperCase()}</span>
          <div className="profile-copy">
            <strong>{user.email}</strong>
            <span className={`role-chip role-${user.rol}`}>{user.rol}</span>
          </div>
        </div>

        <p className="menu-label">Menú principal</p>
        <nav className="menu" aria-label="Secciones del administrador">
          {menu.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`menu-item ${key === section ? "active" : ""}`}
              aria-current={key === section ? "page" : undefined}
              onClick={() => navigateTo(key)}
            >
              <span className="menu-item-icon" aria-hidden="true">{label.charAt(0)}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="sidebar-logout" onClick={onLogout}>
            <span aria-hidden="true">↪</span>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="content">{children}</main>
    </div>
  );
}

function App() {
  const { path, go } = usePath();
  const [token, setTokenState] = useState(getToken());
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const publicAuthPaths = ["/admin/login", "/admin/forgot-password", "/admin/reset-password"];
  const section = useMemo(() => {
    const parts = path.split("/").filter(Boolean);
    return parts[0] === "admin" ? parts[1] || "dashboard" : "dashboard";
  }, [path]);

  useEffect(() => {
    const boot = async () => {
      if (!token) return setBooting(false);
      try {
        setUser(await api.me());
      } catch {
        clearToken();
        setTokenState("");
        setUser(null);
      } finally {
        setBooting(false);
      }
    };
    boot();
  }, [token]);

  useEffect(() => {
    const isPublicAuthPath = publicAuthPaths.includes(path);
    if (!token && !isPublicAuthPath) go("/admin/login");
    if (token && user && isPublicAuthPath) {
      go(`/admin/${menuByRole(user.rol)[0]?.[0] || "dashboard"}`);
    }
  }, [token, user, path]);

  const login = async (email, password) => {
    const data = await api.login(email, password);
    setToken(data.access_token);
    setTokenState(data.access_token);
    setUser(data.user || null);
  };

  if (booting) {
    return <main className="auth-shell"><div className="auth-card">Cargando...</div></main>;
  }

  if (!token || !user) {
    if (path === "/admin/forgot-password") {
      return <ForgotPasswordPage onBackToLogin={() => go("/admin/login")} />;
    }
    if (path === "/admin/reset-password") {
      return <ResetPasswordPage onBackToLogin={() => go("/admin/login")} />;
    }
    return <LoginPage onLogin={login} onForgotPassword={() => go("/admin/forgot-password")} />;
  }

  let content = <DashboardScreen user={user} onGoToVentas={() => go("/admin/ventas")} />;
  if (section === "tiendas" && user.rol === "superadmin") {
    content = <TiendasScreen />;
  }
  if (section === "usuarios" && ["superadmin", "admin"].includes(user.rol)) {
    content = <UsuariosScreen user={user} />;
  }
  if (section === "catalogo" && canUseCatalog(user.rol)) {
    content = <CatalogoScreen isSuperadmin={user.rol === "superadmin"} />;
  }
  if (section === "ventas" && canUseCatalog(user.rol)) {
    content = <VentasScreen user={user} />;
  }
  if (section === "clientes" && ["admin", "empleado"].includes(user.rol)) {
    content = <ClientesScreen user={user} />;
  }
  if (section === "tema" && ["superadmin", "admin"].includes(user.rol)) {
    content = (
      <div className="stack">
        <ThemeAppearanceScreen
          isSuperadmin={user.rol === "superadmin"}
          Card={Card}
          HelperText={HelperText}
          StoreRefPicker={StoreRefPicker}
        />
        {user.rol === "admin" && <StoreWhatsappCard />}
      </div>
    );
  }
  if (section === "ofertas" && canUseCatalog(user.rol)) {
    content = <OffersScreen isSuperadmin={user.rol === "superadmin"} />;
  }
  if (section === "auditoria" && user.rol === "superadmin") {
    content = <AuditoriaScreen />;
  }

  return (
    <Layout
      user={user}
      section={section}
      onSection={(s) => go(`/admin/${s}`)}
      onLogout={() => {
        clearToken();
        setTokenState("");
        setUser(null);
        go("/admin/login");
      }}
    >
      {content}
    </Layout>
  );
}

export default App;
