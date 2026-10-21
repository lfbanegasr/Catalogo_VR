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
import AdminSidebar from "./components/layout/AdminSidebar";
import AdminNavbar from "./components/layout/AdminNavbar";
import { ThemeProvider } from "./components/layout/ThemeContext";

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
  const [store, setStore] = useState(null);
  const menu = useMemo(() => menuByRole(user.rol), [user.rol]);

  useEffect(() => {
    let active = true;
    if (user?.id_tienda) {
      api.adminGetMyStore()
        .then((s) => {
          if (active) setStore(s);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [user?.id_tienda]);

  useEffect(() => {
    setNavOpen(false);
  }, [section]);

  const navigateTo = (key) => {
    setNavOpen(false);
    onSection(key);
  };

  return (
    <div className="admin-shell-v2">
      <AdminSidebar
        user={user}
        menu={menu}
        section={section}
        navOpen={navOpen}
        onCloseNav={() => setNavOpen(false)}
        onNavigate={navigateTo}
        onLogout={onLogout}
      />

      <div className="admin-main-wrapper">
        <AdminNavbar
          user={user}
          store={store}
          onOpenNav={() => setNavOpen(true)}
          onLogout={onLogout}
        />
        <main style={{ flex: 1, minWidth: 0, width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>{children}</main>
      </div>
    </div>
  );
}

function AppInner() {
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

  const login = async (identifier, password) => {
    const data = await api.login(identifier, password);
    setToken(data.access_token);
    setTokenState(data.access_token);
    setUser(data.user || null);
  };

  if (booting) {
    return (
      <main className="auth-shell">
        <div className="auth-card" style={{ alignItems: "center", justifyContent: "center", minHeight: "220px", textAlign: "center" }}>
          <span className="auth-spinner" style={{ width: "32px", height: "32px", borderWidth: "3px", borderColor: "var(--border-subtle)", borderTopColor: "var(--brand-primary)" }} />
          <p style={{ margin: "16px 0 0", fontSize: "0.88rem", fontWeight: 600, color: "var(--text-secondary)" }}>
            Iniciando panel administrativo...
          </p>
        </div>
      </main>
    );
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
      <ThemeAppearanceScreen
        isSuperadmin={user.rol === "superadmin"}
        Card={Card}
        HelperText={HelperText}
        StoreRefPicker={StoreRefPicker}
      />
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

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}
