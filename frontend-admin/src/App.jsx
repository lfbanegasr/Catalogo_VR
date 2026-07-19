import { useEffect, useMemo, useState } from "react";
import { api, clearToken, getToken, setToken } from "./api";
import { offersApi } from "./api/offers";
import ThemeAppearanceScreen from "./components/ThemeAppearanceScreen";

const canUseCatalog = (rol) => ["superadmin", "admin", "empleado"].includes(rol);

function menuByRole(role) {
  if (role === "superadmin") return [["tiendas", "Tiendas"], ["usuarios", "Usuarios"], ["catalogo", "Catalogo"], ["tema", "Tema"], ["ofertas", "Ofertas"], ["auditoria", "Auditoria"]];
  if (role === "admin") return [["dashboard", "Dashboard"], ["catalogo", "Catalogo"], ["tema", "Tema"], ["ofertas", "Ofertas"], ["auditoria", "Auditoria"]];
  if (role === "empleado") return [["catalogo", "Catalogo"], ["ofertas", "Ofertas"]];
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

function Card({ title, children, className = "" }) {
  return <section className={`card ${className}`.trim()}><div className="card-head"><h3>{title}</h3></div>{children}</section>;
}

function HelperText({ text }) {
  return <p className="helper-text">{text}</p>;
}

function SearchableStoreInput({ stores, value, onChange, listId, placeholder, required = false }) {
  const options = stores.map((s) => ({ value: s.id_tienda, label: s.nombre_tienda }));
  const map = useMemo(() => new Map(options.map((o) => [o.value, o.label])), [stores]);
  const [text, setText] = useState(value ? map.get(value) || "" : "");
  useEffect(() => setText(value ? map.get(value) || "" : ""), [value, map]);

  const resolve = (nextText) => {
    const exact = options.find((o) => o.label.toLowerCase() === nextText.toLowerCase());
    if (exact) return exact.value;
    const start = options.find((o) => o.label.toLowerCase().startsWith(nextText.toLowerCase()));
    return start ? start.value : "";
  };

  return (
    <label>
      Tienda
      <input
        list={listId}
        value={text}
        required={required}
        placeholder={placeholder}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          onChange(resolve(next));
        }}
      />
      <datalist id={listId}>{options.map((o) => <option key={o.value} value={o.label} />)}</datalist>
    </label>
  );
}

function StoreRefPicker({
  stores,
  value,
  onChange,
  required = false,
  label = "Tienda destino",
  placeholder = "Busca por nombre o slug...",
  helpText = "Puedes escribir nombre o slug.",
  allowEmpty = false,
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const selectedStore = useMemo(
    () => stores.find((store) => store.id_tienda === value) || null,
    [stores, value],
  );

  useEffect(() => {
    if (!selectedStore) {
      setText("");
      return;
    }
    setText(`${selectedStore.nombre_tienda} (${selectedStore.slug})`);
  }, [selectedStore]);

  const normalized = text.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (!normalized) return stores.slice(0, 8);
    return stores
      .filter((store) => {
        const name = store.nombre_tienda.toLowerCase();
        const slug = String(store.slug || "").toLowerCase();
        return name.includes(normalized) || slug.includes(normalized);
      })
      .slice(0, 8);
  }, [stores, normalized]);

  const selectStore = (store) => {
    if (!store) return;
    setText(`${store.nombre_tienda} (${store.slug})`);
    onChange(store.id_tienda);
    setOpen(false);
  };

  return (
    <label className="store-picker">
      <span className="store-picker-label">{label}</span>
      <div className="smart-search">
        <input
          value={text}
          required={required}
          autoComplete="off"
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => {
              const typed = text.trim().toLowerCase();
              if (typed) {
                const best = stores.find((store) => {
                  const label = `${store.nombre_tienda} (${store.slug})`.toLowerCase();
                  return (
                    store.nombre_tienda.toLowerCase() === typed ||
                    String(store.slug || "").toLowerCase() === typed ||
                    label === typed
                  );
                });
                if (best) {
                  selectStore(best);
                  return;
                }
              }
              setOpen(false);
            }, 100);
          }}
          onChange={(event) => {
            const next = event.target.value;
            setText(next);
            onChange("");
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && suggestions.length > 0) {
              event.preventDefault();
              selectStore(suggestions[0]);
            }
          }}
        />
        {open ? (
          <div className="smart-search-list">
            {allowEmpty ? (
              <button
                type="button"
                className="smart-search-item"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setText("");
                  onChange("");
                  setOpen(false);
                }}
              >
                <span>Todas las tiendas</span>
                <small>Sin filtro</small>
              </button>
            ) : null}
            {suggestions.length === 0 ? (
              <button type="button" className="smart-search-item empty" disabled>
                Sin resultados
              </button>
            ) : suggestions.map((store) => (
              <button
                key={store.id_tienda}
                type="button"
                className="smart-search-item"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectStore(store)}
              >
                <span>{store.nombre_tienda}</span>
                <small>{store.slug}</small>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <span className="store-picker-help">
        {helpText}
      </span>
    </label>
  );
}

function SearchableTargetInput({
  items,
  value,
  onChange,
  getKey,
  getLabel,
  label,
  placeholder,
  helpText = "",
  required = false,
}) {
  const options = useMemo(
    () => items.map((item) => ({ value: getKey(item), label: getLabel(item) })),
    [items, getKey, getLabel],
  );
  const [text, setText] = useState("");
  const listId = useMemo(() => `target-picker-${Math.random().toString(36).slice(2)}`, []);

  useEffect(() => {
    const selected = options.find((option) => option.value === value);
    setText(selected?.label || "");
  }, [options, value]);

  const resolve = (nextText) => {
    const normalized = nextText.trim().toLowerCase();
    if (!normalized) return "";
    const exact = options.find((option) => option.label.toLowerCase() === normalized);
    if (exact) return exact.value;
    const partial = options.find((option) => option.label.toLowerCase().includes(normalized));
    return partial ? partial.value : "";
  };

  return (
    <label>
      {label}
      <input
        list={listId}
        value={text}
        required={required}
        placeholder={placeholder}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          onChange(resolve(next));
        }}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option.value} value={option.label} />
        ))}
      </datalist>
      {helpText ? <HelperText text={helpText} /> : null}
    </label>
  );
}

function ImageDropZone({
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

function getImageSrc(imagenUrl) {
  if (!imagenUrl) return "";
  if (/^https?:\/\//i.test(imagenUrl)) return imagenUrl;
  return imagenUrl;
}

function toInputDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function createOfferFormState(offer = null) {
  return {
    nombre: offer?.nombre || "",
    tipo: offer?.tipo || "PERCENT",
    porcentaje: offer?.porcentaje ?? "",
    prioridad: offer?.prioridad ?? 0,
    activa: offer?.activa ?? true,
    fecha_inicio: toInputDateTime(offer?.fecha_inicio),
    fecha_fin: toInputDateTime(offer?.fecha_fin),
    badge_text: offer?.badge_text || "",
  };
}

function normalizeOfferPayload(form) {
  return {
    nombre: form.nombre.trim(),
    tipo: form.tipo,
    porcentaje: form.tipo === "PERCENT" ? Number(form.porcentaje || 0) : null,
    prioridad: Number(form.prioridad || 0),
    activa: Boolean(form.activa),
    fecha_inicio: form.fecha_inicio || null,
    fecha_fin: form.fecha_fin || null,
    badge_text: form.badge_text.trim() || null,
  };
}

function formatOfferValue(offer) {
  if (offer.tipo === "PERCENT") {
    return `${offer.porcentaje ?? 0}%`;
  }
  return "Por producto";
}

function ToastStack({ items, onDismiss }) {
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

function ModalFrame({ title, subtitle, onClose, children, wide = false }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal-card ${wide ? "wide" : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cerrar</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function LoginPage({ onLogin, onForgotPassword }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try { await onLogin(email, password); } catch (err) { setError(err.message || "Error login"); } finally { setLoading(false); }
      }}>
        <p className="eyebrow">Panel privado</p>
        <h1>Iniciar sesion</h1>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <HelperText text="Ingresa un usuario activo del sistema." />
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        <HelperText text="Autenticacion JWT con roles por tienda." />
        {error ? <p className="error-text">{error}</p> : null}
        <button className="btn btn-primary" disabled={loading}>{loading ? "Ingresando..." : "Ingresar"}</button>
        <button type="button" className="btn btn-ghost" onClick={onForgotPassword}>Olvidaste tu contrasena</button>
      </form>
    </main>
  );
}

function ForgotPasswordPage({ onBackToLogin }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [debugResetUrl, setDebugResetUrl] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={async (event) => {
        event.preventDefault();
        setLoading(true);
        setError("");
        setMessage("");
        setDebugResetUrl("");
        try {
          const response = await api.forgotPassword(email);
          setMessage(response.message || "Revisa tu correo.");
          setDebugResetUrl(response.reset_url || "");
        } catch (err) {
          setError(err.message || "No se pudo procesar la solicitud");
        } finally {
          setLoading(false);
        }
      }}>
        <p className="eyebrow">Recuperacion</p>
        <h1>Olvidaste tu contrasena</h1>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <HelperText text="Si el usuario existe, enviaremos un enlace de recuperacion." />
        {message ? <p className="ok-text">{message}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        {debugResetUrl ? <a className="current-image-link" href={debugResetUrl}>Abrir enlace de recuperacion</a> : null}
        <button className="btn btn-primary" disabled={loading}>{loading ? "Enviando..." : "Enviar enlace"}</button>
        <button type="button" className="btn btn-ghost" onClick={onBackToLogin}>Volver al login</button>
      </form>
    </main>
  );
}

function ResetPasswordPage({ onBackToLogin }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const token = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("token") || "";
  }, []);

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={async (event) => {
        event.preventDefault();
        if (!token) {
          setError("Falta token de recuperacion.");
          return;
        }
        if (password !== confirm) {
          setError("Las contrasenas no coinciden.");
          return;
        }
        setLoading(true);
        setError("");
        setMessage("");
        try {
          const response = await api.resetPassword(token, password);
          setMessage(response.message || "Contrasena actualizada.");
        } catch (err) {
          setError(err.message || "No se pudo restablecer la contrasena");
        } finally {
          setLoading(false);
        }
      }}>
        <p className="eyebrow">Recuperacion</p>
        <h1>Nueva contrasena</h1>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        <label>Confirmar password<input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></label>
        <HelperText text="Minimo 6 caracteres." />
        {message ? <p className="ok-text">{message}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        <button className="btn btn-primary" disabled={loading}>{loading ? "Guardando..." : "Guardar nueva contrasena"}</button>
        <button type="button" className="btn btn-ghost" onClick={onBackToLogin}>Volver al login</button>
      </form>
    </main>
  );
}

function Layout({ user, section, onSection, onLogout, children }) {
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand"><p className="eyebrow">Tienda SaaS</p><h2>Admin</h2><p className="muted small">{user.email}</p><p className="chip">{user.rol}</p></div>
        <nav className="menu">{menuByRole(user.rol).map(([k, l]) => <button key={k} className={`menu-item ${k === section ? "active" : ""}`} onClick={() => onSection(k)}>{l}</button>)}</nav>
        <button className="btn btn-ghost" onClick={onLogout}>Cerrar sesion</button>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

function TiendasScreen() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ nombre_tienda: "", slug: "", whatsapp_number: "", dominio_personalizado: "", activa: true });
  const [editing, setEditing] = useState(null);

  const load = async () => setRows(await api.adminListTiendas());
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  return (
    <div className="stack">
      <Card title="Tiendas">
        {error ? <p className="error-text">{error}</p> : null}
        <div className="table-wrap"><table><thead><tr><th>Nombre</th><th>Slug</th><th>WhatsApp</th><th>Activa</th><th>Acciones</th></tr></thead><tbody>
          {rows.map((r) => <tr key={r.id_tienda}><td>{r.nombre_tienda}</td><td>{r.slug}</td><td>{r.whatsapp_number || "-"}</td><td>{r.activa ? "Si" : "No"}</td><td className="actions-cell">
            <button className="btn btn-ghost" onClick={() => setEditing({ ...r })}>Editar</button>
            <button className="btn btn-ghost" onClick={async () => { try { await api.adminUpdateTienda(r.id_tienda, { activa: !r.activa }); await load(); } catch (e) { setError(e.message); } }}>{r.activa ? "Desactivar" : "Activar"}</button>
          </td></tr>)}
        </tbody></table></div>

        {editing ? <div className="inline-editor"><h4>Editar tienda</h4><div className="grid-form">
          <label>Nombre<input value={editing.nombre_tienda || ""} onChange={(e) => setEditing((s) => ({ ...s, nombre_tienda: e.target.value }))} /></label>
          <label>Slug<input value={editing.slug || ""} onChange={(e) => setEditing((s) => ({ ...s, slug: e.target.value }))} /></label>
          <label>WhatsApp<input value={editing.whatsapp_number || ""} onChange={(e) => setEditing((s) => ({ ...s, whatsapp_number: e.target.value }))} /></label>
          <label>Dominio<input value={editing.dominio_personalizado || ""} onChange={(e) => setEditing((s) => ({ ...s, dominio_personalizado: e.target.value }))} /></label>
          <label className="check-row"><input type="checkbox" checked={!!editing.activa} onChange={(e) => setEditing((s) => ({ ...s, activa: e.target.checked }))} />Activa</label>
          <div className="row"><button className="btn btn-primary" onClick={async () => { try { await api.adminUpdateTienda(editing.id_tienda, editing); setEditing(null); await load(); } catch (e) { setError(e.message); } }}>Guardar</button><button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancelar</button></div>
        </div></div> : null}
      </Card>

      <Card title="Crear tienda">
        <form className="grid-form" onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api.adminCreateTienda({ ...form, slug: form.slug || null, whatsapp_number: form.whatsapp_number || null, dominio_personalizado: form.dominio_personalizado || null });
            setForm({ nombre_tienda: "", slug: "", whatsapp_number: "", dominio_personalizado: "", activa: true });
            await load();
          } catch (err) { setError(err.message); }
        }}>
          <label>Nombre<input value={form.nombre_tienda} onChange={(e) => setForm((s) => ({ ...s, nombre_tienda: e.target.value }))} required /></label>
          <HelperText text="Nombre visible del negocio." />
          <label>Slug<input value={form.slug} onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))} /></label>
          <HelperText text="Opcional. Si se omite, se genera automáticamente." />
          <label>WhatsApp<input value={form.whatsapp_number} onChange={(e) => setForm((s) => ({ ...s, whatsapp_number: e.target.value }))} /></label>
          <label>Dominio<input value={form.dominio_personalizado} onChange={(e) => setForm((s) => ({ ...s, dominio_personalizado: e.target.value }))} /></label>
          <label className="check-row"><input type="checkbox" checked={form.activa} onChange={(e) => setForm((s) => ({ ...s, activa: e.target.checked }))} />Activa</label>
          <button className="btn btn-primary">Crear tienda</button>
        </form>
      </Card>
    </div>
  );
}

function UsuariosScreen() {
  const [stores, setStores] = useState([]);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ tienda: "", rol: "", activo: "" });
  const [form, setForm] = useState({ id_tienda: "", email: "", password: "", rol: "admin", activo: true });
  const [editing, setEditing] = useState(null);
  const storeMap = useMemo(() => new Map(stores.map((s) => [s.id_tienda, s.nombre_tienda])), [stores]);

  const loadStores = async () => {
    const data = await api.adminListTiendas();
    setStores(data);
    if (!form.id_tienda && data[0]?.id_tienda) setForm((s) => ({ ...s, id_tienda: data[0].id_tienda }));
  };
  const loadUsers = async () => setRows(await api.adminListUsersFiltered({
    tienda: filters.tienda || undefined,
    rol: filters.rol || undefined,
    activo: filters.activo === "" ? undefined : filters.activo === "true",
  }));

  useEffect(() => { Promise.all([loadStores(), loadUsers()]).catch((e) => setError(e.message)); }, []);

  return (
    <div className="stack">
      <Card title="Usuarios">
        {error ? <p className="error-text">{error}</p> : null}
        <div className="row">
          <StoreRefPicker
            stores={stores}
            value={filters.tienda}
            onChange={(v) => setFilters((s) => ({ ...s, tienda: v }))}
            allowEmpty
            label="Tienda"
            placeholder="Filtrar por tienda..."
            helpText="Opcional: deja vacio para ver todas."
          />
          <label>Rol<select value={filters.rol} onChange={(e) => setFilters((s) => ({ ...s, rol: e.target.value }))}><option value="">Todos</option><option value="superadmin">superadmin</option><option value="admin">admin</option><option value="empleado">empleado</option><option value="cliente">cliente</option></select></label>
          <label>Estado<select value={filters.activo} onChange={(e) => setFilters((s) => ({ ...s, activo: e.target.value }))}><option value="">Todos</option><option value="true">Activos</option><option value="false">Inactivos</option></select></label>
          <button className="btn btn-ghost" onClick={() => loadUsers().catch((e) => setError(e.message))}>Filtrar</button>
        </div>

        <div className="table-wrap"><table><thead><tr><th>Email</th><th>Rol</th><th>Tienda</th><th>Activo</th><th>Acciones</th></tr></thead><tbody>
          {rows.map((u) => <tr key={u.id_usuario}><td>{u.email}</td><td>{u.rol}</td><td>{storeMap.get(u.id_tienda) || u.id_tienda}</td><td>{u.activo ? "Si" : "No"}</td><td className="actions-cell">
            <button className="btn btn-ghost" onClick={() => setEditing({ ...u })}>Editar</button>
            <button className="btn btn-ghost" onClick={async () => { try { await api.adminUpdateUser(u.id_usuario, { activo: !u.activo }); await loadUsers(); } catch (e) { setError(e.message); } }}>{u.activo ? "Desactivar" : "Activar"}</button>
            <button className="btn btn-ghost" onClick={async () => { const p = window.prompt(`Nueva password para ${u.email}`); if (!p) return; try { await api.adminResetPassword(u.id_usuario, p); } catch (e) { setError(e.message); } }}>Reset password</button>
          </td></tr>)}
        </tbody></table></div>

        {editing ? <div className="inline-editor"><h4>Editar usuario</h4><div className="grid-form">
          <label>Email<input value={editing.email || ""} onChange={(e) => setEditing((s) => ({ ...s, email: e.target.value }))} /></label>
          <label>Rol<select value={editing.rol || "admin"} onChange={(e) => setEditing((s) => ({ ...s, rol: e.target.value }))}><option value="superadmin">superadmin</option><option value="admin">admin</option><option value="empleado">empleado</option><option value="cliente">cliente</option></select></label>
          <StoreRefPicker
            stores={stores}
            value={editing.id_tienda}
            onChange={(v) => setEditing((s) => ({ ...s, id_tienda: v }))}
            required
            label="Tienda"
            placeholder="Buscar tienda..."
            helpText="Selecciona la tienda del usuario."
          />
          <label className="check-row"><input type="checkbox" checked={!!editing.activo} onChange={(e) => setEditing((s) => ({ ...s, activo: e.target.checked }))} />Activo</label>
          <div className="row"><button className="btn btn-primary" onClick={async () => { try { await api.adminUpdateUser(editing.id_usuario, { email: editing.email, rol: editing.rol, id_tienda: editing.id_tienda, activo: editing.activo }); setEditing(null); await loadUsers(); } catch (e) { setError(e.message); } }}>Guardar</button><button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancelar</button></div>
        </div></div> : null}
      </Card>

      <Card title="Crear usuario">
        <form className="grid-form" onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api.adminCreateUser(form);
            setForm((s) => ({ ...s, email: "", password: "" }));
            await loadUsers();
          } catch (err) { setError(err.message); }
        }}>
          <StoreRefPicker
            stores={stores}
            value={form.id_tienda}
            onChange={(v) => setForm((s) => ({ ...s, id_tienda: v }))}
            required
            label="Tienda"
            placeholder="Buscar tienda..."
            helpText="Asigna usuario a la tienda destino."
          />
          <HelperText text="Asigna usuario a la tienda destino." />
          <label>Email<input type="email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} required /></label>
          <label>Password<input type="password" value={form.password} onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))} required /></label>
          <HelperText text="Minimo 6 caracteres." />
          <label>Rol<select value={form.rol} onChange={(e) => setForm((s) => ({ ...s, rol: e.target.value }))}><option value="admin">admin</option><option value="empleado">empleado</option></select></label>
          <label className="check-row"><input type="checkbox" checked={form.activo} onChange={(e) => setForm((s) => ({ ...s, activo: e.target.checked }))} />Activo</label>
          <button className="btn btn-primary">Crear usuario</button>
        </form>
      </Card>
    </div>
  );
}

function CatalogoScreen({ isSuperadmin }) {
  const [tab, setTab] = useState("categorias");
  const [stores, setStores] = useState([]);
  const [rows, setRows] = useState([]);
  const [categoriasDisponibles, setCategoriasDisponibles] = useState([]);
  const [tenantId, setTenantId] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [pendingImageFile, setPendingImageFile] = useState(null);
  const [busyImageProductId, setBusyImageProductId] = useState("");
  const [uploadMetaByProduct, setUploadMetaByProduct] = useState({});
  const [productQuery, setProductQuery] = useState("");
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [form, setForm] = useState(tab === "categorias" ? { nombre: "", activa: true } : { nombre: "", descripcion: "", precio_venta: 0, stock_actual: 0, nombre_categoria: "", activo: true });
  const categoriaMap = useMemo(
    () => new Map(categoriasDisponibles.map((c) => [c.id_categoria, c.nombre])),
    [categoriasDisponibles],
  );
  const selectedStore = useMemo(
    () => stores.find((store) => store.id_tienda === tenantId) || null,
    [stores, tenantId],
  );
  const selectedStoreRef = isSuperadmin
    ? selectedStore?.slug || selectedStore?.nombre_tienda || ""
    : undefined;
  const filteredProductRows = useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    return rows.filter((product) => {
      if (categoriaFiltro) {
        const categoriaId = String(product.id_categoria || "");
        if (categoriaId !== categoriaFiltro) return false;
      }
      if (!query) return true;
      const haystack = [
        product.nombre,
        product.descripcion,
        product.id_producto,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [rows, productQuery, categoriaFiltro]);
  const productSuggestions = useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    if (!query) return [];
    const unique = new Set();
    const matches = [];
    for (const product of rows) {
      const label = String(product.nombre || "").trim();
      if (!label) continue;
      if (label.toLowerCase().includes(query) && !unique.has(label.toLowerCase())) {
        unique.add(label.toLowerCase());
        matches.push(label);
      }
      if (matches.length >= 6) break;
    }
    return matches;
  }, [rows, productQuery]);
  const assertStoreSelected = () => {
    if (isSuperadmin && !selectedStoreRef) {
      throw new Error("Selecciona una tienda");
    }
  };

  const resetFormForTab = (nextTab) =>
    setForm(
      nextTab === "categorias"
        ? { nombre: "", activa: true }
        : { nombre: "", descripcion: "", precio_venta: 0, stock_actual: 0, nombre_categoria: "", activo: true },
    );

  const loadStores = async () => {
    if (!isSuperadmin) return;
    const data = await api.adminListTiendas();
    setStores(data);
    if (!tenantId && data[0]?.id_tienda) {
      setTenantId(data[0].id_tienda);
    }
  };

  const load = async () => {
    if (isSuperadmin && !selectedStoreRef) {
      setRows([]);
      setCategoriasDisponibles([]);
      return;
    }
    const data = tab === "categorias"
      ? await api.listCategorias(selectedStoreRef)
      : await api.listProductos(selectedStoreRef);
    setRows(data);
    if (tab === "categorias") {
      setCategoriasDisponibles(data);
      return;
    }
    const categorias = await api.listCategorias(selectedStoreRef);
    setCategoriasDisponibles(categorias);
  };

  const handleReload = async () => {
    setError("");
    if (isSuperadmin) {
      await loadStores();
    }
    await load();
  };

  const uploadImage = async (idProducto, file) => {
    if (!file || !idProducto) return;
    setBusyImageProductId(idProducto);
    setUploadMetaByProduct((prev) => ({
      ...prev,
      [idProducto]: {
        fileName: file.name,
        status: "Subiendo imagen...",
        error: "",
      },
    }));
    try {
      const payload = await api.uploadProductoImage(idProducto, file);
      await load();
      setUploadMetaByProduct((prev) => ({
        ...prev,
        [idProducto]: {
          fileName: file.name,
          status: "Imagen guardada",
          error: "",
        },
      }));
      return payload;
    } finally {
      setBusyImageProductId("");
    }
  };

  useEffect(() => {
    loadStores().catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [tab, selectedStoreRef]);
  useEffect(() => {
    resetFormForTab(tab);
    setEditing(null);
    setPendingImageFile(null);
    setProductQuery("");
    setCategoriaFiltro("");
    if (tab !== "productos") {
      setProductSearchOpen(false);
    }
  }, [tab, selectedStoreRef]);

  return (
    <Card title="Catálogo privado" className="catalog-compact">
      <div className="catalog-toolbar">
        <div className="catalog-tabs">
          <button className={`tab-btn ${tab === "categorias" ? "active" : ""}`} onClick={() => setTab("categorias")}>Categorías</button>
          <button className={`tab-btn ${tab === "productos" ? "active" : ""}`} onClick={() => setTab("productos")}>Productos</button>
        </div>
        <div className="catalog-controls">
          {isSuperadmin ? (
            <StoreRefPicker
              stores={stores}
              value={tenantId}
              onChange={setTenantId}
              required
            />
          ) : <div className="catalog-controls-spacer" />}
          <button className="btn btn-ghost catalog-refresh" onClick={() => handleReload().catch((e) => setError(e.message))}>Recargar</button>
        </div>
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      {tab === "productos" ? (
        <div className="product-filters">
          <label>
            Buscar producto
            <div className="smart-search">
              <input
                value={productQuery}
                autoComplete="off"
                placeholder="Nombre, descripción o ID..."
                onFocus={() => setProductSearchOpen(true)}
                onBlur={() => window.setTimeout(() => setProductSearchOpen(false), 120)}
                onChange={(event) => setProductQuery(event.target.value)}
              />
              {productSearchOpen && productSuggestions.length > 0 ? (
                <div className="smart-search-list">
                  {productSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="smart-search-item"
                      onClick={() => {
                        setProductQuery(suggestion);
                        setProductSearchOpen(false);
                      }}
                    >
                      <span>{suggestion}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </label>
          <label>
            Categoría
            <select
              value={categoriaFiltro}
              onChange={(event) => setCategoriaFiltro(event.target.value)}
            >
              <option value="">Todas</option>
              {categoriasDisponibles.map((c) => (
                <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setProductQuery("");
              setCategoriaFiltro("");
            }}
          >
            Limpiar filtros
          </button>
        </div>
      ) : null}

      {/* --- VISTA DESKTOP: TABLA --- */}
      <div className="table-wrap desktop-only">
        <table>
          <thead>
            {tab === "categorias"
              ? <tr><th>ID</th><th>Nombre</th><th>Activa</th><th>Acciones</th></tr>
              : <tr><th>ID</th><th>Nombre</th><th>Precio</th><th>Stock</th><th>Activo</th><th>Imagen</th><th>Acciones</th></tr>}
          </thead>
          <tbody>
            {(tab === "productos" ? filteredProductRows : rows).map((r) => {
              if (tab === "categorias") {
                if (!r.id_categoria) return null;
                return (
                  <tr key={r.id_categoria}>
                    <td className="small-id">{r.id_categoria.substring(0, 8)}...</td>
                    <td className="font-semibold">{r.nombre}</td>
                    <td>
                      <span className={`status-badge ${r.activa ? "active" : "inactive"}`}>
                        {r.activa ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button className="btn btn-ghost" onClick={() => setEditing({ mode: "categoria", row: r })}>Editar</button>
                      <button className={`btn ${r.activa ? "btn-danger-ghost" : "btn-success-ghost"}`} onClick={async () => { try { assertStoreSelected(); await api.updateCategoria(r.id_categoria, { activa: !r.activa }, selectedStoreRef); await load(); } catch (e) { setError(e.message); } }}>{r.activa ? "Desactivar" : "Activar"}</button>
                    </td>
                  </tr>
                );
              } else {
                if (!r.id_producto) return null;
                return (
                  <tr key={r.id_producto}>
                    <td className="small-id">{r.id_producto.substring(0, 8)}...</td>
                    <td className="font-semibold">{r.nombre}</td>
                    <td className="price-cell">{r.precio_venta} Bs.</td>
                    <td>
                      <span className={`stock-badge ${r.stock_actual <= 5 ? "low" : ""}`}>
                        {r.stock_actual}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${r.activo ? "active" : "inactive"}`}>
                        {r.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td>
                      {r.imagen_url ? (
                        <div className="table-img-wrapper">
                          <img src={getImageSrc(r.imagen_url)} alt="" className="table-thumb" />
                        </div>
                      ) : (
                        <span className="no-image-text">Sin imagen</span>
                      )}
                    </td>
                    <td className="actions-cell">
                      <button className="btn btn-ghost" onClick={() => setEditing({ mode: "producto", row: { ...r, nombre_categoria: r.id_categoria ? (categoriaMap.get(r.id_categoria) || "") : "" } })}>Editar</button>
                      <button className={`btn ${r.activo ? "btn-danger-ghost" : "btn-success-ghost"}`} onClick={async () => { try { assertStoreSelected(); await api.updateProducto(r.id_producto, { activo: !r.activo }, selectedStoreRef); await load(); } catch (e) { setError(e.message); } }}>{r.activo ? "Desactivar" : "Activar"}</button>
                      <ImageDropZone
                        compact
                        title={busyImageProductId === r.id_producto ? "Subiendo..." : "Imagen"}
                        subtitle="Arrastra o selecciona"
                        selectedFileName={uploadMetaByProduct[r.id_producto]?.fileName || ""}
                        statusText={uploadMetaByProduct[r.id_producto]?.status || ""}
                        errorText={uploadMetaByProduct[r.id_producto]?.error || ""}
                        disabled={busyImageProductId === r.id_producto}
                        onFileSelected={async (file) => {
                          try {
                            await uploadImage(r.id_producto, file);
                          } catch (err) {
                            const message = err.message || "No se pudo subir la imagen";
                            setError(message);
                            setUploadMetaByProduct((prev) => ({
                              ...prev,
                              [r.id_producto]: {
                                fileName: file?.name || "",
                                status: "",
                                error: message,
                              },
                            }));
                          }
                        }}
                      />
                    </td>
                  </tr>
                );
              }
            })}
          </tbody>
        </table>
      </div>

      {/* --- VISTA MOBILE: TARJETAS --- */}
      <div className="mobile-only mobile-cards-grid">
        {tab === "categorias" ? (
          rows.map((r) => {
            if (!r.id_categoria) return null;
            return (
              <div key={r.id_categoria} className="admin-card category-card">
                <div className="card-info">
                  <span className="card-id">ID: {r.id_categoria.substring(0, 8)}...</span>
                  <h4 className="card-name">{r.nombre}</h4>
                  <span className={`status-badge ${r.activa ? "active" : "inactive"}`}>
                    {r.activa ? "Activa" : "Inactiva"}
                  </span>
                </div>
                <div className="card-actions">
                  <button className="btn btn-ghost" onClick={() => setEditing({ mode: "categoria", row: r })}>Editar</button>
                  <button 
                    className={`btn ${r.activa ? "btn-danger-ghost" : "btn-success-ghost"}`} 
                    onClick={async () => { 
                      try { 
                        assertStoreSelected(); 
                        await api.updateCategoria(r.id_categoria, { activa: !r.activa }, selectedStoreRef); 
                        await load(); 
                      } catch (e) { 
                        setError(e.message); 
                      } 
                    }}
                  >
                    {r.activa ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          filteredProductRows.map((r) => {
            if (!r.id_producto) return null;
            return (
              <div key={r.id_producto} className="admin-card product-card">
                <div className="product-card-header">
                  <div className="product-card-img">
                    {r.imagen_url ? (
                      <img src={getImageSrc(r.imagen_url)} alt={r.nombre} />
                    ) : (
                      <div className="placeholder-img"><span className="icon">🛍️</span></div>
                    )}
                  </div>
                  <div className="product-card-main">
                    <span className="card-id">ID: {r.id_producto.substring(0, 8)}...</span>
                    <h4 className="card-name">{r.nombre}</h4>
                    <div className="product-card-metrics">
                      <span className="price-tag">{r.precio_venta} Bs.</span>
                      <span className={`stock-tag ${r.stock_actual <= 5 ? "low" : ""}`}>{r.stock_actual} en stock</span>
                    </div>
                  </div>
                </div>
                
                <div className="product-card-footer">
                  <span className={`status-badge ${r.activo ? "active" : "inactive"}`}>
                    {r.activo ? "Activo" : "Inactivo"}
                  </span>
                  <div className="card-actions">
                    <button className="btn btn-ghost" onClick={() => setEditing({ mode: "producto", row: { ...r, nombre_categoria: r.id_categoria ? (categoriaMap.get(r.id_categoria) || "") : "" } })}>
                      Editar
                    </button>
                    <button 
                      className={`btn ${r.activo ? "btn-danger-ghost" : "btn-success-ghost"}`} 
                      onClick={async () => { 
                        try { 
                          assertStoreSelected(); 
                          await api.updateProducto(r.id_producto, { activo: !r.activo }, selectedStoreRef); 
                          await load(); 
                        } catch (e) { 
                          setError(e.message); 
                        } 
                      }}
                    >
                      {r.activo ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </div>
                
                <div className="product-card-image-upload">
                  <ImageDropZone
                    compact
                    title={busyImageProductId === r.id_producto ? "Subiendo..." : "Imagen"}
                    subtitle="Arrastra o selecciona"
                    selectedFileName={uploadMetaByProduct[r.id_producto]?.fileName || ""}
                    statusText={uploadMetaByProduct[r.id_producto]?.status || ""}
                    errorText={uploadMetaByProduct[r.id_producto]?.error || ""}
                    disabled={busyImageProductId === r.id_producto}
                    onFileSelected={async (file) => {
                      try {
                        await uploadImage(r.id_producto, file);
                      } catch (err) {
                        const message = err.message || "No se pudo subir la imagen";
                        setError(message);
                        setUploadMetaByProduct((prev) => ({
                          ...prev,
                          [r.id_producto]: {
                            fileName: file?.name || "",
                            status: "",
                            error: message,
                          },
                        }));
                      }
                    }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="inline-editor">
        <h4>{editing ? `Editar ${editing.mode}` : `Crear ${tab === "categorias" ? "categoría" : "producto"}`}</h4>
        {editing ? (
          <div className="grid-form">
            <label>Nombre<input value={editing.row.nombre || ""} onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, nombre: e.target.value } }))} /></label>
            {editing.mode === "categoria" ? (
              <label className="check-row"><input type="checkbox" checked={!!editing.row.activa} onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, activa: e.target.checked } }))} />Activa</label>
            ) : (
              <>
                <label>Descripción<textarea value={editing.row.descripcion || ""} onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, descripcion: e.target.value } }))} /></label>
                <label>Precio<input type="number" step="0.01" value={editing.row.precio_venta || 0} onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, precio_venta: e.target.value } }))} /></label>
                <label>Stock<input type="number" value={editing.row.stock_actual || 0} onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, stock_actual: e.target.value } }))} /></label>
                <label>Categoría<select value={editing.row.nombre_categoria || ""} onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, nombre_categoria: e.target.value } }))}><option value="">Sin categoría</option>{categoriasDisponibles.map((c) => <option key={c.id_categoria} value={c.nombre}>{c.nombre}</option>)}</select></label>
                <div className="current-image-card">
                  <p className="current-image-label">Imagen actual</p>
                  {editing.row.imagen_url ? (
                    <div className="current-image-content">
                      <img
                        src={getImageSrc(editing.row.imagen_url)}
                        alt={editing.row.nombre || "Producto"}
                        className="current-image-preview"
                      />
                      <a href={getImageSrc(editing.row.imagen_url)} target="_blank" rel="noreferrer" className="current-image-link">
                        Ver imagen
                      </a>
                    </div>
                  ) : (
                    <p className="muted small">Este producto aún no tiene imagen.</p>
                  )}
                </div>
                <ImageDropZone
                  title="Actualizar imagen"
                  subtitle="Arrastra y suelta o selecciona archivo"
                  statusText={editing.row.imagen_url ? "Imagen guardada en catálogo" : ""}
                  disabled={busyImageProductId === editing.row.id_producto}
                  onFileSelected={async (file) => {
                    try {
                      const result = await uploadImage(editing.row.id_producto, file);
                      if (result?.imagen_url) {
                        setEditing((prev) => ({
                          ...prev,
                          row: { ...prev.row, imagen_url: result.imagen_url },
                        }));
                      }
                    } catch (err) {
                      setError(err.message);
                    }
                  }}
                />
                <label className="check-row"><input type="checkbox" checked={!!editing.row.activo} onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, activo: e.target.checked } }))} />Activo</label>
              </>
            )}
            <div className="row">
              <button className="btn btn-primary" onClick={async () => {
                try {
                  assertStoreSelected();
                  if (editing.mode === "categoria") {
                    await api.updateCategoria(editing.row.id_categoria, { nombre: editing.row.nombre, activa: editing.row.activa }, selectedStoreRef);
                  } else {
                    await api.updateProducto(editing.row.id_producto, {
                      nombre: editing.row.nombre,
                      descripcion: editing.row.descripcion || "",
                      precio_venta: Number(editing.row.precio_venta || 0),
                      stock_actual: Number(editing.row.stock_actual || 0),
                      nombre_categoria: editing.row.nombre_categoria || null,
                      activo: editing.row.activo,
                    }, selectedStoreRef);
                  }
                  setEditing(null);
                  await load();
                } catch (e) { setError(e.message); }
              }}>Guardar</button>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>
            </div>
          </div>
        ) : (
          <form className="grid-form" onSubmit={async (e) => {
            e.preventDefault();
            try {
              assertStoreSelected();
              if (tab === "categorias") {
                await api.createCategoria(form, selectedStoreRef);
              } else {
                const created = await api.createProducto({
                  ...form,
                  precio_venta: Number(form.precio_venta || 0),
                  stock_actual: Number(form.stock_actual || 0),
                  nombre_categoria: form.nombre_categoria || null,
                }, selectedStoreRef);
                if (pendingImageFile && created?.id_producto) {
                  await uploadImage(created.id_producto, pendingImageFile);
                }
              }
              resetFormForTab(tab);
              setPendingImageFile(null);
              await load();
            } catch (err) { setError(err.message); }
          }}>
            <label>Nombre<input value={form.nombre} onChange={(e) => setForm((s) => ({ ...s, nombre: e.target.value }))} required /></label>
            {tab === "categorias" ? (
              <label className="check-row"><input type="checkbox" checked={form.activa} onChange={(e) => setForm((s) => ({ ...s, activa: e.target.checked }))} />Activa</label>
            ) : (
              <>
                <label>Descripción<textarea value={form.descripcion} onChange={(e) => setForm((s) => ({ ...s, descripcion: e.target.value }))} /></label>
                <label>Precio<input type="number" step="0.01" value={form.precio_venta} onChange={(e) => setForm((s) => ({ ...s, precio_venta: e.target.value }))} required /></label>
                <label>Stock<input type="number" value={form.stock_actual} onChange={(e) => setForm((s) => ({ ...s, stock_actual: e.target.value }))} /></label>
                <label>Categoría<select value={form.nombre_categoria} onChange={(e) => setForm((s) => ({ ...s, nombre_categoria: e.target.value }))}><option value="">Sin categoría</option>{categoriasDisponibles.map((c) => <option key={c.id_categoria} value={c.nombre}>{c.nombre}</option>)}</select></label>
                <ImageDropZone
                  title="Imagen del producto"
                  subtitle="La imagen se sube al guardar el producto"
                  selectedFileName={pendingImageFile?.name || ""}
                  onFileSelected={setPendingImageFile}
                />
                <label className="check-row"><input type="checkbox" checked={form.activo} onChange={(e) => setForm((s) => ({ ...s, activo: e.target.checked }))} />Activo</label>
              </>
            )}
            <button className="btn btn-primary">Crear</button>
          </form>
        )}
      </div>
    </Card>
  );
}

function OffersScreen({ isSuperadmin }) {
  const [stores, setStores] = useState([]);
  const [tenantId, setTenantId] = useState("");
  const [offers, setOffers] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [linkedProducts, setLinkedProducts] = useState([]);
  const [linkedCategories, setLinkedCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [managingProducts, setManagingProducts] = useState(false);
  const [bannerUploading, setBannerUploading] = useState("");
  const [error, setError] = useState("");
  const [editingOfferId, setEditingOfferId] = useState("");
  const [offerForm, setOfferForm] = useState(createOfferFormState());
  const [createTargetType, setCreateTargetType] = useState("none");
  const [createTargetId, setCreateTargetId] = useState("");
  const [createTargetOverride, setCreateTargetOverride] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [manageOffer, setManageOffer] = useState(null);
  const [targetTab, setTargetTab] = useState("productos");
  const [bannerOffer, setBannerOffer] = useState(null);
  const [overrideByProduct, setOverrideByProduct] = useState({});
  const [toasts, setToasts] = useState([]);
  const [pendingActionKey, setPendingActionKey] = useState("");

  const selectedStore = useMemo(
    () => stores.find((store) => store.id_tienda === tenantId) || null,
    [stores, tenantId],
  );
  const selectedStoreRef = isSuperadmin
    ? selectedStore?.slug || selectedStore?.nombre_tienda || ""
    : undefined;
  const offerTenantOptions = isSuperadmin ? { tenantId } : {};
  const linkedProductIds = useMemo(
    () => new Set(linkedProducts.map((item) => item.id_producto)),
    [linkedProducts],
  );
  const linkedCategoryIds = useMemo(
    () => new Set(linkedCategories.map((item) => item.id_categoria)),
    [linkedCategories],
  );
  const filteredProducts = useMemo(() => {
    const normalized = productQuery.trim().toLowerCase();
    if (!normalized) return products;
    return products.filter((product) => {
      const haystack = [
        product.nombre,
        product.descripcion,
        product.id_producto,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [products, productQuery]);
  const filteredCategories = useMemo(() => {
    const normalized = categoryQuery.trim().toLowerCase();
    if (!normalized) return categories;
    return categories.filter((category) => {
      const haystack = [
        category.nombre,
        category.id_categoria,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [categories, categoryQuery]);
  const availableProducts = useMemo(
    () => filteredProducts.filter((product) => !linkedProductIds.has(product.id_producto)),
    [filteredProducts, linkedProductIds],
  );
  const availableCategories = useMemo(
    () => filteredCategories.filter((category) => !linkedCategoryIds.has(category.id_categoria)),
    [filteredCategories, linkedCategoryIds],
  );
  const createTargetItems = useMemo(() => {
    if (createTargetType === "product") return products;
    if (createTargetType === "category") return categories;
    return [];
  }, [createTargetType, products, categories]);

  const pushToast = (message, type = "success") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((current) => [...current, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4000);
  };

  const dismissToast = (id) => setToasts((current) => current.filter((item) => item.id !== id));
  const isPendingAction = (key) => pendingActionKey === key;
  const withActionState = async (key, callback) => {
    setPendingActionKey(key);
    try {
      await callback();
    } finally {
      setPendingActionKey("");
    }
  };

  const assertTenantReady = () => {
    if (isSuperadmin && !tenantId) {
      throw new Error("Selecciona una tienda");
    }
  };

  const loadStores = async () => {
    if (!isSuperadmin) return;
    const data = await api.adminListTiendas();
    setStores(data);
    if (!tenantId && data[0]?.id_tienda) {
      setTenantId(data[0].id_tienda);
    }
  };

  const loadOffers = async () => {
    if (isSuperadmin && !tenantId) {
      setOffers([]);
      setManageOffer(null);
      return;
    }
    setLoading(true);
    try {
      const data = await offersApi.list(offerTenantOptions);
      setOffers(data);
      setManageOffer((current) => {
        if (!current) return null;
        return data.find((item) => item.id_oferta === current.id_oferta) || null;
      });
      return data;
    } finally {
      setLoading(false);
    }
  };

  const ensureProductsLoaded = async () => {
    if (products.length > 0) return products;
    const data = isSuperadmin ? await api.listProductos(selectedStoreRef) : await api.listProductos();
    setProducts(data);
    return data;
  };

  const ensureCategoriesLoaded = async () => {
    if (categories.length > 0) return categories;
    const data = isSuperadmin ? await api.listCategorias(selectedStoreRef) : await api.listCategorias();
    setCategories(data);
    return data;
  };

  const loadManageProducts = async (offer) => {
    const [associatedProducts, catalogProducts] = await Promise.all([
      offersApi.listProducts(offer.id_oferta, offerTenantOptions),
      ensureProductsLoaded(),
    ]);
    setLinkedProducts(associatedProducts);
    setProducts(catalogProducts);
    setOverrideByProduct(
      Object.fromEntries(
        associatedProducts
          .filter((item) => item.precio_override !== null && item.precio_override !== undefined)
          .map((item) => [item.id_producto, String(item.precio_override)]),
      ),
    );
  };

  const loadManageCategories = async (offer) => {
    const [associatedCategories, catalogCategories] = await Promise.all([
      offersApi.listCategories(offer.id_oferta, offerTenantOptions),
      ensureCategoriesLoaded(),
    ]);
    setLinkedCategories(associatedCategories);
    setCategories(catalogCategories);
  };

  const openProductsManager = async (offer) => {
    setManageOffer(offer);
    setTargetTab("productos");
    setProductQuery("");
    setCategoryQuery("");
    setOverrideByProduct({});
    setManagingProducts(true);
    setProductsLoading(true);
    setError("");
    try {
      await loadManageProducts(offer);
    } catch (err) {
      setManageOffer(null);
      setError(err.message || "No se pudieron cargar los productos de la oferta");
      pushToast(err.message || "No se pudieron cargar los productos de la oferta", "error");
    } finally {
      setManagingProducts(false);
      setProductsLoading(false);
    }
  };

  const closeProductsManager = () => {
    setManageOffer(null);
    setLinkedProducts([]);
    setLinkedCategories([]);
    setCategories([]);
    setProductQuery("");
    setCategoryQuery("");
    setOverrideByProduct({});
    setManagingProducts(false);
  };

  const openBannerManager = (offer) => {
    setBannerOffer(offer);
    setError("");
  };

  const handleOfferSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      assertTenantReady();
      const payload = normalizeOfferPayload(offerForm);
      const pendingTargetType = createTargetType;
      const pendingTargetId = createTargetId;
      const pendingTargetOverride = createTargetOverride;
      if (payload.tipo === "PERCENT" && !(payload.porcentaje > 0)) {
        throw new Error("Ingresa un porcentaje valido mayor a 0");
      }
      let savedOffer = null;
      if (editingOfferId) {
        savedOffer = await offersApi.update(editingOfferId, payload, offerTenantOptions);
        pushToast("Oferta actualizada");
      } else {
        savedOffer = await offersApi.create(payload, offerTenantOptions);
        pushToast("Oferta creada");
      }
      setEditingOfferId("");
      setOfferForm(createOfferFormState());
      setCreateTargetType("none");
      setCreateTargetId("");
      setCreateTargetOverride("");
      await loadOffers();
      if (savedOffer) {
        if (pendingTargetType === "product" && pendingTargetId) {
          await offersApi.attachProducts(savedOffer.id_oferta, {
            productos: [{
              id_producto: pendingTargetId,
              precio_override: savedOffer.tipo === "PRICE_OVERRIDE" ? Number(pendingTargetOverride || 0) : null,
              activo: true,
            }],
          }, offerTenantOptions);
          pushToast("Oferta creada y asignada al producto");
          await openProductsManager(savedOffer);
        } else if (pendingTargetType === "category" && pendingTargetId) {
          if (savedOffer.tipo !== "PERCENT") {
            throw new Error("Solo las ofertas PERCENT pueden asignarse a categorias");
          }
          await offersApi.attachCategories(savedOffer.id_oferta, {
            categorias: [{ id_categoria: pendingTargetId, activo: true }],
          }, offerTenantOptions);
          pushToast("Oferta creada y asignada a la categoria");
          setManageOffer(savedOffer);
          setTargetTab("categorias");
        } else {
          await openProductsManager(savedOffer);
        }
      }
    } catch (err) {
      const message = err.message || "No se pudo guardar la oferta";
      setError(message);
      pushToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleOffer = async (offer) => {
    setError("");
    await withActionState(`toggle:${offer.id_oferta}`, async () => {
      try {
        assertTenantReady();
        await offersApi.update(offer.id_oferta, { activa: !offer.activa }, offerTenantOptions);
        pushToast(offer.activa ? "Oferta desactivada" : "Oferta activada");
        await loadOffers();
      } catch (err) {
        const message = err.message || "No se pudo cambiar el estado";
        setError(message);
        pushToast(message, "error");
      }
    });
  };

  const upsertProductInOffer = async (product, successMessage) => {
    if (!manageOffer) return;
    setManagingProducts(true);
    setError("");
    await withActionState(`product:save:${product.id_producto}`, async () => {
      try {
        const overrideValue = overrideByProduct[product.id_producto];
        if (manageOffer.tipo === "PRICE_OVERRIDE" && !(Number(overrideValue) >= 0)) {
          throw new Error("Ingresa un precio override valido para este producto");
        }
        await offersApi.attachProducts(manageOffer.id_oferta, {
          productos: [{
            id_producto: product.id_producto,
            precio_override: manageOffer.tipo === "PRICE_OVERRIDE" ? Number(overrideValue) : null,
            activo: true,
          }],
        }, offerTenantOptions);
        await loadManageProducts(manageOffer);
        pushToast(successMessage);
      } catch (err) {
        const message = err.message || "No se pudo asociar el producto";
        setError(message);
        pushToast(message, "error");
      } finally {
        setManagingProducts(false);
      }
    });
  };

  const handleAttachProduct = async (product) => {
    await upsertProductInOffer(product, "Producto asociado a la oferta");
  };

  const handleSaveProductOverride = async (product) => {
    await upsertProductInOffer(product, "Precio override actualizado");
  };

  const handleDetachProduct = async (idProducto) => {
    if (!manageOffer) return;
    setManagingProducts(true);
    setError("");
    await withActionState(`product:remove:${idProducto}`, async () => {
      try {
        await offersApi.detachProduct(manageOffer.id_oferta, idProducto, offerTenantOptions);
        setLinkedProducts((current) => current.filter((item) => item.id_producto !== idProducto));
        setOverrideByProduct((current) => {
          const next = { ...current };
          delete next[idProducto];
          return next;
        });
        await loadManageProducts(manageOffer);
        pushToast("Producto removido de la oferta");
      } catch (err) {
        const message = err.message || "No se pudo quitar el producto";
        setError(message);
        pushToast(message, "error");
      } finally {
        setManagingProducts(false);
      }
    });
  };

  const handleAttachCategory = async (category) => {
    if (!manageOffer) return;
    if (manageOffer.tipo !== "PERCENT") {
      const message = "Solo % por categoria";
      setError(message);
      pushToast(message, "error");
      return;
    }
    setManagingProducts(true);
    setError("");
    await withActionState(`category:save:${category.id_categoria}`, async () => {
      try {
        await offersApi.attachCategories(manageOffer.id_oferta, {
          categorias: [{
            id_categoria: category.id_categoria,
            activo: true,
          }],
        }, offerTenantOptions);
        await loadManageCategories(manageOffer);
        pushToast("Categoria asociada a la oferta");
      } catch (err) {
        const message = err.message || "No se pudo asociar la categoria";
        setError(message);
        pushToast(message, "error");
      } finally {
        setManagingProducts(false);
      }
    });
  };

  const handleDetachCategory = async (idCategoria) => {
    if (!manageOffer) return;
    setManagingProducts(true);
    setError("");
    await withActionState(`category:remove:${idCategoria}`, async () => {
      try {
        await offersApi.detachCategory(manageOffer.id_oferta, idCategoria, offerTenantOptions);
        setLinkedCategories((current) => current.filter((item) => item.id_categoria !== idCategoria));
        await loadManageCategories(manageOffer);
        pushToast("Categoria removida de la oferta");
      } catch (err) {
        const message = err.message || "No se pudo quitar la categoria";
        setError(message);
        pushToast(message, "error");
      } finally {
        setManagingProducts(false);
      }
    });
  };

  const handleBannerUpload = async (file) => {
    if (!bannerOffer || !file) return;
    setBannerUploading(bannerOffer.id_oferta);
    setError("");
    try {
      const payload = await offersApi.uploadBanner(bannerOffer.id_oferta, file, offerTenantOptions);
      setBannerOffer((current) => current ? { ...current, banner_url: payload.banner_url } : current);
      pushToast("Banner actualizado");
      await loadOffers();
    } catch (err) {
      const message = err.message || "No se pudo subir el banner";
      setError(message);
      pushToast(message, "error");
    } finally {
      setBannerUploading("");
    }
  };

  useEffect(() => {
    loadStores().catch((err) => {
      setError(err.message);
      pushToast(err.message, "error");
    });
  }, []);

  useEffect(() => {
    loadOffers().catch((err) => {
      setError(err.message);
      pushToast(err.message, "error");
    });
  }, [tenantId]);

  useEffect(() => {
    if (!manageOffer) return;
    if (targetTab === "categorias" && manageOffer.tipo === "PERCENT") {
      setProductsLoading(true);
      loadManageCategories(manageOffer)
        .catch((err) => {
          setError(err.message || "No se pudieron cargar las categorias");
          pushToast(err.message || "No se pudieron cargar las categorias", "error");
        })
        .finally(() => setProductsLoading(false));
      return;
    }
    if (targetTab === "productos") {
      setProductsLoading(true);
      loadManageProducts(manageOffer)
        .catch((err) => {
          setError(err.message || "No se pudieron cargar los productos");
          pushToast(err.message || "No se pudieron cargar los productos", "error");
        })
        .finally(() => setProductsLoading(false));
    }
  }, [manageOffer?.id_oferta, targetTab]);

  useEffect(() => {
    if (!createTargetType) return;
    if (createTargetType === "product") {
      ensureProductsLoaded().catch((err) => {
        setError(err.message || "No se pudieron cargar los productos");
        pushToast(err.message || "No se pudieron cargar los productos", "error");
      });
    }
    if (createTargetType === "category") {
      ensureCategoriesLoaded().catch((err) => {
        setError(err.message || "No se pudieron cargar las categorias");
        pushToast(err.message || "No se pudieron cargar las categorias", "error");
      });
    }
  }, [createTargetType, selectedStoreRef]);

  useEffect(() => {
    if (offerForm.tipo === "PERCENT") return;
    if (createTargetType === "category") {
      setCreateTargetType("none");
      setCreateTargetId("");
    }
  }, [offerForm.tipo, createTargetType]);

  return (
    <>
      <ToastStack items={toasts} onDismiss={dismissToast} />
      <Card title="Ofertas" className="catalog-compact">
        <div className="catalog-toolbar">
          <div className="catalog-controls">
            {isSuperadmin ? (
              <StoreRefPicker
                stores={stores}
                value={tenantId}
                onChange={setTenantId}
                required
                label="Tienda destino"
                placeholder="Busca por nombre o slug..."
                helpText="Selecciona la tienda para listar y crear ofertas."
              />
            ) : <div className="catalog-controls-spacer" />}
            <button
              type="button"
              className="btn btn-ghost catalog-refresh"
              onClick={() => loadOffers().catch((err) => {
                setError(err.message);
                pushToast(err.message, "error");
              })}
            >
              {loading ? "Cargando..." : "Recargar"}
            </button>
          </div>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>% / Override</th>
                <th>Prioridad</th>
                <th>Activa</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Badge</th>
                <th>Banner</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((offer) => (
                <tr key={offer.id_oferta}>
                  <td>{offer.nombre}</td>
                  <td>{offer.tipo}</td>
                  <td>{formatOfferValue(offer)}</td>
                  <td>{offer.prioridad}</td>
                  <td>{offer.activa ? "Si" : "No"}</td>
                  <td>{formatDateTime(offer.fecha_inicio)}</td>
                  <td>{formatDateTime(offer.fecha_fin)}</td>
                  <td>{offer.badge_text || "-"}</td>
                  <td>
                    {offer.banner_url ? (
                      <div className="offer-banner-cell">
                        <img src={getImageSrc(offer.banner_url)} alt={offer.nombre} className="offer-banner-thumb" />
                        <a href={getImageSrc(offer.banner_url)} target="_blank" rel="noreferrer" className="current-image-link">
                          Ver
                        </a>
                      </div>
                    ) : "Sin banner"}
                  </td>
                  <td className="actions-cell">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        setEditingOfferId(offer.id_oferta);
                        setOfferForm(createOfferFormState(offer));
                        setManageOffer(offer);
                      }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className={`btn btn-ghost ${isPendingAction(`toggle:${offer.id_oferta}`) ? "btn-busy" : ""}`}
                      disabled={isPendingAction(`toggle:${offer.id_oferta}`)}
                      onClick={() => handleToggleOffer(offer)}
                    >
                      {offer.activa ? "Desactivar" : "Activar"}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => openProductsManager(offer)}>
                      Asignar targets
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => openBannerManager(offer)}>
                      Subir banner
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && offers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="table-empty">No hay ofertas para la tienda seleccionada.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="inline-editor offer-editor">
          <h4>{editingOfferId ? "Editar oferta" : "Crear oferta"}</h4>
          <form className="grid-form offer-form-grid" onSubmit={handleOfferSubmit}>
            <label>
              Nombre
              <input
                value={offerForm.nombre}
                onChange={(event) => setOfferForm((current) => ({ ...current, nombre: event.target.value }))}
                required
              />
            </label>
            <label>
              Tipo
              <select
                value={offerForm.tipo}
                onChange={(event) => setOfferForm((current) => ({
                  ...current,
                  tipo: event.target.value,
                  porcentaje: event.target.value === "PERCENT" ? current.porcentaje : "",
                }))}
              >
                <option value="PERCENT">PERCENT</option>
                <option value="PRICE_OVERRIDE">PRICE_OVERRIDE</option>
              </select>
            </label>
            {offerForm.tipo === "PERCENT" ? (
              <label>
                Porcentaje
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={offerForm.porcentaje}
                  onChange={(event) => setOfferForm((current) => ({ ...current, porcentaje: event.target.value }))}
                  required
                />
              </label>
            ) : (
              <label>
                Override
                <input value="Se define por producto" disabled />
              </label>
            )}
            <label>
              Prioridad
              <input
                type="number"
                value={offerForm.prioridad}
                onChange={(event) => setOfferForm((current) => ({ ...current, prioridad: event.target.value }))}
              />
            </label>
            <label>
              Fecha inicio
              <input
                type="datetime-local"
                value={offerForm.fecha_inicio}
                onChange={(event) => setOfferForm((current) => ({ ...current, fecha_inicio: event.target.value }))}
              />
            </label>
            <label>
              Fecha fin
              <input
                type="datetime-local"
                value={offerForm.fecha_fin}
                onChange={(event) => setOfferForm((current) => ({ ...current, fecha_fin: event.target.value }))}
              />
            </label>
            <label className="offer-form-wide">
              Badge text
              <input
                value={offerForm.badge_text}
                maxLength={80}
                placeholder="Ej. -20% hoy"
                onChange={(event) => setOfferForm((current) => ({ ...current, badge_text: event.target.value }))}
              />
            </label>
            <label>
              Aplicar a
              <select
                value={createTargetType}
                onChange={(event) => {
                  const nextType = event.target.value;
                  setCreateTargetType(nextType);
                  setCreateTargetId("");
                  setCreateTargetOverride("");
                }}
              >
                <option value="none">Sin asignar por ahora</option>
                <option value="product">Producto</option>
                <option value="category" disabled={offerForm.tipo !== "PERCENT"}>Categoria</option>
              </select>
            </label>
            {createTargetType !== "none" ? (
              <SearchableTargetInput
                items={createTargetItems}
                value={createTargetId}
                onChange={setCreateTargetId}
                getKey={(item) => createTargetType === "product" ? item.id_producto : item.id_categoria}
                getLabel={(item) => createTargetType === "product"
                  ? `${item.nombre} (${item.precio_venta})`
                  : item.nombre}
                label={createTargetType === "product" ? "Producto objetivo" : "Categoria objetivo"}
                placeholder={createTargetType === "product" ? "Escribe el nombre del producto..." : "Escribe la categoria..."}
                helpText={createTargetType === "product"
                  ? "Selecciona el producto que recibira la oferta."
                  : "Selecciona la categoria que recibira el descuento."}
                required
              />
            ) : null}
            {createTargetType === "product" && offerForm.tipo === "PRICE_OVERRIDE" ? (
              <label>
                Precio override inicial
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={createTargetOverride}
                  placeholder="0.00"
                  onChange={(event) => setCreateTargetOverride(event.target.value)}
                  required
                />
              </label>
            ) : null}
            <label className="check-row">
              <input
                type="checkbox"
                checked={offerForm.activa}
                onChange={(event) => setOfferForm((current) => ({ ...current, activa: event.target.checked }))}
              />
              Activa
            </label>
            <div className="row offer-form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Guardando..." : editingOfferId ? "Guardar cambios" : "Crear oferta"}
              </button>
              {editingOfferId ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setEditingOfferId("");
                    setOfferForm(createOfferFormState());
                  }}
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>
        </div>

        <div className="inline-editor offer-editor">
          <div className="card-head">
            <h4>Asignar oferta a productos o categorias</h4>
            {manageOffer ? (
              <button type="button" className="btn btn-ghost" onClick={closeProductsManager}>
                Limpiar seleccion
              </button>
            ) : null}
          </div>
          <div className="grid-form">
            <label>
              Oferta seleccionada
              <select
                value={manageOffer?.id_oferta || ""}
                onChange={(event) => {
                  const nextId = event.target.value;
                  if (!nextId) {
                    closeProductsManager();
                    return;
                  }
                  const selected = offers.find((offer) => offer.id_oferta === nextId);
                  if (selected) {
                    openProductsManager(selected);
                  }
                }}
              >
                <option value="">Selecciona una oferta...</option>
                {offers.map((offer) => (
                  <option key={offer.id_oferta} value={offer.id_oferta}>
                    {offer.nombre} · {offer.tipo} · {formatOfferValue(offer)}
                  </option>
                ))}
              </select>
            </label>
            {!manageOffer ? (
              <p className="helper-text">
                Crea una oferta o selecciona una existente y abajo podras asignarla facilmente a productos o categorias.
              </p>
            ) : (
              <p className="helper-text">
                Oferta activa para asignacion: {manageOffer.nombre}.
              </p>
            )}
          </div>
        </div>
      </Card>

      {manageOffer ? (
        <Card
          title={`Asignacion de targets: ${manageOffer.nombre}`}
          className="catalog-compact"
        >
          <p className="muted small">{manageOffer.tipo} · {formatOfferValue(manageOffer)}</p>
          <div className="target-tabs">
            <button
              type="button"
              className={`btn ${targetTab === "productos" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setTargetTab("productos")}
            >
              Productos
            </button>
            <button
              type="button"
              className={`btn ${targetTab === "categorias" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => {
                if (manageOffer.tipo !== "PERCENT") return;
                setTargetTab("categorias");
              }}
              disabled={manageOffer.tipo !== "PERCENT"}
              title={manageOffer.tipo !== "PERCENT" ? "Solo % por categoria" : ""}
            >
              Categorias
            </button>
          </div>
          {manageOffer.tipo !== "PERCENT" ? (
            <p className="helper-text">Las categorias solo estan disponibles para ofertas tipo PERCENT.</p>
          ) : null}
          <div className="offer-products-layout">
            {targetTab === "productos" ? (
              <>
                <section className="modal-section">
                  <div className="modal-section-head">
                    <h4>Asociados</h4>
                    <span>{linkedProducts.length} productos</span>
                  </div>
                  <div className="table-wrap">
                    <table className="offer-table">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Override</th>
                          <th>Accion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linkedProducts.map((item) => {
                          const product = products.find((entry) => entry.id_producto === item.id_producto);
                          return (
                            <tr key={item.id_producto}>
                              <td>
                                <strong>{product?.nombre || item.id_producto}</strong>
                                <div className="muted small">{item.id_producto}</div>
                              </td>
                              <td>
                                {manageOffer.tipo === "PRICE_OVERRIDE" ? (
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={overrideByProduct[item.id_producto] || ""}
                                    placeholder="0.00"
                                    onChange={(event) => setOverrideByProduct((current) => ({
                                      ...current,
                                      [item.id_producto]: event.target.value,
                                    }))}
                                  />
                                ) : (
                                  item.precio_override ?? "-"
                                )}
                              </td>
                              <td>
                                <div className="offer-row-actions">
                                  {manageOffer.tipo === "PRICE_OVERRIDE" ? (
                                    <button
                                      type="button"
                                      className={`btn btn-primary ${isPendingAction(`product:save:${item.id_producto}`) ? "btn-busy" : ""}`}
                                      disabled={managingProducts}
                                      onClick={() => handleSaveProductOverride(product || item)}
                                    >
                                      Guardar precio
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    className={`btn btn-ghost ${isPendingAction(`product:remove:${item.id_producto}`) ? "btn-busy" : ""}`}
                                    disabled={managingProducts}
                                    onClick={() => handleDetachProduct(item.id_producto)}
                                  >
                                    Quitar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {linkedProducts.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="table-empty">Esta oferta aun no tiene productos asociados.</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="modal-section">
                  <div className="modal-section-head">
                    <h4>Agregar productos</h4>
                    <span>{productsLoading ? "Cargando..." : `${availableProducts.length} disponibles`}</span>
                  </div>
                  <label>
                    Buscar producto
                    <input
                      value={productQuery}
                      autoComplete="off"
                      placeholder="Nombre o ID..."
                      onChange={(event) => setProductQuery(event.target.value)}
                    />
                  </label>
                  <div className="table-wrap">
                    <table className="offer-table">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Precio base</th>
                          {manageOffer.tipo === "PRICE_OVERRIDE" ? <th>Precio override</th> : null}
                          <th>Accion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {availableProducts.map((product) => (
                          <tr key={product.id_producto}>
                            <td>
                              <strong>{product.nombre}</strong>
                              <div className="muted small">{product.id_producto}</div>
                            </td>
                            <td>{product.precio_venta}</td>
                            {manageOffer.tipo === "PRICE_OVERRIDE" ? (
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={overrideByProduct[product.id_producto] || ""}
                                  placeholder="0.00"
                                  onChange={(event) => setOverrideByProduct((current) => ({
                                    ...current,
                                    [product.id_producto]: event.target.value,
                                  }))}
                                />
                              </td>
                            ) : null}
                            <td>
                              <button
                                type="button"
                                className={`btn btn-primary ${isPendingAction(`product:save:${product.id_producto}`) ? "btn-busy" : ""}`}
                                disabled={managingProducts}
                                onClick={() => handleAttachProduct(product)}
                              >
                                Agregar
                              </button>
                            </td>
                          </tr>
                        ))}
                        {availableProducts.length === 0 ? (
                          <tr>
                            <td colSpan={manageOffer.tipo === "PRICE_OVERRIDE" ? 4 : 3} className="table-empty">
                              {linkedProducts.length > 0
                                ? "No hay productos nuevos para esa busqueda."
                                : "No hay productos para esa busqueda."}
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : (
              <>
                <section className="modal-section">
                  <div className="modal-section-head">
                    <h4>Categorias asociadas</h4>
                    <span>{linkedCategories.length} categorias</span>
                  </div>
                  <div className="table-wrap">
                    <table className="offer-table">
                      <thead>
                        <tr>
                          <th>Categoria</th>
                          <th>Activa</th>
                          <th>Accion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linkedCategories.map((item) => {
                          const category = categories.find((entry) => entry.id_categoria === item.id_categoria);
                          return (
                            <tr key={item.id_categoria}>
                              <td>{category?.nombre || item.id_categoria}</td>
                              <td>{item.activo ? "Si" : "No"}</td>
                              <td>
                                <button
                                  type="button"
                                  className={`btn btn-ghost ${isPendingAction(`category:remove:${item.id_categoria}`) ? "btn-busy" : ""}`}
                                  disabled={managingProducts}
                                  onClick={() => handleDetachCategory(item.id_categoria)}
                                >
                                  Quitar
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {linkedCategories.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="table-empty">Esta oferta aun no tiene categorias asociadas.</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="modal-section">
                  <div className="modal-section-head">
                    <h4>Agregar categorias</h4>
                    <span>{productsLoading ? "Cargando..." : `${availableCategories.length} disponibles`}</span>
                  </div>
                  <label>
                    Buscar categoria
                    <input
                      value={categoryQuery}
                      autoComplete="off"
                      placeholder="Nombre o ID..."
                      onChange={(event) => setCategoryQuery(event.target.value)}
                    />
                  </label>
                  <div className="table-wrap">
                    <table className="offer-table">
                      <thead>
                        <tr>
                          <th>Categoria</th>
                          <th>Estado</th>
                          <th>Accion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {availableCategories.map((category) => (
                          <tr key={category.id_categoria}>
                            <td>
                              <strong>{category.nombre}</strong>
                              <div className="muted small">{category.id_categoria}</div>
                            </td>
                            <td>{category.activa ? "Activa" : "Inactiva"}</td>
                            <td>
                              <button
                                type="button"
                                className={`btn btn-primary ${isPendingAction(`category:save:${category.id_categoria}`) ? "btn-busy" : ""}`}
                                disabled={managingProducts}
                                onClick={() => handleAttachCategory(category)}
                              >
                                Agregar
                              </button>
                            </td>
                          </tr>
                        ))}
                        {availableCategories.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="table-empty">
                              {linkedCategories.length > 0
                                ? "No hay categorias nuevas para esa busqueda."
                                : "No hay categorias para esa busqueda."}
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </div>
        </Card>
      ) : null}

      {bannerOffer ? (
        <ModalFrame
          title={`Banner de ${bannerOffer.nombre}`}
          subtitle={bannerOffer.banner_url ? "Puedes reemplazar la imagen actual." : "Aun no hay banner cargado."}
          onClose={() => setBannerOffer(null)}
        >
          <div className="banner-modal-body">
            {bannerOffer.banner_url ? (
              <div className="offer-banner-preview">
                <img src={getImageSrc(bannerOffer.banner_url)} alt={bannerOffer.nombre} className="offer-banner-image" />
                <a href={getImageSrc(bannerOffer.banner_url)} target="_blank" rel="noreferrer" className="current-image-link">
                  Abrir banner
                </a>
              </div>
            ) : (
              <p className="muted small">Sin banner cargado.</p>
            )}
            <ImageDropZone
              title={bannerUploading === bannerOffer.id_oferta ? "Subiendo banner..." : "Subir banner"}
              subtitle="JPG, PNG o WEBP"
              disabled={bannerUploading === bannerOffer.id_oferta}
              onFileSelected={handleBannerUpload}
            />
          </div>
        </ModalFrame>
      ) : null}
    </>
  );
}

function AuditoriaScreen() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => { api.auditLogs().then(setRows).catch((e) => setError(e.message)); }, []);
  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((r) => {
      const haystack = [
        r.accion,
        r.email_usuario,
        r.id_tienda,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [rows, query]);
  return (
    <Card title="Auditoria">
      {error ? <p className="error-text">{error}</p> : null}
      <div className="audit-filters">
        <label>
          Buscar en auditoria
          <input
            value={query}
            autoComplete="off"
            placeholder="Accion, usuario o tienda..."
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Accion</th><th>Usuario</th><th>Tienda</th></tr></thead><tbody>
        {filteredRows.map((r) => <tr key={r.id}><td>{new Date(r.fecha_hora).toLocaleString()}</td><td>{r.accion}</td><td>{r.email_usuario || "-"}</td><td>{r.id_tienda || "-"}</td></tr>)}
        {filteredRows.length === 0 ? <tr><td colSpan={4} className="table-empty">No hay eventos para esa busqueda.</td></tr> : null}
      </tbody></table></div>
    </Card>
  );
}

function StoreWhatsappCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [store, setStore] = useState(null);
  const [whatsapp, setWhatsapp] = useState("");

  const loadStore = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.adminGetMyStore();
      setStore(data);
      setWhatsapp(data.whatsapp_number || "");
    } catch (err) {
      setError(err.message || "No se pudo cargar la tienda");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStore();
  }, []);

  return (
    <Card title="WhatsApp de la tienda">
      {loading ? <p className="muted">Cargando...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {store ? <p className="muted small">{store.nombre_tienda} ({store.slug})</p> : null}
      <form className="grid-form" onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        setError("");
        setOk("");
        try {
          const updated = await api.adminUpdateMyStore({ whatsapp_number: whatsapp || null });
          setStore(updated);
          setWhatsapp(updated.whatsapp_number || "");
          setOk("Numero de WhatsApp actualizado");
        } catch (err) {
          setError(err.message || "No se pudo guardar");
        } finally {
          setSaving(false);
        }
      }}>
        <label>
          Numero de WhatsApp
          <input
            value={whatsapp}
            autoComplete="off"
            placeholder="+51999999999"
            onChange={(event) => setWhatsapp(event.target.value)}
          />
        </label>
        <HelperText text="Usa formato internacional con codigo de pais." />
        {ok ? <p className="ok-text">{ok}</p> : null}
        <button className="btn btn-primary" disabled={saving}>{saving ? "Guardando..." : "Guardar WhatsApp"}</button>
      </form>
    </Card>
  );
}

function DashboardScreen({ user }) {
  return (
    <div className="stack">
      <Card title="Dashboard">
        <p className="muted">Bienvenido al panel privado.</p>
        <div className="stats">
          <div className="stat"><span>Usuario</span><strong>{user.email}</strong></div>
          <div className="stat"><span>Rol</span><strong>{user.rol}</strong></div>
          <div className="stat"><span>Tienda</span><strong>{user.id_tienda}</strong></div>
        </div>
      </Card>
      {canUseCatalog(user.rol) ? <StoreWhatsappCard /> : null}
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
      try { setUser(await api.me()); } catch { clearToken(); setTokenState(""); setUser(null); } finally { setBooting(false); }
    };
    boot();
  }, [token]);

  useEffect(() => {
    const isPublicAuthPath = publicAuthPaths.includes(path);
    if (!token && !isPublicAuthPath) go("/admin/login");
    if (token && user && isPublicAuthPath) go(`/admin/${menuByRole(user.rol)[0]?.[0] || "dashboard"}`);
  }, [token, user, path]);

  const login = async (email, password) => {
    const data = await api.login(email, password);
    setToken(data.access_token);
    setTokenState(data.access_token);
    setUser(data.user || null);
  };

  if (booting) return <main className="auth-shell"><div className="auth-card">Cargando...</div></main>;
  if (!token || !user) {
    if (path === "/admin/forgot-password") {
      return <ForgotPasswordPage onBackToLogin={() => go("/admin/login")} />;
    }
    if (path === "/admin/reset-password") {
      return <ResetPasswordPage onBackToLogin={() => go("/admin/login")} />;
    }
    return <LoginPage onLogin={login} onForgotPassword={() => go("/admin/forgot-password")} />;
  }

  let content = <DashboardScreen user={user} />;
  if (section === "tiendas" && user.rol === "superadmin") content = <TiendasScreen />;
  if (section === "usuarios" && user.rol === "superadmin") content = <UsuariosScreen />;
  if (section === "catalogo" && canUseCatalog(user.rol)) content = <CatalogoScreen isSuperadmin={user.rol === "superadmin"} />;
  if (section === "tema" && ["superadmin", "admin"].includes(user.rol)) content = <ThemeAppearanceScreen isSuperadmin={user.rol === "superadmin"} Card={Card} HelperText={HelperText} StoreRefPicker={StoreRefPicker} />;
  if (section === "ofertas" && canUseCatalog(user.rol)) content = <OffersScreen isSuperadmin={user.rol === "superadmin"} />;
  if (section === "auditoria" && ["superadmin", "admin"].includes(user.rol)) content = <AuditoriaScreen />;

  return (
    <Layout user={user} section={section} onSection={(s) => go(`/admin/${s}`)} onLogout={() => { clearToken(); setTokenState(""); setUser(null); go("/admin/login"); }}>
      {content}
    </Layout>
  );
}

export default App;
