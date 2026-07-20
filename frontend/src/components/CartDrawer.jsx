import { useCart } from "../context/CartContext";
import { redirectToWhatsappOrder } from "../utils/whatsapp";
import axiosInstance from "../api/axiosConfig";

function formatPrice(value) {
  return new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
    minimumFractionDigits: 2,
  })
    .format(Number(value || 0))
    .replace("BOB", "Bs.");
}

export function CartDrawer({ isOpen, onClose, whatsappNumber, slug }) {
  const { cartItems, updateQuantity, removeFromCart, cartTotal, clearCart } = useCart();

  if (!isOpen) return null;

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;

    let ticketNum = "";
    try {
      // Formatear detalles de venta para el endpoint del backend
      const detalles = cartItems.map((item) => ({
        id_producto: item.id,
        cantidad: item.cantidad,
        precio_unitario: item.precio,
      }));

      // Registrar venta silenciosa en base de datos
      const res = await axiosInstance.post(`/public/catalog/${slug}/checkout`, {
        id_cliente: null,
        cliente_nuevo: null,
        estado: "generada_whatsapp",
        detalles: detalles,
      });
      if (res && res.data && res.data.id_venta) {
        ticketNum = String(res.data.id_venta).split("-")[0] || String(res.data.id_venta).substring(0, 8);
      }
    } catch (error) {
      console.error("Error al registrar la venta en la base de datos:", error);
      // Continuamos de todas formas para no perder la venta por WhatsApp
    }

    // Redireccionar al WhatsApp de la tienda con el ticket y el slug
    redirectToWhatsappOrder(whatsappNumber || "59170000000", cartItems, ticketNum, slug);
    clearCart();
    onClose();
  };

  return (
    <div className="cart-backdrop">
      <style>{`
        .cart-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          justify-content: flex-end;
        }
        .cart-backdrop-click {
          position: absolute;
          inset: 0;
          cursor: pointer;
        }
        .cart-panel {
          position: relative;
          width: 100%;
          max-width: 380px;
          height: 100%;
          background: var(--color-surface, #ffffff);
          box-shadow: -10px 0 30px rgba(0, 0, 0, 0.1);
          display: flex;
          flex-direction: column;
          border-radius: var(--radius-lg, 22px) 0 0 var(--radius-lg, 22px);
          animation: cart-slide-left 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          overflow: hidden;
          z-index: 1010;
        }
        @keyframes cart-slide-left {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .cart-header {
          padding: 20px;
          border-bottom: 1px solid var(--border-soft, rgba(0,0,0,0.08));
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #ffffff;
        }
        .cart-header-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 1rem;
          font-weight: 800;
          color: var(--color-text, #1f1f1f);
        }
        .cart-close-btn {
          background: none;
          border: none;
          padding: 6px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-muted, #6b7280);
          transition: background 0.15s, color 0.15s;
        }
        .cart-close-btn:hover {
          background: rgba(0, 0, 0, 0.05);
          color: var(--color-text, #1f1f1f);
        }
        .cart-items-container {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .cart-empty-state {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: var(--color-muted, #6b7280);
          padding: 40px 20px;
        }
        .cart-empty-title {
          margin-top: 12px;
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--color-text, #1f1f1f);
        }
        .cart-empty-subtitle {
          font-size: 0.75rem;
          margin-top: 4px;
        }
        .cart-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border-soft, rgba(0,0,0,0.05));
        }
        .cart-item-details {
          flex: 1;
          min-width: 0;
        }
        .cart-item-name {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--color-text, #1f1f1f);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .cart-item-price {
          font-size: 0.8rem;
          font-weight: 800;
          color: var(--color-primary, #e94b8a);
          margin: 4px 0 0 0;
        }
        .cart-qty-controls {
          display: flex;
          align-items: center;
          background: var(--color-background, #fff7fa);
          border-radius: var(--radius-base, 16px);
          border: 1px solid var(--border-soft, rgba(0,0,0,0.08));
          padding: 2px;
        }
        .cart-qty-btn {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          font-weight: 800;
          font-size: 0.85rem;
          color: var(--color-muted, #6b7280);
          transition: background 0.15s, color 0.15s;
        }
        .cart-qty-btn:hover {
          background: rgba(0, 0, 0, 0.05);
          color: var(--color-text, #1f1f1f);
        }
        .cart-qty-number {
          min-width: 28px;
          text-align: center;
          font-size: 0.8rem;
          font-weight: 800;
          color: var(--color-text, #1f1f1f);
        }
        .cart-delete-btn {
          background: none;
          border: none;
          color: var(--color-muted, #6b7280);
          padding: 6px;
          border-radius: 50%;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .cart-delete-btn:hover {
          background: #fee2e2;
          color: #ef4444;
        }
        .cart-footer {
          padding: 20px;
          border-top: 1px solid var(--border-soft, rgba(0,0,0,0.08));
          background: var(--color-background, #fff7fa);
          border-radius: var(--radius-lg, 22px) 0 0 0;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .cart-total-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.85rem;
        }
        .cart-total-row span {
          display: inline-block;
        }
        .cart-total-label {
          font-weight: 700;
          color: var(--color-muted, #6b7280);
        }
        .cart-total-value {
          font-size: 1.1rem;
          font-weight: 900;
          color: var(--color-text, #1f1f1f);
        }
        .cart-action-buttons {
          display: flex;
          gap: 10px;
        }
        .cart-clear-btn {
          padding: 12px 18px;
          background: #ffffff;
          border: 1px solid var(--border-soft, rgba(0,0,0,0.08));
          color: var(--color-muted, #6b7280);
          border-radius: var(--radius-base, 16px);
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .cart-clear-btn:hover {
          color: #ef4444;
          border-color: #fca5a5;
          background: #fef2f2;
        }
        .cart-checkout-btn {
          flex: 1;
          padding: 12px;
          background: var(--color-primary, #e94b8a);
          color: #ffffff;
          border: none;
          border-radius: var(--radius-base, 16px);
          font-size: 0.8rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 10px 22px rgba(233, 75, 138, 0.25);
        }
        .cart-checkout-btn:hover {
          transform: translateY(-1px);
          filter: brightness(0.95);
          box-shadow: 0 12px 24px rgba(233, 75, 138, 0.35);
        }
        .cart-icon-svg {
          width: 20px;
          height: 20px;
        }
      `}</style>
      {/* Backdrop click */}
      <div className="cart-backdrop-click" onClick={onClose}></div>

      {/* Drawer Panel */}
      <div className="cart-panel">
        {/* Header */}
        <header className="cart-header">
          <div className="cart-header-title">
            <svg xmlns="http://www.w3.org/2000/svg" className="cart-icon-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <span>Mi Pedido</span>
          </div>
          <button onClick={onClose} className="cart-close-btn">
            <svg xmlns="http://www.w3.org/2000/svg" className="cart-icon-svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </header>

        {/* Content list */}
        <div className="cart-items-container">
          {cartItems.length === 0 ? (
            <div className="cart-empty-state">
              <svg xmlns="http://www.w3.org/2000/svg" className="cart-icon-svg" style={{ width: '48px', height: '48px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <p className="cart-empty-title">El carrito está vacío</p>
              <p className="cart-empty-subtitle">Agrega productos para realizar tu pedido.</p>
            </div>
          ) : (
            cartItems.map((item) => (
              <div key={item.id} className="cart-item">
                <div className="cart-item-details">
                  <h4 className="cart-item-name">{item.nombre}</h4>
                  <p className="cart-item-price">{formatPrice(item.precio)}</p>
                </div>

                {/* Controles de cantidad */}
                <div className="cart-qty-controls">
                  <button
                    onClick={() => updateQuantity(item.id, item.cantidad - 1)}
                    className="cart-qty-btn"
                  >
                    -
                  </button>
                  <span className="cart-qty-number">{item.cantidad}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.cantidad + 1)}
                    className="cart-qty-btn"
                  >
                    +
                  </button>
                </div>

                {/* Botón de eliminar */}
                <button
                  onClick={() => removeFromCart(item.id)}
                  className="cart-delete-btn"
                  title="Eliminar producto"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="cart-icon-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cartItems.length > 0 && (
          <footer className="cart-footer">
            <div className="cart-total-row">
              <span className="cart-total-label">Subtotal del pedido</span>
              <span className="cart-total-value">{formatPrice(cartTotal)}</span>
            </div>

            <div className="cart-action-buttons">
              <button
                onClick={clearCart}
                className="cart-clear-btn"
                title="Vaciar Carrito"
              >
                Vaciar
              </button>
              <button
                onClick={handleCheckout}
                className="cart-checkout-btn"
              >
                <svg className="cart-icon-svg" style={{ fill: 'currentColor' }} viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.458L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.97-1.863-1.868-4.343-2.898-6.977-2.9-5.437 0-9.863 4.37-9.866 9.8-.001 1.762.483 3.486 1.4 5.013l-.997 3.645 3.736-.975zM17.487 14.39c-.3-.15-1.774-.875-2.049-.974-.276-.1-.477-.15-.677.15-.2.3-.777.974-.951 1.174-.175.2-.35.225-.65.075-.3-.15-1.265-.467-2.41-1.487-.89-.794-1.49-1.775-1.665-2.075-.175-.3-.019-.462.13-.611.135-.135.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.677-1.625-.926-2.225-.244-.589-.492-.51-.677-.52l-.577-.01c-.2 0-.525.075-.8.375-.276.3-1.05 1.025-1.05 2.5s1.075 2.9 1.225 3.1c.15.2 2.11 3.224 5.115 4.525.715.31 1.273.495 1.71.635.717.228 1.37.196 1.885.12.574-.085 1.774-.725 2.024-1.425.25-.7.25-1.3.175-1.425-.076-.125-.276-.2-.576-.35z"/>
                </svg>
                <span>Enviar a WhatsApp</span>
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

export default CartDrawer;
