import React, { useState, useMemo } from 'react';
import { api } from '../../api';
import { HelperText } from '../Card';

export function LoginPage({ onLogin, onForgotPassword }) {
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
        try {
          await onLogin(email, password);
        } catch (err) {
          setError(err.message || "Error login");
        } finally {
          setLoading(false);
        }
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

export function ForgotPasswordPage({ onBackToLogin }) {
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
