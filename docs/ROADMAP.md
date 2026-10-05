# Roadmap — Catalogo VR

> Documento de planificación y seguimiento de fases técnicas.
> Estado de avance actualizado y prioridades de desarrollo.

---

## ✅ Fase 1 — MVP B2C (Completada)

Construcción del sistema base con aislamiento multi-tenant desde el inicio.

- [x] Diseño de la base de datos (PostgreSQL) con tablas core, relaciones y índices
- [x] Backend REST con FastAPI, Alembic, SQLAlchemy y autenticación JWT
- [x] Catálogo público dinámico con temas, filtros, carrito y checkout a WhatsApp
- [x] Panel de administración privado (superadmin y admin)
- [x] Integración básica con WhatsApp (carrito → WhatsApp con detalle del pedido)
- [x] Variantes de producto con stock e imágenes independientes
- [x] Sets de productos con stock calculado
- [x] Atributos de producto filtrables
- [x] Campañas de ofertas con banner, fecha y tipos (porcentaje / precio fijo)
- [x] 3 temas visuales configurables por tienda
- [x] Upload y galería de imágenes con optimización WebP
- [x] Cuentas de cliente en el catálogo público
- [x] Seguimiento de pedidos por código
- [x] Recuperación de contraseña por email
- [x] Rate limiting por IP
- [x] Cabeceras de seguridad HTTP
- [x] Registro de auditoría
- [x] Almacenamiento local y Cloudflare R2
- [x] PDF de catálogo exportable
- [x] Páginas de privacidad y términos de uso

---

## 🔵 Fase 2 — Control de ventas e inventario (En desarrollo)

### Paso 1 — Checkout y registro de ventas
- [ ] Completar flujo de checkout con formulario rápido (Nombre, Teléfono, Ciudad)
- [ ] Endpoint `POST /api/public/catalog/{slug}/checkout` funcional end-to-end
- [ ] Guardar venta con estado `generada_whatsapp` antes de redirigir

### Paso 2 — Dashboard de métricas
- [ ] Habilitar acceso al dashboard para rol `empleado`
- [ ] Endpoint `/api/sales/metrics`: ventas totales, costos, margen, ranking productos
- [ ] Filtros por categoría, producto y período
- [ ] Gráficos interactivos en el frontend (SVG o librería ligera)

### Paso 3 — Estados de venta e inventario
- [ ] Marcar venta como `completada` o `cancelada` desde el panel
- [ ] Ajuste automático de stock al cambiar estado
- [ ] Pantalla de control de inventario con costos, precios y márgenes

### Paso 4 — Exportación de reportes
- [ ] Exportar inventario y ventas a CSV/Excel
- [ ] Exportar reporte PDF desde el panel

---

## 🟣 Fase 3 — SaaS Comercial (Siguiente)

### Paso 1 — Módulo de suscripciones
- [ ] Definición de planes (Gratuito, Pro, Premium) con límites
- [ ] Integración con Stripe u otras pasarelas locales
- [ ] Facturación automatizada a tenants

### Paso 2 — Gestión avanzada de tenants
- [ ] Panel de superadmin mejorado: activar, suspender, configurar cuotas
- [ ] Onboarding automatizado para nuevas tiendas

---

## 🟠 Fase 4 — Aplicación Móvil (Futuro)

- [ ] App Flutter (Android/iOS) consumiendo la misma API de FastAPI
- [ ] Catálogo dinámico en móvil
- [ ] Gestión de pedidos desde el celular
- [ ] Notificaciones push

---

## 🛠 Deuda técnica y mejoras pendientes

- [ ] Cache de catálogo con Redis (actualmente in-process LRU, no escala multi-instancia)
- [ ] Migración automática de imágenes existentes a R2
- [ ] Tests de integración end-to-end con base de datos real
- [ ] Pipeline de CI/CD
- [ ] Licencia del proyecto (ver README.md → License)
- [ ] Revisión legal de políticas de privacidad y términos por profesional

---

## Herramientas sugeridas para organización del proyecto

1. **Git/GitHub** — Control de versiones. Ramas por feature: `feature/checkout`, `bugfix/cart`
2. **Trello o GitHub Projects** — Tablero Kanban: Backlog → To Do → In Progress → Done
3. **Figma** — Prototipos visuales antes de implementar en React
