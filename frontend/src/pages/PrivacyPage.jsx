import LEGAL_CONFIG from "../utils/legalConfig";

/**
 * PrivacyPage
 *
 * Página pública de política de privacidad y tratamiento de datos.
 */

function ConfigWarning() {
  if (LEGAL_CONFIG.isConfigured) return null;
  return (
    <div
      role="alert"
      className="legal-warning-banner"
      style={{
        background: "#fef2f2",
        border: "1px solid #ef4444",
        borderRadius: 8,
        padding: "14px 18px",
        marginBottom: 24,
        fontSize: 14,
        color: "#991b1b",
        lineHeight: 1.5,
      }}
    >
      <strong>Aviso importante:</strong> Esta política de privacidad contiene información pendiente de definición por el operador de la plataforma. Antes de presentarse como documento legal definitivo, deben configurarse las variables <code>VITE_LEGAL_OPERATOR_NAME</code> y <code>VITE_LEGAL_CONTACT_EMAIL</code> con datos reales y ser revisada por un asesor legal.
    </div>
  );
}

export default function PrivacyPage({ onBack, onNavigate, slug }) {
  const { operatorName, country, contactEmail, privacyEffectiveDate, privacyVersion } =
    LEGAL_CONFIG;

  const termsUrl = slug ? `?slug=${encodeURIComponent(slug)}&page=terms` : "?page=terms";

  return (
    <main className="legal-page" role="main">
      <div className="legal-container">
        <button
          type="button"
          className="legal-back-btn"
          onClick={onBack}
          aria-label="Volver al catálogo"
        >
          ← Volver al catálogo
        </button>

        <ConfigWarning />

        <header>
          <h1>Política de Privacidad</h1>
          <p className="legal-meta">
            Versión {privacyVersion} · Vigente desde {privacyEffectiveDate}
          </p>
        </header>

        <section>
          <h2>1. Responsable del servicio</h2>
          <p>
            El responsable del tratamiento de datos de esta plataforma es{" "}
            <strong>{operatorName}</strong>, con jurisdicción en{" "}
            <strong>{country}</strong>. Para cualquier consulta o solicitud
            relacionada con privacidad y protección de datos, puedes escribir a{" "}
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
          </p>
        </section>

        <section>
          <h2>2. Datos que recopilamos</h2>

          <h3>2.1 Usuarios administradores</h3>
          <p>
            Al crear o administrar una cuenta de tienda, recopilamos el correo
            electrónico y una contraseña cifrada mediante hash irreversible
            (bcrypt). La plataforma no almacena contraseñas en texto plano.
          </p>

          <h3>2.2 Navegación en el catálogo público</h3>
          <p>
            Cualquier visitante puede navegar el catálogo público libremente. Al
            hacerlo, el servidor puede registrar de manera automatizada eventos de
            navegación (tales como visualización de categorías, productos o clics
            hacia WhatsApp), así como la dirección IP y el user-agent del navegador
            con propósitos de seguridad (control de tasa de peticiones y rate limiting)
            y analítica agregada para el comercio, aun cuando el visitante no realice un
            pedido ni proporcione sus datos de contacto.
          </p>

          <h3>2.3 Clientes y realización de pedidos</h3>
          <p>
            Al solicitar un pedido mediante el catálogo o al crear una cuenta opcional
            de cliente, se recopilan los datos ingresados voluntariamente en el formulario:
          </p>
          <ul>
            <li>Nombre completo del destinatario.</li>
            <li>Número de teléfono (para coordinación del pedido mediante WhatsApp).</li>
            <li>Ciudad, zona o dirección de entrega (en caso de entrega por delivery).</li>
            <li>Correo electrónico (opcional, o al registrar una cuenta de cliente).</li>
            <li>Notas o indicaciones especiales sobre el pedido.</li>
          </ul>

          <h3>2.4 Pedidos y seguimiento</h3>
          <p>
            Los detalles de cada pedido (productos seleccionados, cantidades, precios
            unitarios, estado y datos de entrega) se registran en la base de datos de la
            tienda para permitir la gestión de ventas y la consulta mediante el código de
            seguimiento público.
          </p>

          <h3>2.5 Restablecimiento de contraseña</h3>
          <p>
            En caso de solicitar restablecimiento de contraseña para administradores o
            clientes, se genera un token temporal de un solo uso que caduca
            automáticamente a los 30 minutos.
          </p>
        </section>

        <section>
          <h2>3. Eventos y analítica propia</h2>
          <p>
            La plataforma registra eventos de uso esenciales para el funcionamiento de
            la tienda y la prevención de fraudes o saturación del servicio. Esta
            analítica es estrictamente interna y propia del sistema; no se comparten
            registros de navegación con plataformas publicitarias de terceros ni redes
            sociales.
          </p>
        </section>

        <section>
          <h2>4. Cookies y almacenamiento en el navegador</h2>
          <p>
            Esta aplicación no utiliza cookies de rastreo publicitario ni píxeles de
            terceros. Emplea las capacidades de almacenamiento local del navegador
            (<strong>localStorage</strong>) para el funcionamiento técnico:
          </p>
          <ul>
            <li>
              <strong>Carrito de compras:</strong> Los productos agregados al carrito
              se guardan en <code>localStorage</code> para que tu selección no se
              pierda si recargas la página o navegas entre productos. Estos datos
              permanecen en el navegador y no se eliminan necesariamente al cerrar la
              ventana, salvo que vacíes el carrito o limpies los datos de tu navegador.
            </li>
            <li>
              <strong>Sesión de cliente o administrador:</strong> Si inicias sesión, el
              token JWT de autenticación se guarda localmente en el navegador para
              mantener tu sesión activa.
            </li>
          </ul>
        </section>

        <section>
          <h2>5. Proveedores de infraestructura</h2>
          <p>
            Para la provisión técnica del servicio, se emplean los siguientes proveedores de infraestructura:
          </p>
          <ul>
            <li>
              <strong>Alojamiento y entrega frontend:</strong> {LEGAL_CONFIG.frontendHostingProvider} (alojamiento y distribución global de la aplicación web del catálogo y del panel administrativo).
            </li>
            <li>
              <strong>Ejecución y procesamiento backend:</strong> {LEGAL_CONFIG.backendHostingProvider} (ejecución de los servicios de la API y lógica del servidor).
            </li>
            <li>
              <strong>Base de datos relacional:</strong> {LEGAL_CONFIG.databaseProvider} (almacenamiento de usuarios, tiendas, pedidos, eventos y registros de auditoría).
            </li>
            <li>
              <strong>Almacenamiento de imágenes:</strong> {LEGAL_CONFIG.storageProvider} (almacenamiento y entrega de archivos multimedia de productos y tiendas).
            </li>
            <li>
              <strong>Servicio de correo electrónico (SMTP):</strong> Únicamente en caso de estar configurado en el servidor para el envío de enlaces de recuperación de contraseña.
            </li>
          </ul>
        </section>

        <section>
          <h2>6. Conservación de datos y políticas de eliminación</h2>
          <p>
            Los datos se conservan en la base de datos de la tienda mientras esta
            permanezca activa o según los requerimientos operativos y comerciales del
            comercio:
          </p>
          <ul>
            <li>
              <strong>Pedidos y datos de clientes:</strong> {LEGAL_CONFIG.retentionOrders}.
            </li>
            <li>
              <strong>Eventos de analítica y registros de acceso:</strong>{" "}
              {LEGAL_CONFIG.retentionEvents}.
            </li>
            <li>
              <strong>Tokens de recuperación:</strong> {LEGAL_CONFIG.retentionPasswordReset}.
            </li>
          </ul>
          <p>
            <em>Nota sobre depuración técnica:</em> Actualmente no existe un mecanismo
            de eliminación o purga automática programada en base de datos tras 90 días o
            1-3 años. Los plazos de retención y políticas de archivado automático se
            encuentran pendientes de definición formal y desarrollo técnico.
          </p>
        </section>

        <section>
          <h2>7. Medidas de seguridad y tratamiento de imágenes</h2>
          <p>
            La plataforma implementa medidas técnicas de seguridad razonables para
            proteger la información:
          </p>
          <ul>
            <li>Almacenamiento de contraseñas con hash seguro e irreversible (bcrypt).</li>
            <li>Autenticación basada en tokens JWT con tiempo de expiración.</li>
            <li>Comunicaciones protegidas mediante cifrado HTTPS en tránsito.</li>
            <li>Límites de frecuencia de peticiones (rate limiting) para prevenir abusos.</li>
            <li>Cabeceras estándar de protección del servidor HTTP (X-Frame-Options, X-Content-Type-Options).</li>
            <li>
              <strong>Tratamiento de imágenes:</strong> Se eliminan de manera automatizada los metadatos EXIF (que pueden incluir coordenadas GPS o datos del dispositivo) antes del almacenamiento. Sin embargo, el contenido visual de la imagen continúa siendo responsabilidad de quien la publica, y una fotografía puede contener personas u otra información visible.
            </li>
          </ul>
        </section>

        <section>
          <h2>8. Ejercicio de derechos</h2>
          <p>
            De conformidad con la normativa de protección de datos aplicable, los titulares
            de los datos pueden solicitar en cualquier momento el acceso, rectificación,
            actualización o supresión de sus datos personales comunicándose al correo de
            contacto: <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
          </p>
        </section>

        <section>
          <h2>9. Actualizaciones de esta política</h2>
          <p>
            Esta política podrá ser actualizada periódicamente para reflejar mejoras
            técnicas o cambios legislativos. La fecha de la última actualización se indicará
            siempre en el encabezado y pie del documento.
          </p>
        </section>

        <footer className="legal-footer">
          <p>
            Última actualización: {privacyEffectiveDate} ·{" "}
            <a
              href={termsUrl}
              onClick={(e) => {
                if (onNavigate) {
                  e.preventDefault();
                  onNavigate("terms");
                }
              }}
            >
              Términos de uso
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
