/**
 * Formatea y genera un enlace de redirección de WhatsApp para enviar un pedido.
 * 
 * @param {string} whatsappNumber - El número de teléfono de WhatsApp de la tienda (en formato internacional, ej: "59170000000").
 * @param {Array<{id: string, nombre: string, cantidad: number, precio: number}>} cartItems - Lista de productos en el carrito.
 * @param {string} ticketNum - El número abreviado de ticket de la venta.
 * @param {string} slug - El slug de la tienda.
 * @returns {string} La URL de redirección de WhatsApp codificada.
 */
export function generateWhatsappOrderLink(
  whatsappNumber,
  cartItems,
  ticketNum = "",
  slug = "",
  trackingCode = "",
  checkoutInfo = null
) {
  if (!whatsappNumber) {
    console.error("No se ha configurado un número de WhatsApp para esta tienda.");
    return "";
  }

  // Limpiar el número de teléfono (dejar solo dígitos)
  let cleanPhone = String(whatsappNumber).replace(/\D/g, "");
  if (cleanPhone.length === 8) {
    cleanPhone = "591" + cleanPhone;
  }

  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return "";
  }

  // Cabecera del mensaje con ticket si existe
  const ticketStr = ticketNum ? ` (Ticket: #${ticketNum})` : "";
  let message = `*¡Hola! Quisiera realizar el siguiente pedido${ticketStr}:*\n\n`;

  let total = 0;
  const origin = window.location.origin || "http://localhost:5174";
  const path = window.location.pathname || "/";

  // Detalle de cada producto con su enlace recortado
  cartItems.forEach((item) => {
    const qty = Math.max(1, Number(item.cantidad) || 1);
    const price = Number(item.precio) || 0;
    const subtotal = price * qty;
    total += subtotal;

    let itemDisplayName = item.nombre || "Producto";
    if (item.nombre_variante && !itemDisplayName.includes(item.nombre_variante)) {
      itemDisplayName += ` - ${item.nombre_variante}`;
    }

    message += `• *${qty}x* ${itemDisplayName} (_${price.toFixed(2)} Bs._) -> *${subtotal.toFixed(2)} Bs.*\n`;
    const cleanId = String(item.id_producto || item.id || "").split(":")[0].trim();
    if (slug && cleanId) {
      message += `   👉 ${origin}${path}?slug=${slug}&p=${cleanId}\n`;
    }
  });

  // Total
  message += `\n*Total a pagar: ${total.toFixed(2)} Bs.*`;

  // Datos del comprador / entrega
  if (checkoutInfo) {
    message += "\n\n📋 *Datos para la entrega:*";
    if (checkoutInfo.nombre_completo) {
      message += `\n• *Cliente:* ${checkoutInfo.nombre_completo.trim()}`;
    }
    if (checkoutInfo.telefono) {
      message += `\n• *Teléfono:* ${checkoutInfo.telefono.trim()}`;
    }
    if (checkoutInfo.metodo_entrega === "delivery") {
      message += "\n• *Modalidad:* 🛵 Delivery a domicilio";
      const parts = [
        checkoutInfo.linea1,
        checkoutInfo.ciudad,
        checkoutInfo.region,
        checkoutInfo.referencia ? `(Ref: ${checkoutInfo.referencia})` : null,
      ].filter(Boolean);
      if (parts.length > 0) {
        message += `\n• *Dirección:* ${parts.join(", ").trim()}`;
      }
    } else {
      message += "\n• *Modalidad:* 🏬 Retiro en tienda";
    }
    if (checkoutInfo.metodo_pago) {
      const pagoLabels = {
        acordar: "A coordinar por WhatsApp",
        efectivo: "Efectivo",
        transferencia: "Transferencia bancaria / QR",
      };
      message += `\n• *Forma de pago:* ${pagoLabels[checkoutInfo.metodo_pago] || checkoutInfo.metodo_pago}`;
    }
    if (checkoutInfo.notas_cliente) {
      message += `\n• *Nota:* ${checkoutInfo.notas_cliente.trim()}`;
    }
  }

  if (slug && trackingCode) {
    message += `\n\n🔎 *Seguimiento:* ${origin}${path}?slug=${slug}&pedido=${trackingCode}`;
  }
  message += "\n\nMuchas gracias. ¿Me confirman la recepción del pedido?";

  // Codificar el mensaje para URL
  const encodedText = encodeURIComponent(message);

  // Retornar el enlace directo a la API de WhatsApp
  return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
}

/**
 * Redirige al cliente a WhatsApp abriendo una nueva pestaña.
 */
export function redirectToWhatsappOrder(
  whatsappNumber,
  cartItems,
  ticketNum = "",
  slug = "",
  trackingCode = "",
  checkoutInfo = null
) {
  const url = generateWhatsappOrderLink(
    whatsappNumber,
    cartItems,
    ticketNum,
    slug,
    trackingCode,
    checkoutInfo
  );
  if (url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
