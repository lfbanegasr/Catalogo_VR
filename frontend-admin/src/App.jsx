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
  const labelForSection = useMemo(() => {
    const menu = menuByRole(user.rol);
    const item = menu.find(([k]) => k === section);
    return item ? item[1] : section;
  }, [user.rol, section]);

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand">
          <p className="eyebrow">Tienda SaaS</p>
          <h2>Admin</h2>
          <p className="muted small">{user.email}</p>
          <p className="chip" style={{
            textTransform: 'capitalize',
            background: user.rol === 'superadmin' ? '#fee2e2' : user.rol === 'admin' ? '#e0e7ff' : '#f3f4f6',
            color: user.rol === 'superadmin' ? '#991b1b' : user.rol === 'admin' ? '#3730a3' : '#374151'
          }}>{user.rol}</p>
        </div>
        <nav className="menu">
          {menuByRole(user.rol).map(([k, l]) => (
            <button
              key={k}
              className={`menu-item ${k === section ? "active" : ""}`}
              onClick={() => onSection(k)}
            >
              {l}
            </button>
          ))}
        </nav>
        <button className="btn btn-ghost" style={{ marginTop: 'auto' }} onClick={onLogout}>Cerrar sesion</button>
      </aside>
      <main className="content">
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, textTransform: 'capitalize' }}>
            {labelForSection}
          </h1>
        </div>
        {children}
      </main>
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
