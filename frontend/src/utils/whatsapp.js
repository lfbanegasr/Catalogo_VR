/**
 * Formatea y genera un enlace de redirección de WhatsApp para enviar un pedido.
 * 
 * @param {string} whatsappNumber - El número de teléfono de WhatsApp de la tienda (en formato internacional, ej: "59170000000").
 * @param {Array<{id: string, nombre: string, cantidad: number, precio: number}>} cartItems - Lista de productos en el carrito.
 * @param {string} ticketNum - El número abreviado de ticket de la venta.
 * @param {string} slug - El slug de la tienda.
 * @returns {string} La URL de redirección de WhatsApp codificada.
 */
export function generateWhatsappOrderLink(whatsappNumber, cartItems, ticketNum = "", slug = "") {
  if (!whatsappNumber) {
    console.error("No se ha configurado un número de WhatsApp para esta tienda.");
    return "";
  }

  // Limpiar el número de teléfono (dejar solo dígitos)
  const cleanPhone = String(whatsappNumber).replace(/\D/g, "");

  if (cartItems.length === 0) {
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
    const subtotal = item.precio * item.cantidad;
    total += subtotal;

    message += `• *${item.cantidad}x* ${item.nombre} (_${item.precio.toFixed(2)} Bs._) -> *${subtotal.toFixed(2)} Bs.*\n`;
    if (slug && item.id) {
      message += `   👉 ${origin}${path}?slug=${slug}&p=${item.id}\n`;
    }
  });

  // Total
  message += `\n*Total a pagar: ${total.toFixed(2)} Bs.*`;
  message += "\n\nMuchas gracias. ¿Me confirman el pedido y el método de pago?";

  // Codificar el mensaje para URL
  const encodedText = encodeURIComponent(message);

  // Retornar el enlace directo a la API de WhatsApp
  return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
}

/**
 * Redirige al cliente a WhatsApp abriendo una nueva pestaña.
 * 
 * @param {string} whatsappNumber - El número de teléfono de la tienda.
 * @param {Array} cartItems - Productos del carrito.
 * @param {string} ticketNum - El número abreviado de ticket de la venta.
 * @param {string} slug - El slug de la tienda.
 */
export function redirectToWhatsappOrder(whatsappNumber, cartItems, ticketNum = "", slug = "") {
  const url = generateWhatsappOrderLink(whatsappNumber, cartItems, ticketNum, slug);
  if (url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
