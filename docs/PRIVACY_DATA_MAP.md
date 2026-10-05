# Mapa de Datos de Privacidad — Catalogo VR

> **Audiencia:** Equipo técnico y responsable legal.
> **Propósito:** Inventario de todos los datos personales procesados por la plataforma.
>
> ⚠ Este documento es una base técnica. No constituye cumplimiento normativo.
> El responsable legal debe revisarlo antes de publicar la política de privacidad.

---

## 1. Resumen de datos personales

| Categoría | Dato | Tabla | Finalidad | Retención | Terceros |
|-----------|------|-------|-----------|-----------|---------|
| Cuenta admin | Email | `usuarios` | Autenticación, recuperación de contraseña | Mientras la tienda esté activa | Ninguno |
| Cuenta admin | Hash de contraseña (bcrypt) | `usuarios` | Autenticación | Ídem | Ninguno |
| Cuenta admin | Rol | `usuarios` | Control de acceso | Ídem | Ninguno |
| Cliente catálogo | Nombre completo | `clientes` | Identificación del pedido | Pendiente de definición formal (en BD activa) | Ninguno |
| Cliente catálogo | Teléfono | `clientes` | Contacto por WhatsApp | Pendiente de definición formal (en BD activa) | Ninguno |
| Cliente catálogo | Ciudad / región | `clientes` | Logística opcional | Pendiente de definición formal (en BD activa) | Ninguno |
| Cliente catálogo | Email | `clientes` | Cuenta opcional en catálogo | Pendiente de definición formal (en BD activa) | Ninguno |
| Pedido | Detalle de productos, cantidades, precios, estado | `ventas`, `detalle_ventas` | Gestión de venta | Pendiente de definición formal (en BD activa) | Ninguno |
| Reset contraseña | Token temporal | `password_reset_tokens` | Recuperación de cuenta | 30 minutos (expira técnicamente) | Ninguno |
| Evento analítica | IP del visitante, user-agent, tipo de evento | `public_events` | Analítica propia por tienda | Pendiente de definición formal (sin purga automática) | Ninguno |
| Auditoría | Usuario, IP, método HTTP, ruta, cambios | `audit_logs` | Seguridad interna | Pendiente de definición formal | Ninguno |

---

## 2. Cookies y almacenamiento del navegador

| Mecanismo | Clave | Finalidad | Duración | ¿Esencial? |
|-----------|-------|-----------|----------|------------|
| `localStorage` (admin) | `token` | Token JWT de sesión del administrador | Hasta logout o expiración | ✅ Sí |
| `localStorage` (catálogo) | `customer_token_<slug>` | Token JWT de cuenta de cliente | Hasta logout | ✅ Sí |
| `localStorage` (catálogo) | `cart_<slug>` | Carrito de compras persistente | Persiste hasta vaciado o limpieza manual | ✅ Sí |

**Conclusión:** La plataforma no usa cookies de seguimiento, publicidad, ni
servicios analíticos de terceros (Google Analytics, Meta Pixel, etc.). Por tanto
no se requiere banner de consentimiento de cookies para el funcionamiento actual.

---

## 3. Flujos de datos personales

### 3.1 Registro de administrador
```
Usuario → panel-admin → POST /api/auth/register
  → BD: tabla usuarios (email + bcrypt hash)
  → No se envía a terceros
```

### 3.2 Checkout (pedido desde catálogo)
```
Cliente → catálogo público → POST /api/public/catalog/{slug}/checkout
  → BD: tabla clientes (nombre, teléfono, ciudad)
  → BD: tabla ventas + detalle_ventas
  → Redireccionamiento a WhatsApp (datos en URL, NO enviados al servidor de WhatsApp por nosotros)
```

### 3.3 Evento de analítica
```
Visitante → catálogo público → POST /api/public/catalog/{slug}/events
  → BD: tabla public_events (ip, user-agent, tipo de evento)
  → Solo accesible para el superadmin y el admin de la tienda
```

### 3.4 Recuperación de contraseña
```
Admin → panel-admin → POST /api/auth/forgot-password
  → BD: tabla password_reset_tokens (token temporal, 30 min)
  → SMTP: email al usuario con enlace de reset
  → El token se destruye al usarse o expirar
```

### 3.5 Registro de auditoría
```
Toda mutación autenticada → middleware AuditMiddleware
  → BD: tabla audit_logs (usuario, IP, método, ruta, body resumido)
  → Solo accesible para superadmin
```

---

## 4. Proveedores de infraestructura con acceso a datos

| Proveedor | Servicio | Datos con acceso potencial |
|-----------|---------|---------------------------|
| Vercel | Alojamiento y entrega de frontends (público y administrativo) | Logs técnicos de entrega y solicitudes web |
| Render | Ejecución del backend FastAPI y procesamiento de solicitudes | Procesamiento de solicitudes HTTP y logs de aplicación |
| Neon (PostgreSQL) | Base de datos relacional (conexión SSL obligatoria) | Almacenamiento de usuarios, tiendas, pedidos, eventos y auditoría |
| Cloudflare R2 | Almacenamiento de imágenes de catálogo | Archivos de imágenes. Se eliminan metadatos técnicos (EXIF), pero el contenido visual continúa siendo responsabilidad de quien sube la imagen, ya que una fotografía puede contener personas u otra información visible |
| Proveedor SMTP externo (opcional) | Envío de emails transaccionales (únicamente si está configurado) | Dirección de email del administrador que solicita reset de contraseña |

---

## 5. Datos que NO recopilamos

- Datos de pago o tarjeta de crédito (los pagos se negocian por WhatsApp)
- Datos biométricos
- Datos de menores de edad (no hay mecanismo de verificación de edad)
- Geolocalización precisa

---

## 6. Derechos del usuario — mecanismos actuales

| Derecho | Mecanismo actual |
|---------|-----------------|
| Acceso a datos | Contacto por email al responsable |
| Corrección | Contacto por email al responsable |
| Eliminación | El superadmin puede eliminar cuentas y datos desde el panel |
| Portabilidad | No implementado (pendiente Fase 3) |

---

## 7. Pendientes técnicos de privacidad

- [ ] Implementar endpoint de eliminación de cuenta de cliente (`DELETE /api/public/catalog/{slug}/customers/me`)
- [ ] Añadir expiración automática de registros de `public_events` (cron job)
- [ ] Verificar que los tokens JWT expirados no puedan reutilizarse (revocation list)
- [ ] Revisar si el campo `user_agent` en `public_events` es necesario o puede anonimizarse
- [ ] Política final revisada por profesional legal antes de publicar

---

*Documento de inventario técnico · Revisar periódicamente cuando se incorporen nuevas funcionalidades que procesen datos.*
