import { useCart } from "../context/CartContext";
import { redirectToWhatsappOrder } from "../utils/whatsapp";

function formatPrice(value) {
  return new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
    minimumFractionDigits: 2,
  })
    .format(Number(value || 0))
    .replace("BOB", "Bs.");
}

export function CartDrawer({ isOpen, onClose, whatsappNumber }) {
  const { cartItems, updateQuantity, removeFromCart, cartTotal, clearCart } = useCart();

  if (!isOpen) return null;

  const handleCheckout = () => {
    if (cartItems.length === 0) return;
    // Redireccionar al WhatsApp de la tienda con el pedido estructurado
    redirectToWhatsappOrder(whatsappNumber || "59170000000", cartItems);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex justify-end">
      {/* Backdrop click */}
      <div className="absolute inset-0" onClick={onClose}></div>

      {/* Drawer Panel */}
      <div className="relative w-full max-w-[380px] h-full bg-white shadow-2xl flex flex-col animate-slide-left z-10 rounded-l-[1.5rem]">
        {/* Header */}
        <header className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <h2 className="text-base font-extrabold text-gray-800">Mi Pedido</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 transition">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </header>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 stroke-current" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <p className="mt-3 text-xs font-semibold">El carrito está vacío</p>
              <p className="text-[10px] mt-1">Agrega productos para realizar tu pedido.</p>
            </div>
          ) : (
            cartItems.map((item) => (
              <div key={item.id} className="flex gap-3 pb-3 border-b border-gray-100 items-center justify-between">
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-gray-800 line-clamp-1">{item.nombre}</h4>
                  <p className="text-[10px] text-pink-600 font-bold mt-1">{formatPrice(item.precio)}</p>
                </div>

                {/* Controles de cantidad */}
                <div className="flex items-center border border-gray-200 rounded-xl px-1 py-0.5 bg-gray-50">
                  <button
                    onClick={() => updateQuantity(item.id, item.cantidad - 1)}
                    className="h-6 w-6 flex items-center justify-center text-gray-500 font-bold hover:bg-gray-100 rounded-lg transition"
                  >
                    -
                  </button>
                  <span className="w-7 text-center text-xs font-bold text-gray-800">{item.cantidad}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.cantidad + 1)}
                    className="h-6 w-6 flex items-center justify-center text-gray-500 font-bold hover:bg-gray-100 rounded-lg transition"
                  >
                    +
                  </button>
                </div>

                {/* Botón de eliminar */}
                <button
                  onClick={() => removeFromCart(item.id)}
                  className="p-1 text-gray-400 hover:text-red-500 transition"
                  title="Eliminar producto"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cartItems.length > 0 && (
          <footer className="p-5 border-t border-gray-100 bg-gray-50 rounded-l-[1.5rem] space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-gray-500">Subtotal del pedido</span>
              <span className="font-black text-gray-800">{formatPrice(cartTotal)}</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={clearCart}
                className="px-3.5 py-3 bg-white text-gray-500 hover:text-red-500 border border-gray-200 rounded-xl text-xs font-bold transition flex items-center justify-center"
                title="Vaciar Carrito"
              >
                Vaciar
              </button>
              <button
                onClick={handleCheckout}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold uppercase tracking-wide flex items-center justify-center gap-2 shadow-md transition"
              >
                {/* Ícono de whatsapp simple */}
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.458L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.97-1.863-1.868-4.343-2.898-6.977-2.9-5.437 0-9.863 4.37-9.866 9.8-.001 1.762.483 3.486 1.4 5.013l-.997 3.645 3.736-.975zM17.487 14.39c-.3-.15-1.774-.875-2.049-.974-.276-.1-.477-.15-.677.15-.2.3-.777.974-.951 1.174-.175.2-.35.225-.65.075-.3-.15-1.265-.467-2.41-1.487-.89-.794-1.49-1.775-1.665-2.075-.175-.3-.019-.462.13-.611.135-.135.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.677-1.625-.926-2.225-.244-.589-.492-.51-.677-.52l-.577-.01c-.2 0-.525.075-.8.375-.276.3-1.05 1.025-1.05 2.5s1.075 2.9 1.225 3.1c.15.2 2.11 3.224 5.115 4.525.715.31 1.273.495 1.71.635.717.228 1.37.196 1.885.12.574-.085 1.774-.725 2.024-1.425.25-.7.25-1.3.175-1.425-.076-.125-.276-.2-.576-.35z"/>
                </svg>
                Enviar a WhatsApp
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

export default CartDrawer;
