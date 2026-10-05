import { useEffect, useMemo, useRef, useState } from "react";
import { getPublicCatalog, registerPublicEvent, registerPublicWhatsappClick } from "./api/api";
import CatalogPage from "./pages/CatalogPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import OrderTrackingPage from "./pages/OrderTrackingPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
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
  const [legalPage, setLegalPage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("page") || "";
  });

  const buildProductLink = (productId) => {
    const url = new URL(window.location.href);
    url.searchParams.set("slug", storeSlug);
    url.searchParams.delete("page");
    url.searchParams.delete("pedido");
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
      window.history.replaceState({ type: "catalog" }, "", buildProductLink(null));
      window.history.pushState({ type: "product", id: productId }, "", buildProductLink(productId));
      setRequestedProductId(productId);
    }
  }, [storeSlug]);

  // Sincronización del botón atrás/adelante del navegador con React (p, pedido, page)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const productId = params.get("p");
      const pedidoParam = params.get("pedido") || "";
      const pageParam = params.get("page") || "";

      setTrackingCode(pedidoParam);
      setLegalPage(pageParam);

      if (productId) {
        const target = catalog.products.find(
          (product) => String(product.id) === String(productId),
        );
        if (target) {
          returnProductIdRef.current = String(target.id);
          setSelectedProduct(target);
        } else {
          setRequestedProductId(productId);
        }
      } else {
        if (selectedProduct) {
          returnProductIdRef.current = String(selectedProduct.id);
        }
        setSelectedProduct(null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [catalog.products, selectedProduct]);

  useEffect(() => {
    const refreshCatalog = () => loadCatalog({ silent: true, resetCategory: false });
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshCatalog();
    };
    const intervalId = window.setInterval(refreshCatalog, REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refreshCatalog);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshCatalog);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [storeSlug]);

  const selectedProductFull = useMemo(() => {
    if (!selectedProduct) return null;
    if (selectedProduct.catalog_variant_id) {
      const latestProduct = catalog.products.find(
        (product) => String(product.id) === String(selectedProduct.id),
      ) || selectedProduct;
      return {
        ...latestProduct,
        catalog_card_id: selectedProduct.catalog_card_id,
        catalog_variant_id: selectedProduct.catalog_variant_id,
      };
    }
    return (
      catalog.products.find(
        (product) => String(product.id) === String(selectedProduct.id)
      ) || selectedProduct
    );
  }, [catalog.products, selectedProduct]);

  // Actualización dinámica de SEO (title, meta description, og:title, og:description)
  useEffect(() => {
    let title = "Catálogo | Tienda Virtual";
    let description = "Catálogo público de productos. Navega nuestros productos, compara precios y realiza tu pedido por WhatsApp.";

    if (legalPage === "privacy") {
      title = catalog.storeName ? `Política de Privacidad | ${catalog.storeName}` : "Política de Privacidad";
      description = `Política de privacidad y protección de datos para la tienda ${catalog.storeName || "virtual"}.`;
    } else if (legalPage === "terms") {
      title = catalog.storeName ? `Términos de Uso | ${catalog.storeName}` : "Términos de Uso";
      description = `Términos y condiciones de uso del catálogo de ${catalog.storeName || "la tienda virtual"}.`;
    } else if (trackingCode) {
      title = catalog.storeName ? `Seguimiento de Pedido #${trackingCode} | ${catalog.storeName}` : `Seguimiento de Pedido #${trackingCode}`;
      description = `Consulta el estado de tu pedido #${trackingCode} en ${catalog.storeName || "la tienda"}.`;
    } else if (selectedProductFull) {
      title = `${selectedProductFull.nombre} | ${catalog.storeName || "Catálogo"}`;
      description = selectedProductFull.descripcion || description;
    } else if (catalog.storeName) {
      title = `${catalog.storeName} | Catálogo Virtual`;
      description = catalog.tienda?.theme_config?.description || `Explora el catálogo de productos de ${catalog.storeName} y haz tu pedido directamente por WhatsApp.`;
    }

    document.title = title;

    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.name = "description";
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = description;

    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement("meta");
      ogTitle.setAttribute("property", "og:title");
      document.head.appendChild(ogTitle);
    }
    ogTitle.content = title;

    let ogDesc = document.querySelector('meta[property="og:description"]');
    if (!ogDesc) {
      ogDesc = document.createElement("meta");
      ogDesc.setAttribute("property", "og:description");
      document.head.appendChild(ogDesc);
    }
    ogDesc.content = description;
  }, [catalog.storeName, catalog.tienda, selectedProductFull, legalPage, trackingCode]);

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
    returnProductIdRef.current = String(product?.catalog_card_id || product?.id || "");
    setSelectedProduct(product);
    const url = new URL(window.location.href);
    url.searchParams.set("slug", storeSlug);
    url.searchParams.delete("page");
    url.searchParams.delete("pedido");
    if (product?.id) {
      url.searchParams.set("p", String(product.id));
    }
    window.history.pushState({ type: "product", id: product?.id }, "", url.toString());
    window.scrollTo({ top: 0, behavior: "instant" });
    registerPublicEvent(storeSlug, "product_view", product?.id);
  };

  const closeProduct = () => {
    const productId = String(selectedProductFull?.id || returnProductIdRef.current || "");
    returnProductIdRef.current = String(selectedProduct?.catalog_card_id || productId);
    setSelectedProduct(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("p");
    window.history.pushState({ type: "catalog" }, "", url.toString());
  };

  const navigateProduct = (product) => {
    if (!product) return;
    returnProductIdRef.current = String(product.id);
    setSelectedProduct(product);
    window.history.pushState({ type: "product", id: product.id }, "", buildProductLink(product.id));
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
    url.searchParams.delete("page");
    url.searchParams.set("pedido", normalized);
    window.history.pushState({ type: "tracking", pedido: normalized }, "", url.toString());
    setSelectedProduct(null);
    setLegalPage("");
    setTrackingCode(normalized);
  };

  const closeTracking = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("pedido");
    window.history.pushState({ type: "catalog" }, "", url.toString());
    setTrackingCode("");
  };

  const openLegalPage = (pageName) => {
    const url = new URL(window.location.href);
    url.searchParams.set("slug", storeSlug);
    url.searchParams.delete("p");
    url.searchParams.delete("pedido");
    url.searchParams.set("page", pageName);
    window.history.pushState({ type: "legal", page: pageName }, "", url.toString());
    setSelectedProduct(null);
    setTrackingCode("");
    setLegalPage(pageName);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeLegalPage = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("page");
    window.history.pushState({ type: "catalog" }, "", url.toString());
    setLegalPage("");
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
        ) : legalPage === "privacy" ? (
          <PrivacyPage
            slug={storeSlug}
            onBack={closeLegalPage}
            onNavigate={openLegalPage}
          />
        ) : legalPage === "terms" ? (
          <TermsPage
            slug={storeSlug}
            onBack={closeLegalPage}
            onNavigate={openLegalPage}
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

        {/* Botón flotante del carrito */}
        {cartCount > 0 && !isCartOpen && !trackingCode && !legalPage && (
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

        {/* Footer con enlaces legales */}
        {!legalPage && !selectedProductFull && !trackingCode && (
          <footer className="catalog-legal-footer" aria-label="Pie de página">
            <nav aria-label="Información legal">
              <button
                type="button"
                className="legal-footer-link"
                onClick={() => openLegalPage("privacy")}
              >
                Privacidad
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                className="legal-footer-link"
                onClick={() => openLegalPage("terms")}
              >
                Términos de uso
              </button>
            </nav>
          </footer>
        )}
      </CurrencyProvider>
    </ThemeProvider>
  );
}

export default App;
