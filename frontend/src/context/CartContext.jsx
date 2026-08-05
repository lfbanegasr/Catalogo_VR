import { createContext, useContext, useEffect, useState } from "react";

const CartContext = createContext();

function getCartKey(item) {
  return item.cart_key || String(item.id) + "::" + (item.id_variante || "simple");
}

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState(() => {
    try {
      const savedCart = JSON.parse(localStorage.getItem("tienda_cart") || "[]");
      return Array.isArray(savedCart)
        ? savedCart.map((item) => ({ ...item, cart_key: getCartKey(item) }))
        : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("tienda_cart", JSON.stringify(cartItems));
  }, [cartItems]);

  const addToCart = (product, quantityToAdd = 1) => {
    setCartItems((prevItems) => {
      const productId = product.id || product.id_producto;
      const variantId = product.id_variante || null;
      const cartKey = String(productId) + "::" + (variantId || "simple");
      const stock = product.stock == null ? null : Number(product.stock);
      const safeQuantity = stock == null
        ? Math.max(1, quantityToAdd)
        : Math.min(Math.max(1, quantityToAdd), Math.max(0, stock));
      if (safeQuantity <= 0) return prevItems;

      const existingItem = prevItems.find((item) => getCartKey(item) === cartKey);
      if (existingItem) {
        return prevItems.map((item) =>
          getCartKey(item) === cartKey
            ? {
                ...item,
                cantidad: stock == null
                  ? item.cantidad + safeQuantity
                  : Math.min(item.cantidad + safeQuantity, stock),
                stock,
              }
            : item
        );
      }

      return [
        ...prevItems,
        {
          id: productId,
          cart_key: cartKey,
          id_variante: variantId,
          nombre_variante: product.nombre_variante || "",
          nombre: product.nombre,
          precio: product.precio_final ?? product.precio ?? product.precio_venta,
          imagen_url: product.imagen_url,
          stock,
          cantidad: safeQuantity,
        },
      ];
    });
  };

  const removeFromCart = (cartKey) => {
    setCartItems((prevItems) => prevItems.filter((item) => getCartKey(item) !== cartKey));
  };

  const updateQuantity = (cartKey, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(cartKey);
      return;
    }
    setCartItems((prevItems) =>
      prevItems.map((item) =>
        getCartKey(item) === cartKey
          ? {
              ...item,
              cantidad: item.stock == null
                ? newQuantity
                : Math.min(newQuantity, Math.max(0, Number(item.stock))),
            }
          : item
      )
    );
  };

  const clearCart = () => setCartItems([]);
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

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart debe ser usado dentro de un CartProvider");
  }
  return context;
}
