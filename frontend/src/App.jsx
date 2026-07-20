import { useEffect, useMemo, useState } from "react";
import { getPublicCatalog, registerPublicWhatsappClick } from "./api/api";
import CatalogPage from "./pages/CatalogPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import { ThemeProvider } from "./theme/theme";
import { useCart } from "./context/CartContext";
import CartDrawer from "./components/CartDrawer";
const REFRESH_INTERVAL_MS = 8000;

function getStoreSlug() {
  const params = new URLSearchParams(window.location.search);
  return params.get("slug") || "tienda-demo";
}

function App() {
  const storeSlug = useMemo(() => getStoreSlug(), []);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { cartCount } = useCart();
  const [catalog, setCatalog] = useState({
    storeName: "",
    whatsappNumber: null,
    categories: [],
    products: [],
    offers: [],
    theme: undefined,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [requestedProductId, setRequestedProductId] = useState("");

  const buildProductLink = (productId) => {
    const url = new URL(window.location.href);
    url.searchParams.set("slug", storeSlug);
    if (productId) {
      url.searchParams.set("p", String(productId));
    } else {
      url.searchParams.delete("p");
    }
    return url.toString();
  };

  const loadCatalog = async ({ silent = false, resetCategory = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const data = await getPublicCatalog(storeSlug);
      setCatalog(data);
      if (resetCategory) {
        setSelectedCategoryId("all");
      }
    } catch (err) {
      if (!silent) {
        setError(err.message || "No se pudo cargar el catalogo.");
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadCatalog({ silent: false, resetCategory: true });
  }, [storeSlug]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("slug");
    const productId = params.get("p");
    if (slug && slug !== storeSlug) return;
    if (productId) {
      setRequestedProductId(productId);
    }
  }, [storeSlug]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadCatalog({ silent: true, resetCategory: false });
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [storeSlug]);

  const selectedProductFull = useMemo(() => {
    if (!selectedProduct) return null;
    return (
      catalog.products.find(
        (product) => String(product.id) === String(selectedProduct.id)
      ) || selectedProduct
    );
  }, [catalog.products, selectedProduct]);

  useEffect(() => {
    if (!requestedProductId || selectedProduct) return;
    const target = catalog.products.find(
      (product) => String(product.id) === String(requestedProductId),
    );
    if (target) {
      setSelectedProduct(target);
      setRequestedProductId("");
    }
  }, [catalog.products, requestedProductId, selectedProduct]);

  const openProduct = (product) => {
    setSelectedProduct(product);
    window.history.replaceState({}, "", buildProductLink(product?.id));
  };

  const closeProduct = () => {
    setSelectedProduct(null);
    window.history.replaceState({}, "", buildProductLink(null));
  };

  return (
    <ThemeProvider theme={catalog.theme}>
      {selectedProductFull ? (
        <ProductDetailPage
          product={selectedProductFull}
          slug={storeSlug}
          storeName={catalog.storeName}
          whatsappNumber={catalog.whatsappNumber}
          productUrl={buildProductLink(selectedProductFull?.id)}
          onWhatsappClick={async (idProducto) => registerPublicWhatsappClick(storeSlug, idProducto)}
          onBack={closeProduct}
        />
      ) : (
        <CatalogPage
          slug={storeSlug}
          storeName={catalog.storeName}
          categories={catalog.categories}
          products={catalog.products}
          offers={catalog.offers}
          theme={catalog.theme}
          loading={loading}
          error={error}
          selectedCategoryId={selectedCategoryId}
          onSelectCategoryId={setSelectedCategoryId}
          onViewDetail={openProduct}
          onRetry={loadCatalog}
        />
      )}
      
      {/* Botón flotante del carrito */}
      {cartCount > 0 && !isCartOpen && (
        <button
          onClick={() => setIsCartOpen(true)}
          className="cart-floating-btn"
          title="Ver Pedido"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: "24px", height: "24px" }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          <span className="cart-floating-badge">
            {cartCount}
          </span>
        </button>
      )}

      {/* Drawer del carrito */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        whatsappNumber={catalog.whatsappNumber}
        slug={storeSlug}
      />
    </ThemeProvider>
  );
}

export default App;
