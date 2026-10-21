import React, { useState, useMemo } from 'react';
import { api } from '../../api';
import { useTheme } from '../layout/ThemeContext';

/* ==========================================================================
   SHELL COMÚN DE AUTENTICACIÓN CON FONDO ANIMADO LIGERO Y TOGGLE DE TEMA
   ========================================================================== */
function AuthShell({ children }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <main className="auth-shell">
      {/* Botón flotante para alternar Modo Oscuro / Claro en el Login */}
      <button
        type="button"
        className="auth-theme-toggle"
        onClick={toggleTheme}
        title={theme === "dark" ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
        aria-label="Cambiar tema visual"
      >
        {theme === "dark" ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
        )}
      </button>

      {/* Capa de fondo animada ultra ligera (GPU composited translate3d, 0% CPU lag) */}
      <div className="auth-ambient-canvas" aria-hidden="true">
        <div className="auth-ambient-orb orb-1" />
        <div className="auth-ambient-orb orb-2" />
        <div className="auth-ambient-orb orb-3" />
        <div className="auth-grid-overlay" />

        {/* Badges tecnológicos decorativos para esquinas en pantallas de escritorio */}
        <div className="auth-ambient-badge top-left">
          <span className="auth-ambient-pulse" />
          <span>Catálogo VR Cloud v2.5</span>
        </div>
        <div className="auth-ambient-badge bottom-right">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
          </svg>
          <span>SSL 256-Bit Protection</span>
        </div>
      </div>

      <div className="auth-container">
        {children}
      </div>
    </main>
  );
}

/* ==========================================================================
   PANTALLA DE INICIO DE SESIÓN (LOGIN)
   ========================================================================== */
export function LoginPage({ onLogin, onForgotPassword }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) return;
    setLoading(true);
    setError("");
    try {
      await onLogin(identifier.trim(), password);
    } catch (err) {
      setError(err.message || "Usuario o contraseña incorrectos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <form className="auth-card" onSubmit={handleSubmit} noValidate={false}>
        {/* Logo / Monograma */}
        <div className="auth-brand">
          <div className="auth-logo-badge">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <span className="auth-badge-label">Catálogo VR</span>
          <h1 className="auth-title">Panel Administrativo</h1>
          <p className="auth-subtitle">Ingresa con tu usuario o correo para gestionar tu catálogo</p>
        </div>

        {/* Mensaje de error */}
        {error && (
          <div className="auth-alert error" role="alert">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Campo Usuario o Correo */}
        <div className="auth-field-group">
          <label htmlFor="auth-identifier" className="auth-label">
            Usuario o Correo
          </label>
          <div className="auth-input-wrapper">
            <span className="auth-input-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </span>
            <input
              id="auth-identifier"
              type="text"
              className="auth-input"
              placeholder="ej. luisfernando o tu@correo.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              required
              autoFocus
            />
          </div>
          <p className="auth-field-hint">Puedes ingresar con tu nombre de usuario o tu email registrado.</p>
        </div>

        {/* Campo Contraseña */}
        <div className="auth-field-group">
          <div className="auth-label-row">
            <label htmlFor="auth-password" className="auth-label">
              Contraseña
            </label>
            <button
              type="button"
              className="auth-link-forgot"
              onClick={onForgotPassword}
              tabIndex={0}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
          <div className="auth-input-wrapper">
            <span className="auth-input-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              className="auth-input with-toggle"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
              aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                  <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                  <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                  <line x1="2" y1="2" x2="22" y2="22" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Botón de Ingreso */}
        <button type="submit" className="auth-submit-btn" disabled={loading}>
          {loading ? (
            <span className="auth-btn-content">
              <span className="auth-spinner" />
              Iniciando sesión...
            </span>
          ) : (
            <span className="auth-btn-content">
              Ingresar al Panel
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </span>
          )}
        </button>

        {/* Pie de página seguro */}
        <div className="auth-footer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
          </svg>
          <span>Conexión cifrada con JWT & Roles</span>
        </div>
      </form>
    </AuthShell>
  );
}

/* ==========================================================================
   PANTALLA DE RECUPERACIÓN DE CONTRASEÑA
   ========================================================================== */
export function ForgotPasswordPage({ onBackToLogin }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [debugResetUrl, setDebugResetUrl] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <AuthShell>
      <form
        className="auth-card"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!email.trim()) return;
          setLoading(true);
          setError("");
          setMessage("");
          setDebugResetUrl("");
          try {
            const response = await api.forgotPassword(email.trim());
            setMessage(response.message || "Si el usuario existe, enviaremos las instrucciones.");
            setDebugResetUrl(response.reset_url || "");
          } catch (err) {
            setError(err.message || "No se pudo procesar la solicitud.");
          } finally {
            setLoading(false);
          }
        }}
      >
        <div className="auth-brand">
          <div className="auth-logo-badge secondary">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="auth-title">Recuperar Acceso</h1>
          <p className="auth-subtitle">Ingresa tu correo registrado para recibir un enlace de restablecimiento</p>
        </div>

        {error && (
          <div className="auth-alert error" role="alert">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="auth-alert success" role="status">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>{message}</span>
          </div>
        )}

        <div className="auth-field-group">
          <label htmlFor="auth-forgot-email" className="auth-label">
            Correo electrónico
          </label>
          <div className="auth-input-wrapper">
            <span className="auth-input-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </span>
            <input
              id="auth-forgot-email"
              type="email"
              className="auth-input"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
        </div>

        {debugResetUrl && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--brand-primary)" }}>
              Enlace de Restablecimiento Directo:
            </span>
            <a
              href={debugResetUrl}
              className="auth-debug-link"
              target="_blank"
              rel="noreferrer"
            >
              Restablecer mi contraseña ahora →
            </a>
          </div>
        )}

        <button type="submit" className="auth-submit-btn" disabled={loading}>
          {loading ? (
            <span className="auth-btn-content">
              <span className="auth-spinner" />
              Enviando enlace...
            </span>
          ) : (
            <span className="auth-btn-content">
              Enviar Instrucciones
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </span>
          )}
        </button>

        <button type="button" className="auth-ghost-btn" onClick={onBackToLogin}>
          ← Volver a Iniciar Sesión
        </button>
      </form>
    </AuthShell>
  );
}

/* ==========================================================================
   PANTALLA DE RESTABLECIMIENTO DE CONTRASEÑA
   ========================================================================== */
export function ResetPasswordPage({ onBackToLogin }) {
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
    <AuthShell>
      <form
        className="auth-card"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!token) {
            setError("Token de recuperación ausente o inválido.");
            return;
          }
          if (password !== confirm) {
            setError("Las contraseñas no coinciden.");
            return;
          }
          if (password.length < 6) {
            setError("La contraseña debe tener al menos 6 caracteres.");
            return;
          }
          setLoading(true);
          setError("");
          setMessage("");
          try {
            const response = await api.resetPassword(token, password);
            setMessage(response.message || "Contraseña actualizada exitosamente.");
          } catch (err) {
            setError(err.message || "No se pudo restablecer la contraseña");
          } finally {
            setLoading(false);
          }
        }}
      >
        <div className="auth-brand">
          <div className="auth-logo-badge secondary">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <h1 className="auth-title">Nueva Contraseña</h1>
          <p className="auth-subtitle">Crea una contraseña segura para tu cuenta</p>
        </div>

        {error && (
          <div className="auth-alert error">
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="auth-alert success">
            <span>{message}</span>
          </div>
        )}

        <div className="auth-field-group">
          <label className="auth-label">Nueva Contraseña</label>
          <input
            type="password"
            className="auth-input simple"
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div className="auth-field-group">
          <label className="auth-label">Confirmar Contraseña</label>
          <input
            type="password"
            className="auth-input simple"
            placeholder="Repite la contraseña"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="auth-submit-btn" disabled={loading}>
          {loading ? "Guardando..." : "Guardar Nueva Contraseña"}
        </button>

        <button type="button" className="auth-ghost-btn" onClick={onBackToLogin}>
          ← Volver a Iniciar Sesión
        </button>
      </form>
    </AuthShell>
  );
}
