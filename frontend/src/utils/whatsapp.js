/**
 * Formatea y genera un enlace de redirección de WhatsApp para enviar un pedido.
 * 
 * @param {string} whatsappNumber - El número de teléfono de WhatsApp de la tienda (en formato internacional, ej: "59170000000").
 * @param {Array<{nombre: string, cantidad: number, precio: number}>} cartItems - Lista de productos en el carrito.
 * @returns {string} La URL de redirección de WhatsApp codificada.
 */
export function generateWhatsappOrderLink(whatsappNumber, cartItems) {
  if (!whatsappNumber) {
    console.error("No se ha configurado un número de WhatsApp para esta tienda.");
    return "";
  }

  // Limpiar el número de teléfono (dejar solo dígitos)
  const cleanPhone = String(whatsappNumber).replace(/\D/g, "");

  if (cartItems.length === 0) {
    return "";
  }

  // Cabecera del mensaje
  let message = "*¡Hola! Quisiera realizar el siguiente pedido:*\n\n";

  let total = 0;

  // Detalle de cada producto
  cartItems.forEach((item) => {
    const subtotal = item.precio * item.cantidad;
    total += subtotal;

    message += `• *${item.cantidad}x* ${item.nombre} (_${item.precio.toFixed(2)} Bs._) -> *${subtotal.toFixed(2)} Bs.*\n`;
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
 */
export function redirectToWhatsappOrder(whatsappNumber, cartItems) {
  const url = generateWhatsappOrderLink(whatsappNumber, cartItems);
  if (url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
