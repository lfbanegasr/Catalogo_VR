🟢 Fase 1: El MVP B2C (Tu Tienda Propia) - [COMPLETADO]
El objetivo de esta fase fue construir un sistema web básico pero robusto, con aislamiento multi-inquilino (multi-tenant) desde el inicio.
•	Paso 1: Diseño de la Base de Datos (PostgreSQL) - COMPLETADO. Tablas core de tiendas, usuarios, categorías, productos, ofertas, clientes y ventas con índices de optimización.
•	Paso 2: Desarrollo del Backend (Python + FastAPI) - COMPLETADO. API REST robusta construida con FastAPI (en lugar de Django), utilizando Alembic para migraciones, SQLAlchemy ORM y autenticación por tokens JWT.
•	Paso 3: Desarrollo del Frontend Web (React + Vite) - COMPLETADO. Catálogo dinámico para clientes y panel de administración privado para los dueños de tiendas (superadmin y admin).
•	Paso 4: Integración con WhatsApp - PARCIALMENTE COMPLETADO. El carrito de compras actual redirige directamente a WhatsApp con el detalle del pedido. Falta registrar la orden en la base de datos automáticamente al momento del redireccionamiento para permitir el seguimiento en la Fase 2.

🔵 Fase 2: Control de Ventas, Inventario y Dashboard Operativo - [EN DESARROLLO]
En esta fase reestructurada, nos enfocamos en darle al propietario de la tienda y a sus empleados un control total sobre su negocio directamente desde el sistema, sin depender de herramientas externas como Power BI.
•	Paso 1: Registro Automatizado de Ventas (Checkout).
o	Implementar un formulario de checkout rápido en el catálogo de clientes (Nombre, Teléfono, Ciudad/Región).
o	Crear el endpoint público `POST /api/public/catalog/{slug}/checkout` que registre al cliente, guarde la venta con estado `generada_whatsapp` y almacene los detalles de la venta en la base de datos antes de redirigir a WhatsApp.
•	Paso 2: Dashboard Interactivo de Métricas (Para Admins y Empleados).
o	Habilitar el acceso al Dashboard para el rol de `empleado` (actualmente restringido a `admin` y `superadmin`).
o	Crear el endpoint `/api/sales/metrics` en el backend para calcular: ventas totales, costos totales, margen de ganancia neto, ranking de productos más vendidos, distribución por categorías e histórico de ventas diarias/mensuales.
o	Diseñar gráficos interactivos en el frontend admin (usando componentes SVG nativos o una librería ligera de React) que permitan filtrar métricas por categoría o producto.
•	Paso 3: Gestión de Inventario y Estados de Venta.
o	Permitir que el dueño o empleado marque el estado de una venta como `completada` o `cancelada` en el panel de administración.
o	Ajustar el stock automáticamente al cambiar el estado (ej: descontar el stock al completarse, y si se cancela, restaurar el stock correspondiente para evitar pérdidas).
o	Pantalla de control de inventario con visualización de costos de adquisición, precios de venta y márgenes esperados por producto.
•	Paso 4: Exportación de Reportes.
o	Añadir botones para exportar el inventario y el historial de ventas a formato Excel (CSV adaptado para Excel) y reporte PDF directamente desde el Panel de Control.

🟣 Fase 3: Evolución a SaaS Comercial (El Negocio B2B) - [SIGUIENTE]
Transformamos la herramienta en una plataforma comercial distribuible de alquiler de catálogos virtuales.
•	Paso 1: Módulo de Suscripciones y Planes.
o	Definición de planes (Gratuito, Pro, Premium) con límites de productos o características.
o	Integración con pasarelas de pago (Stripe u otras locales) para cobrar mensualidades de manera automatizada a los inquilinos.
•	Paso 2: Gestión de Inquilinos Avanzada.
o	Panel de superadmin mejorado para activar, suspender o configurar tiendas clientes de manera directa.

🟠 Fase 4: La Aplicación Móvil - [FUTURO]
Despliegue móvil para fidelización y portabilidad.
•	Paso 1: Desarrollo en Flutter.
o	Aplicación móvil híbrida (Android/iOS) que consume la misma API de FastAPI para cargar el catálogo dinámico y gestionar pedidos.
________________________________________
Herramientas de Organización Sugeridas
Para mantener el control del proyecto y simular un entorno laboral real:
1.	Git y GitHub: Obligatorio para el control de versiones. Divide tu trabajo en ramas (feature/catalogo, bugfix/carrito).
2.	Trello o Jira: Crea un tablero Kanban con columnas: Backlog (Ideas futuras), To Do (Por hacer esta semana), In Progress (Haciendo) y Done (Terminado).
3.	Figma: Para hacer prototipos visuales rápidos antes de escribir una sola línea de código en React.


 
CONDIGO BASE DE DATOS 
-- 1. TABLAS CORE (SaaS)
CREATE TABLE Tiendas (
    id_tienda UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_tienda VARCHAR(100) NOT NULL,
    dominio_personalizado VARCHAR(100) UNIQUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activa BOOLEAN DEFAULT TRUE
);

CREATE TABLE Usuarios (
    id_usuario UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_tienda UUID NOT NULL REFERENCES Tiendas(id_tienda) ON DELETE CASCADE,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(50) DEFAULT 'admin',
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABLAS DE CATÁLOGO
CREATE TABLE Categorias (
    id_categoria UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_tienda UUID NOT NULL REFERENCES Tiendas(id_tienda) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    activa BOOLEAN DEFAULT TRUE
);

CREATE TABLE Productos (
    id_producto UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_tienda UUID NOT NULL REFERENCES Tiendas(id_tienda) ON DELETE CASCADE,
    id_categoria UUID REFERENCES Categorias(id_categoria) ON DELETE SET NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    precio_venta DECIMAL(10, 2) NOT NULL,
    costo_adquisicion DECIMAL(10, 2),
    stock_actual INT DEFAULT 0,
    imagen_url VARCHAR(255),
    activo BOOLEAN DEFAULT TRUE,
    fecha_agregado TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABLAS DE TRANSACCIÓN (Para tu futuro Data Mart)
CREATE TABLE Clientes (
    id_cliente UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_tienda UUID NOT NULL REFERENCES Tiendas(id_tienda) ON DELETE CASCADE,
    nombre_completo VARCHAR(150) NOT NULL,
    telefono VARCHAR(20),
    ciudad_region VARCHAR(100),
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Ventas (
    id_venta UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_tienda UUID NOT NULL REFERENCES Tiendas(id_tienda) ON DELETE CASCADE,
    id_cliente UUID REFERENCES Clientes(id_cliente) ON DELETE SET NULL,
    fecha_venta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(50) DEFAULT 'pendiente_whatsapp',
    total_venta DECIMAL(12, 2) NOT NULL
);

CREATE TABLE Detalle_Ventas (
    id_detalle UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_venta UUID NOT NULL REFERENCES Ventas(id_venta) ON DELETE CASCADE,
    id_producto UUID REFERENCES Productos(id_producto) ON DELETE RESTRICT,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL
);

-- 4. ÍNDICES DE OPTIMIZACIÓN
-- Esto hará que las consultas filtradas por tienda (SaaS) sean rapidísimas
CREATE INDEX idx_productos_tienda ON Productos(id_tienda);
CREATE INDEX idx_ventas_tienda ON Ventas(id_tienda);
CREATE INDEX idx_clientes_tienda ON Clientes(id_tienda);
