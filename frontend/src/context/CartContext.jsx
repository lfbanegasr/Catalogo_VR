import { createContext, useContext, useState, useEffect } from "react";

const CartContext = createContext();

/**
 * Proveedor del Carrito de Compras (Context API).
 * Gestiona los productos agregados, cantidades y persistencia en localStorage.
 */
export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState(() => {
    // Inicializar el carrito desde localStorage si existe
    const savedCart = localStorage.getItem("tienda_cart");
    return savedCart ? JSON.parse(savedCart) : [];
  });

  // Guardar en localStorage cada vez que el carrito cambie
  useEffect(() => {
    localStorage.setItem("tienda_cart", JSON.stringify(cartItems));
  }, [cartItems]);

  const addToCart = (product) => {
    setCartItems((prevItems) => {
      const existingItem = prevItems.find((item) => item.id === product.id);
      if (existingItem) {
        // Si ya existe, incrementar la cantidad
        return prevItems.map((item) =>
          item.id === product.id ? { ...item, cantidad: item.cantidad + 1 } : item
        );
      }
      // Si es nuevo, añadirlo con cantidad 1
      return [
        ...prevItems,
        {
          id: product.id,
          nombre: product.nombre,
          precio: product.precio_final || product.precio,
          imagen_url: product.imagen_url,
          cantidad: 1,
        },
      ];
    });
  };

  const removeFromCart = (productId) => {
    setCartItems((prevItems) => prevItems.filter((item) => item.id !== productId));
  };

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCartItems((prevItems) =>
      prevItems.map((item) =>
        item.id === productId ? { ...item, cantidad: newQuantity } : item
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  // Valores calculados
  const cartTotal = cartItems.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
  const cartCount = cartItems.reduce((sum, item) => sum + item.cantidad, 0);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartTotal,
        cartCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

/**
 * Hook personalizado para consumir el estado del carrito de compras.
 */
export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart debe ser usado dentro de un CartProvider");
  }
  return context;
}
