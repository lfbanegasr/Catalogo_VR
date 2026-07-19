# E2E Manual (5 min) - Forgot Password

Este checklist valida que el flujo de recuperacion de contrasena esta listo para produccion.

## 0) Pre-requisitos (1 min)

- Backend levantado en `http://127.0.0.1:8000`
- Frontend admin levantado en `http://localhost:5174`
- Migraciones aplicadas:
  - `alembic upgrade head`
- Variables de entorno configuradas (SMTP y reset URL) en backend.

Variables clave:

```env
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES=30
PASSWORD_RESET_URL_BASE=http://localhost:5174/admin/reset-password
PASSWORD_RESET_DEBUG_RETURN_TOKEN=false
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM_EMAIL=...
SMTP_USE_TLS=true
```

## 1) Smoke rapido en local (2 min)

### Opcion A (recomendada): modo debug con token en respuesta

1. En `.env` del backend:
   - `PASSWORD_RESET_DEBUG_RETURN_TOKEN=true`
2. Reinicia backend.
3. Ejecuta script:

```powershell
powershell -ExecutionPolicy Bypass -File .\backend\scripts\e2e_password_reset_smoke.ps1 -Email "tu_usuario@correo.com" -NewPassword "NuevaClave123!"
```

Esperado:
- `forgot-password` responde 200.
- Retorna `reset_token` o `reset_url`.
- `reset-password` responde 200.
- `login-json` con nueva clave responde 200 (token JWT).

### Opcion B: manual con Postman/curl

1. `POST /api/auth/forgot-password` con `{ "email": "..." }`
2. Copia token (debug) o abre enlace del correo.
3. `POST /api/auth/reset-password` con token + nueva clave.
4. `POST /api/auth/login-json` con nueva clave.

## 2) Prueba real de correo SMTP (1 min)

1. Deja `PASSWORD_RESET_DEBUG_RETURN_TOKEN=false`.
2. Solicita recuperacion desde:
   - `http://localhost:5174/admin/forgot-password`
3. Verifica:
   - llega correo
   - enlace abre `/admin/reset-password?token=...`
   - puedes guardar nueva contrasena
   - luego login exitoso con clave nueva

## 3) Checklist de seguridad antes de nube (1 min)

- [ ] `PASSWORD_RESET_DEBUG_RETURN_TOKEN=false` en produccion.
- [ ] `SECRET_KEY` fuerte y unica en produccion.
- [ ] `PASSWORD_RESET_URL_BASE` apunta al dominio real admin.
- [ ] SMTP real configurado (host, puerto, usuario, remitente).
- [ ] HTTPS activo en dominio admin/backend.
- [ ] Logs de auditoria registran `forgot_password` y `reset_password`.
- [ ] Token de recuperacion expira y es de un solo uso.

## 4) Resultado final esperado

Flujo completo validado:

1. Usuario solicita recuperacion.
2. Recibe enlace.
3. Cambia contrasena.
4. Puede iniciar sesion con la nueva clave.
5. No puede reutilizar el token.
