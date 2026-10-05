import LEGAL_CONFIG from "../utils/legalConfig";

/**
 * TermsPage
 *
 * Página pública de términos y condiciones de uso del catálogo virtual.
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
      <strong>Aviso importante:</strong> Este documento contiene información pendiente de definición por el operador de la plataforma. Antes de presentarse como términos definitivos, deben configurarse las variables <code>VITE_LEGAL_OPERATOR_NAME</code> y <code>VITE_LEGAL_CONTACT_EMAIL</code> con datos reales y ser revisado por un asesor legal.
    </div>
  );
}

export default function TermsPage({ onBack, onNavigate, slug }) {
  const { operatorName, country, contactEmail, termsEffectiveDate, termsVersion } =
    LEGAL_CONFIG;

  const privacyUrl = slug ? `?slug=${encodeURIComponent(slug)}&page=privacy` : "?page=privacy";

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
          <h1>Términos de Uso</h1>
          <p className="legal-meta">
            Versión {termsVersion} · Vigente desde {termsEffectiveDate}
          </p>
        </header>

        <section>
          <h2>1. Descripción del servicio</h2>
          <p>
            Esta plataforma ofrece un catálogo virtual multi-tienda que permite a
            los comercios exhibir sus productos, recibir pedidos estructurados y
            establecer contacto con sus clientes a través de WhatsApp. El servicio es
            operado por <strong>{operatorName}</strong> ({country}).
          </p>
        </section>

        <section>
          <h2>2. Registro de pedidos y canal de WhatsApp</h2>
          <p>
            Al solicitar un pedido mediante el carrito de compras del catálogo:
          </p>
          <ul>
            <li>
              <strong>Registro interno del pedido:</strong> La plataforma registra
              previamente la solicitud en la base de datos de la tienda, asignándole
              un identificador de venta y un código de seguimiento público.
            </li>
            <li>
              <strong>Redirección a WhatsApp:</strong> Una vez registrada la orden, la
              plataforma genera un enlace que abre la aplicación WhatsApp con el
              resumen del pedido listo para ser enviado al número del comercio.
            </li>
            <li>
              <strong>Concreción de la compra:</strong> El registro en el catálogo no
              garantiza por sí solo la reserva de inventario ni el procesamiento de un
              pago en línea. El acuerdo final de pago, facturación y entrega se
              perfecciona directamente entre el comprador y el vendedor a través de
              WhatsApp o el canal acordado.
            </li>
          </ul>
        </section>

        <section>
          <h2>3. Uso del catálogo público</h2>
          <p>
            Cualquier visitante puede navegar el catálogo sin necesidad de registrarse.
            Al ingresar información de contacto en el proceso de pedido, el usuario
            garantiza que los datos proporcionados son veraces y necesarios para la
            coordinación de la compra.
          </p>
          <p>Queda expresamente prohibido:</p>
          <ul>
            <li>Utilizar el catálogo para comercializar productos ilícitos.</li>
            <li>Intentar vulnerar el aislamiento multi-tenant o acceder a datos de otras tiendas.</li>
            <li>Realizar peticiones automatizadas masivas que degraden la disponibilidad del servicio.</li>
            <li>Suplantar la identidad de administradores o tiendas registradas.</li>
          </ul>
        </section>

        <section>
          <h2>4. Cuentas de tienda y responsabilidad de contenidos</h2>
          <p>
            Cada comercio es responsable de mantener la seguridad y confidencialidad
            de sus credenciales de acceso administrativo. Los datos, productos,
            imágenes y pedidos de cada tienda se encuentran estrictamente aislados de
            los demás tenants.
          </p>
          <p>
            El comercio es el único responsable de la exactitud de los precios,
            descripciones, disponibilidad de stock y derechos de uso sobre las imágenes
            publicadas en su catálogo.
          </p>
        </section>

        <section>
          <h2>5. Disponibilidad del servicio y limitación de responsabilidad</h2>
          <p>
            La plataforma se proporciona bajo la modalidad "tal cual", sin garantías de
            disponibilidad ininterrumpida. Podrán realizarse pausas por mantenimiento,
            actualizaciones de software o fallos de infraestructura en la nube ajenos a
            nuestro control directo.
          </p>
          <p>
            El operador de la plataforma no interviene en las transacciones económicas
            ni en los contratos de compraventa celebrados entre comerciantes y sus
            clientes finales.
          </p>
        </section>

        <section>
          <h2>6. Privacidad y tratamiento de datos</h2>
          <p>
            El tratamiento de datos personales y registros de navegación se describe
            en detalle en nuestra{" "}
            <a
              href={privacyUrl}
              onClick={(e) => {
                if (onNavigate) {
                  e.preventDefault();
                  onNavigate("privacy");
                }
              }}
            >
              Política de Privacidad
            </a>.
          </p>
        </section>

        <section>
          <h2>7. Modificaciones</h2>
          <p>
            Nos reservamos el derecho de modificar estos términos de uso. Las nuevas
            versiones serán publicadas en esta misma dirección indicando su fecha de
            entrada en vigor.
          </p>
        </section>

        <section>
          <h2>8. Contacto</h2>
          <p>
            Para consultas relacionadas con estos términos, comunícate a:{" "}
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
          </p>
        </section>

        <footer className="legal-footer">
          <p>
            Última actualización: {termsEffectiveDate} ·{" "}
            <a
              href={privacyUrl}
              onClick={(e) => {
                if (onNavigate) {
                  e.preventDefault();
                  onNavigate("privacy");
                }
              }}
            >
              Política de Privacidad
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
