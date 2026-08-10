import { useEffect, useMemo, useRef, useState } from "react";
import { getPublicCatalog, registerPublicEvent, registerPublicWhatsappClick } from "./api/api";
import CatalogPage from "./pages/CatalogPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import OrderTrackingPage from "./pages/OrderTrackingPage";
import { ThemeProvider } from "./theme/theme";
import { useCart } from "./context/CartContext";
import { CurrencyProvider } from "./context/CurrencyContext";
import CartDrawer from "./components/CartDrawer";
const REFRESH_INTERVAL_MS = 30000;

function getStoreSlug() {
  const params = new URLSearchParams(window.location.search);
  return params.get("slug") || import.meta.env.VITE_DEFAULT_STORE_SLUG || "demo-accesorios";
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
    tienda: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const returnProductIdRef = useRef("");
  const [requestedProductId, setRequestedProductId] = useState("");
  const [trackingCode, setTrackingCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("pedido") || "";
  });

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
    registerPublicEvent(storeSlug, "catalog_view");
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

  const relatedProducts = useMemo(() => {
    if (!selectedProductFull) return [];
    const categoryId = selectedProductFull.categoria_id;
    const sameCategory = catalog.products.filter(
      (product) => String(product.categoria_id ?? "") === String(categoryId ?? ""),
    );
    return sameCategory.length > 1 ? sameCategory : catalog.products;
  }, [catalog.products, selectedProductFull]);

  const selectedRelatedIndex = useMemo(
    () => relatedProducts.findIndex(
      (product) => String(product.id) === String(selectedProductFull?.id),
    ),
    [relatedProducts, selectedProductFull],
  );

  const previousProduct = selectedRelatedIndex > 0
    ? relatedProducts[selectedRelatedIndex - 1]
    : null;
  const nextProduct = selectedRelatedIndex >= 0 && selectedRelatedIndex < relatedProducts.length - 1
    ? relatedProducts[selectedRelatedIndex + 1]
    : null;

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
    returnProductIdRef.current = String(product?.id || "");
    setSelectedProduct(product);
    window.history.replaceState({}, "", buildProductLink(product?.id));
    window.scrollTo({ top: 0, behavior: "instant" });
    registerPublicEvent(storeSlug, "product_view", product?.id);
  };

  const closeProduct = () => {
    const productId = String(selectedProductFull?.id || returnProductIdRef.current || "");
    returnProductIdRef.current = productId;
    setSelectedProduct(null);
    window.history.replaceState({}, "", buildProductLink(null));
  };

  const navigateProduct = (product) => {
    if (!product) return;
    returnProductIdRef.current = String(product.id);
    setSelectedProduct(product);
    window.history.replaceState({}, "", buildProductLink(product.id));
    window.scrollTo({ top: 0, behavior: "smooth" });
    registerPublicEvent(storeSlug, "product_view", product.id);
  };

  useEffect(() => {
    if (selectedProduct || !returnProductIdRef.current) return undefined;
    const productId = returnProductIdRef.current;
    const frameId = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const cards = document.querySelectorAll("[data-product-id]");
        const target = Array.from(cards).reverse().find(
          (card) => card.dataset.productId === productId,
        );
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [selectedProduct]);

  const openTracking = (code) => {
    const normalized = String(code || "").trim().toUpperCase();
    if (!normalized) return;
    const url = new URL(window.location.href);
    url.searchParams.set("slug", storeSlug);
    url.searchParams.delete("p");
    url.searchParams.set("pedido", normalized);
    window.history.replaceState({}, "", url.toString());
    setSelectedProduct(null);
    setTrackingCode(normalized);
  };

  const closeTracking = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("pedido");
    window.history.replaceState({}, "", url.toString());
    setTrackingCode("");
  };

  return (
    <ThemeProvider theme={catalog.theme}>
      <CurrencyProvider value={catalog.tienda?.currency_symbol}>
        {trackingCode ? (
          <OrderTrackingPage
            slug={storeSlug}
            trackingCode={trackingCode}
            onBack={closeTracking}
          />
        ) : selectedProductFull ? (
          <ProductDetailPage
            product={selectedProductFull}
            slug={storeSlug}
            storeName={catalog.storeName}
            whatsappNumber={catalog.whatsappNumber}
            productUrl={buildProductLink(selectedProductFull?.id)}
            onWhatsappClick={async (idProducto) => registerPublicWhatsappClick(storeSlug, idProducto)}
            onBack={closeProduct}
            previousProduct={previousProduct}
            nextProduct={nextProduct}
            onPreviousProduct={() => navigateProduct(previousProduct)}
            onNextProduct={() => navigateProduct(nextProduct)}
          />
        ) : (
          <CatalogPage
            slug={storeSlug}
            storeName={catalog.storeName}
            whatsappNumber={catalog.whatsappNumber}
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

        {/* Botón "Seguir pedido" ocultado — solo disponible via URL ?pedido=XXX */}
        
        {/* Botón flotante del carrito */}
        {cartCount > 0 && !isCartOpen && !trackingCode && (
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
      </CurrencyProvider>
    </ThemeProvider>
  );
}

export default App;
