import { useEffect, useMemo, useState } from "react";
import { buildAssetUrl } from "../api/api";
import { useCustomerAccount } from "../context/CustomerAccountContext";

const ICONS = {
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  user: <><path d="M20 21a8 8 0 00-16 0" /><circle cx="12" cy="7" r="4" /></>,
  phone: <path d="M6.6 10.8a15.4 15.4 0 006.6 6.6l2.2-2.2a1 1 0 011-.24 11.5 11.5 0 003.6.57 1 1 0 011 1V20a1 1 0 01-1 1C10.6 21 3 13.4 3 4a1 1 0 011-1h3.5a1 1 0 011 1 11.5 11.5 0 00.57 3.6 1 1 0 01-.25 1z" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  orders: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>,
  social: <><circle cx="12" cy="12" r="9" /><path d="M8 12h8M12 8v8" /></>,
};

function Icon({ name, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

function normalizeExternalUrl(value, network) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const username = raw.replace(/^@/, "");
  const bases = {
    instagram: "https://instagram.com/",
    tiktok: "https://tiktok.com/@",
    facebook: "https://facebook.com/",
  };
  return (bases[network] || "https://") + username;
}

function AccountPanel({ open, initialView, onClose }) {
  const { customer, orders, login, register, logout, loadOrders } = useCustomerAccount();
  const [view, setView] = useState(initialView || "login");
  const [form, setForm] = useState({ nombre_completo: "", email: "", telefono: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const nextView = customer ? (initialView === "orders" ? "orders" : "account") : (initialView || "login");
    setView(nextView);
    setError("");
    if (nextView === "orders" && customer) loadOrders().catch((err) => setError(err.message));
  }, [customer, initialView, open]);

  if (!open) return null;

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (view === "register") await register(form);
      else await login({ email: form.email, password: form.password });
      setView("account");
    } catch (err) {
      setError(err.message || "No se pudo completar el acceso.");
    } finally {
      setBusy(false);
    }
  };

  const showOrders = async () => {
    setView("orders");
    setBusy(true);
    setError("");
    try {
      await loadOrders();
    } catch (err) {
      setError(err.message || "No se pudieron cargar tus pedidos.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="store-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="account-panel" role="dialog" aria-modal="true" aria-label="Cuenta de cliente">
        <button className="panel-close" type="button" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button>
        {!customer ? (
          <>
            <div className="account-panel-head">
              <span>Tu cuenta</span>
              <h2>{view === "register" ? "Crear una cuenta" : "Bienvenido de nuevo"}</h2>
              <p>Usa tu correo para consultar todos tus pedidos en esta tienda.</p>
            </div>
            <div className="account-tabs">
              <button type="button" className={view === "login" ? "active" : ""} onClick={() => setView("login")}>Iniciar sesión</button>
              <button type="button" className={view === "register" ? "active" : ""} onClick={() => setView("register")}>Registrarme</button>
            </div>
            <form className="account-form" onSubmit={submit}>
              {view === "register" ? (
                <>
                  <label>Nombre completo<input required autoComplete="name" value={form.nombre_completo} onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })} /></label>
                  <label>Teléfono opcional<input autoComplete="tel" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></label>
                </>
              ) : null}
              <label>Correo electrónico<input required type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              <label>Contraseña<input required minLength="6" type="password" autoComplete={view === "register" ? "new-password" : "current-password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
              {error ? <p className="account-error">{error}</p> : null}
              <button className="btn btn-primary" disabled={busy}>{busy ? "Procesando..." : view === "register" ? "Crear mi cuenta" : "Entrar"}</button>
            </form>
          </>
        ) : view === "orders" ? (
          <>
            <div className="account-panel-head"><span>Mi cuenta</span><h2>Mis pedidos</h2><p>{customer.email}</p></div>
            {error ? <p className="account-error">{error}</p> : null}
            <div className="customer-orders">
              {busy ? <p>Cargando pedidos...</p> : null}
              {!busy && orders.length === 0 ? <div className="customer-orders-empty"><Icon name="orders" size={30} /><p>Aún no tienes pedidos registrados con este correo.</p></div> : null}
              {orders.map((order) => (
                <article className="customer-order-card" key={order.codigo_seguimiento}>
                  <div><strong>Pedido {order.codigo_seguimiento}</strong><span className="order-status">{String(order.estado).replaceAll("_", " ")}</span></div>
                  <p>{new Date(order.fecha_pedido).toLocaleDateString("es-BO")} · {order.productos.reduce((sum, item) => sum + Number(item.cantidad || 0), 0)} productos</p>
                  <b>Bs. {Number(order.total_venta || 0).toFixed(2)}</b>
                </article>
              ))}
            </div>
            <button className="btn btn-ghost" type="button" onClick={() => setView("account")}>Volver a mi cuenta</button>
          </>
        ) : (
          <>
            <div className="account-panel-head"><span>Mi cuenta</span><h2>Hola, {customer.nombre_completo}</h2><p>{customer.email}</p></div>
            <button className="account-action-card" type="button" onClick={showOrders}><Icon name="orders" /><span><strong>Mis pedidos</strong><small>Consulta el estado y tu historial</small></span></button>
            <button className="btn btn-ghost" type="button" onClick={() => { logout(); setView("login"); }}>Cerrar sesión</button>
          </>
        )}
      </section>
    </div>
  );
}

export default function StorefrontHeader({ storeName, themeConfig = {}, whatsappNumber }) {
  const { customer } = useCustomerAccount();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountView, setAccountView] = useState("login");
  const logo = themeConfig.hero_logo_url;
  const links = useMemo(() => [
    { key: "whatsapp", label: themeConfig.contact_whatsapp || whatsappNumber, href: "https://wa.me/" + String(themeConfig.contact_whatsapp || whatsappNumber || "").replace(/\D/g, ""), icon: "phone" },
    { key: "phone", label: themeConfig.contact_phone, href: "tel:" + (themeConfig.contact_phone || ""), icon: "phone" },
    { key: "email", label: themeConfig.contact_email, href: "mailto:" + (themeConfig.contact_email || ""), icon: "mail" },
    { key: "instagram", label: themeConfig.social_instagram, href: normalizeExternalUrl(themeConfig.social_instagram, "instagram"), icon: "social" },
    { key: "tiktok", label: themeConfig.social_tiktok, href: normalizeExternalUrl(themeConfig.social_tiktok, "tiktok"), icon: "social" },
    { key: "facebook", label: themeConfig.social_facebook, href: normalizeExternalUrl(themeConfig.social_facebook, "facebook"), icon: "social" },
  ].filter((item) => item.label), [themeConfig, whatsappNumber]);

  const openAccount = (view) => {
    setAccountView(view);
    setMenuOpen(false);
    setAccountOpen(true);
  };

  return (
    <>
      <header className="storefront-topbar">
        <div className="storefront-topbar-inner">
          <button type="button" className="topbar-icon-btn" onClick={() => setMenuOpen(true)} aria-label="Abrir menú"><Icon name="menu" /></button>
          <div className="storefront-brand">
            {logo ? <img src={buildAssetUrl(logo)} alt={"Logo de " + storeName} /> : <span className="storefront-brand-mark">{String(storeName || "T").slice(0, 1)}</span>}
            <strong>{storeName || "Tienda"}</strong>
          </div>
          <div className="topbar-actions">
            <button type="button" className="topbar-account-btn" onClick={() => openAccount(customer ? "account" : "login")}>
              <span>{customer ? "Mi cuenta" : "Entrar"}</span><Icon name="user" size={20} />
            </button>
          </div>
        </div>
      </header>

      {menuOpen ? <div className="store-menu-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setMenuOpen(false); }} /> : null}
      <aside className={"store-side-menu " + (menuOpen ? "open" : "")} aria-hidden={!menuOpen}>
        <div className="store-side-menu-account">
          <button className="panel-close light" type="button" onClick={() => setMenuOpen(false)} aria-label="Cerrar"><Icon name="close" /></button>
          <p>{customer ? customer.nombre_completo : "Tu cuenta de cliente"}</p>
          <button type="button" onClick={() => openAccount(customer ? "account" : "login")}>{customer ? "MI CUENTA" : "INICIAR SESIÓN / REGISTRARSE"}</button>
          <button type="button" onClick={() => openAccount(customer ? "orders" : "login")}>MIS PEDIDOS</button>
        </div>
        <div className="store-side-menu-info">
          <h2>{themeConfig.side_menu_title || storeName || "Tienda"}</h2>
          {themeConfig.side_menu_text ? <p>{themeConfig.side_menu_text}</p> : null}
          <nav aria-label="Contacto y redes sociales">
            {links.map((link) => <a key={link.key} href={link.href} target={link.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer"><Icon name={link.icon} size={20} /><span>{link.label}</span></a>)}
          </nav>
          {!links.length ? <p className="side-menu-empty">La tienda todavía no publicó datos de contacto.</p> : null}
        </div>
      </aside>
      <AccountPanel open={accountOpen} initialView={accountView} onClose={() => setAccountOpen(false)} />
    </>
  );
}