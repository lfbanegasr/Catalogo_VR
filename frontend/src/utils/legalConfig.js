/**
 * legalConfig.js
 * Configuración centralizada de datos legales y proveedores de infraestructura.
 *
 * Variables de entorno de Vite:
 *   VITE_FRONTEND_HOSTING_PROVIDER  Proveedor de alojamiento frontend (ej. Vercel)
 *   VITE_BACKEND_HOSTING_PROVIDER   Proveedor de ejecución backend (ej. Render)
 *   VITE_DATABASE_PROVIDER          Proveedor de base de datos (ej. Neon PostgreSQL)
 *   VITE_STORAGE_PROVIDER           Proveedor de almacenamiento de imágenes (ej. Cloudflare R2)
 *   VITE_LEGAL_OPERATOR_NAME        Nombre o razón social del responsable del servicio
 *   VITE_LEGAL_COUNTRY              País o jurisdicción (por defecto: Bolivia)
 *   VITE_LEGAL_CONTACT_EMAIL        Canal de contacto para solicitudes legales/privacidad
 *   VITE_LEGAL_PRIVACY_DATE         Fecha de vigencia de privacidad (YYYY-MM-DD)
 *   VITE_LEGAL_TERMS_DATE           Fecha de vigencia de términos (YYYY-MM-DD)
 */

export const LEGAL_CONFIG = {
  // ── Responsable del servicio ──────────────────────────────────────────────
  operatorName:
    import.meta.env.VITE_LEGAL_OPERATOR_NAME || "[NOMBRE DEL RESPONSABLE PENDIENTE]",

  // ── Jurisdicción por defecto: Bolivia ─────────────────────────────────────
  country: import.meta.env.VITE_LEGAL_COUNTRY || "Bolivia",

  // ── Contacto para privacidad ──────────────────────────────────────────────
  contactEmail:
    import.meta.env.VITE_LEGAL_CONTACT_EMAIL || "[contacto@pendiente.com]",

  // ── Versión y fechas configurables (sin fechas dinámicas ficticias) ───────
  privacyVersion: import.meta.env.VITE_LEGAL_PRIVACY_VERSION || "1.0",
  privacyEffectiveDate:
    import.meta.env.VITE_LEGAL_PRIVACY_DATE || "Fecha pendiente de configuración",
  termsVersion: import.meta.env.VITE_LEGAL_TERMS_VERSION || "1.0",
  termsEffectiveDate:
    import.meta.env.VITE_LEGAL_TERMS_DATE || "Fecha pendiente de configuración",

  // ── Periodos de conservación de datos ────────────────────────────────────
  retentionOrders:
    "Pendiente de definición formal (conservados mientras la tienda opere o según requerimiento comercial)",
  retentionAudit: "Pendiente de definición formal",
  retentionEvents:
    "Pendiente de definición formal (almacenados en base de datos sin depuración automática programada)",
  retentionPasswordReset: "30 minutos (vencimiento técnico del token)",

  // ── Proveedores de infraestructura reales ────────────────────────────────
  frontendHostingProvider:
    import.meta.env.VITE_FRONTEND_HOSTING_PROVIDER || "Vercel",
  backendHostingProvider:
    import.meta.env.VITE_BACKEND_HOSTING_PROVIDER || "Render",
  databaseProvider:
    import.meta.env.VITE_DATABASE_PROVIDER || "Neon PostgreSQL",
  storageProvider:
    import.meta.env.VITE_STORAGE_PROVIDER || "Cloudflare R2",

  // ── Comprobación estricta de configuración completa ──────────────────────
  get isConfigured() {
    const hasValidOperator =
      Boolean(this.operatorName) && !this.operatorName.includes("[");
    const hasValidEmail =
      Boolean(this.contactEmail) && !this.contactEmail.includes("[");
    const hasValidCountry =
      Boolean(this.country) && !this.country.includes("[");
    const hasValidPrivacyDate =
      Boolean(this.privacyEffectiveDate) &&
      this.privacyEffectiveDate !== "Fecha pendiente de configuración";
    const hasValidTermsDate =
      Boolean(this.termsEffectiveDate) &&
      this.termsEffectiveDate !== "Fecha pendiente de configuración";

    return (
      hasValidOperator &&
      hasValidEmail &&
      hasValidCountry &&
      hasValidPrivacyDate &&
      hasValidTermsDate
    );
  },
};

export default LEGAL_CONFIG;
