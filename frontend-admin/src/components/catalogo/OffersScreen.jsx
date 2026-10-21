import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api';
import { offersApi } from '../../api/offers';
import StoreRefPicker from '../StoreRefPicker';
import ImageDropZone from '../ImageDropZone';
import { ToastStack } from '../Toast';
import {
  OfertasIcon,
  RefreshIcon,
  EditIcon,
  CheckIcon,
  ImageIcon,
  TagIcon,
  BoxIcon
} from '../common/Icons';
import {
  getImageSrc,
  formatDateTime,
  createOfferFormState,
  normalizeOfferPayload,
  formatOfferValue
} from '../../utils';

function SearchableTargetInput({
  items,
  value,
  onChange,
  getKey,
  getLabel,
  label,
  placeholder,
  helpText = "",
  required = false,
}) {
  const options = useMemo(
    () => items.map((item) => ({ value: getKey(item), label: getLabel(item) })),
    [items, getKey, getLabel],
  );
  const [text, setText] = useState("");
  const listId = useMemo(() => `target-picker-${Math.random().toString(36).slice(2)}`, []);

  useEffect(() => {
    const selected = options.find((option) => option.value === value);
    setText(selected?.label || "");
  }, [options, value]);

  const resolve = (nextText) => {
    const normalized = nextText.trim().toLowerCase();
    if (!normalized) return "";
    const exact = options.find((option) => option.label.toLowerCase() === normalized);
    if (exact) return exact.value;
    const partial = options.find((option) => option.label.toLowerCase().includes(normalized));
    return partial ? partial.value : "";
  };

  return (
    <label style={{ display: 'block', width: '100%' }}>
      <span style={{ display: 'block', marginBottom: '6px', fontSize: '0.84rem', fontWeight: 600 }}>{label}</span>
      <input
        list={listId}
        value={text}
        required={required}
        placeholder={placeholder}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          onChange(resolve(next));
        }}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option.value} value={option.label} />
        ))}
      </datalist>
      {helpText && <span style={{ display: 'block', marginTop: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{helpText}</span>}
    </label>
  );
}

export default function OffersScreen({ isSuperadmin }) {
  const [stores, setStores] = useState([]);
  const [tenantId, setTenantId] = useState("");
  const [offers, setOffers] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [linkedProducts, setLinkedProducts] = useState([]);
  const [linkedCategories, setLinkedCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [managingProducts, setManagingProducts] = useState(false);
  const [bannerUploading, setBannerUploading] = useState("");
  const [error, setError] = useState("");
  const [editingOfferId, setEditingOfferId] = useState("");
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [offerForm, setOfferForm] = useState(createOfferFormState());
  const [createTargetType, setCreateTargetType] = useState("none");
  const [createTargetId, setCreateTargetId] = useState("");
  const [createTargetOverride, setCreateTargetOverride] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [manageOffer, setManageOffer] = useState(null);
  const [targetTab, setTargetTab] = useState("productos");
  const [bannerOffer, setBannerOffer] = useState(null);
  const [overrideByProduct, setOverrideByProduct] = useState({});
  const [toasts, setToasts] = useState([]);
  const [pendingActionKey, setPendingActionKey] = useState("");

  // Filters for the offers table
  const [tableSearch, setTableSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showGuide, setShowGuide] = useState(true);

  const selectedStore = useMemo(
    () => stores.find((store) => store.id_tienda === tenantId) || null,
    [stores, tenantId],
  );
  const selectedStoreRef = isSuperadmin
    ? selectedStore?.slug || selectedStore?.nombre_tienda || ""
    : undefined;
  const offerTenantOptions = isSuperadmin ? { tenantId } : {};
  const linkedProductIds = useMemo(
    () => new Set(linkedProducts.map((item) => item.id_producto)),
    [linkedProducts],
  );
  const linkedCategoryIds = useMemo(
    () => new Set(linkedCategories.map((item) => item.id_categoria)),
    [linkedCategories],
  );
  const filteredProducts = useMemo(() => {
    const normalized = productQuery.trim().toLowerCase();
    if (!normalized) return products;
    return products.filter((product) => {
      const haystack = [
        product.nombre,
        product.descripcion,
        product.id_producto,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [products, productQuery]);
  const filteredCategories = useMemo(() => {
    const normalized = categoryQuery.trim().toLowerCase();
    if (!normalized) return categories;
    return categories.filter((category) => {
      const haystack = [
        category.nombre,
        category.id_categoria,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [categories, categoryQuery]);
  const availableProducts = useMemo(
    () => filteredProducts.filter((product) => !linkedProductIds.has(product.id_producto)),
    [filteredProducts, linkedProductIds],
  );
  const availableCategories = useMemo(
    () => filteredCategories.filter((category) => !linkedCategoryIds.has(category.id_categoria)),
    [filteredCategories, linkedCategoryIds],
  );
  const createTargetItems = useMemo(() => {
    if (createTargetType === "product") return products;
    if (createTargetType === "category") return categories;
    return [];
  }, [createTargetType, products, categories]);

  // Offers table filter
  const displayedOffers = useMemo(() => {
    return offers.filter((o) => {
      // Text filter
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase();
        const matchesName = (o.nombre || "").toLowerCase().includes(q);
        const matchesBadge = (o.badge_text || "").toLowerCase().includes(q);
        if (!matchesName && !matchesBadge) return false;
      }
      // Status filter
      if (statusFilter === "active" && !o.activa) return false;
      if (statusFilter === "inactive" && o.activa) return false;
      // Type filter
      if (typeFilter !== "all" && o.tipo !== typeFilter) return false;
      return true;
    });
  }, [offers, tableSearch, statusFilter, typeFilter]);

  // Metrics
  const metrics = useMemo(() => {
    const total = offers.length;
    const active = offers.filter((o) => o.activa).length;
    const percentCount = offers.filter((o) => o.tipo === "PERCENT").length;
    const overrideCount = offers.filter((o) => o.tipo === "PRICE_OVERRIDE").length;
    return { total, active, percentCount, overrideCount };
  }, [offers]);

  const pushToast = (message, type = "success") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((current) => [...current, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4000);
  };

  const dismissToast = (id) => setToasts((current) => current.filter((item) => item.id !== id));
  const isPendingAction = (key) => pendingActionKey === key;
  const withActionState = async (key, callback) => {
    setPendingActionKey(key);
    try {
      await callback();
    } finally {
      setPendingActionKey("");
    }
  };

  const assertTenantReady = () => {
    if (isSuperadmin && !tenantId) {
      throw new Error("Selecciona una tienda");
    }
  };

  const loadStores = async () => {
    if (!isSuperadmin) return;
    const data = await api.adminListTiendas();
    setStores(data);
    if (!tenantId && data[0]?.id_tienda) {
      setTenantId(data[0].id_tienda);
    }
  };

  const loadOffers = async () => {
    if (isSuperadmin && !tenantId) {
      setOffers([]);
      setManageOffer(null);
      return;
    }
    setLoading(true);
    try {
      const data = await offersApi.list(offerTenantOptions);
      setOffers(data || []);
      setManageOffer((current) => {
        if (!current) return null;
        return data.find((item) => item.id_oferta === current.id_oferta) || null;
      });
      return data;
    } finally {
      setLoading(false);
    }
  };

  const ensureProductsLoaded = async () => {
    if (products.length > 0) return products;
    const data = isSuperadmin ? await api.listProductos(selectedStoreRef) : await api.listProductos();
    setProducts(data);
    return data;
  };

  const ensureCategoriesLoaded = async () => {
    if (categories.length > 0) return categories;
    const data = isSuperadmin ? await api.listCategorias(selectedStoreRef) : await api.listCategorias();
    setCategories(data);
    return data;
  };

  const loadManageProducts = async (offer) => {
    const [associatedProducts, catalogProducts] = await Promise.all([
      offersApi.listProducts(offer.id_oferta, offerTenantOptions),
      ensureProductsLoaded(),
    ]);
    setLinkedProducts(associatedProducts);
    setProducts(catalogProducts);
    setOverrideByProduct(
      Object.fromEntries(
        associatedProducts
          .filter((item) => item.precio_override !== null && item.precio_override !== undefined)
          .map((item) => [item.id_producto, String(item.precio_override)]),
      ),
    );
  };

  const loadManageCategories = async (offer) => {
    const [associatedCategories, catalogCategories] = await Promise.all([
      offersApi.listCategories(offer.id_oferta, offerTenantOptions),
      ensureCategoriesLoaded(),
    ]);
    setLinkedCategories(associatedCategories);
    setCategories(catalogCategories);
  };

  const openProductsManager = async (offer) => {
    setManageOffer(offer);
    setTargetTab("productos");
    setProductQuery("");
    setCategoryQuery("");
    setOverrideByProduct({});
    setManagingProducts(true);
    setProductsLoading(true);
    setError("");
    try {
      await loadManageProducts(offer);
    } catch (err) {
      setManageOffer(null);
      setError(err.message || "No se pudieron cargar los productos de la oferta");
      pushToast(err.message || "No se pudieron cargar los productos de la oferta", "error");
    } finally {
      setManagingProducts(false);
      setProductsLoading(false);
    }
  };

  const closeProductsManager = () => {
    setManageOffer(null);
    setLinkedProducts([]);
    setLinkedCategories([]);
    setCategories([]);
    setProductQuery("");
    setCategoryQuery("");
    setOverrideByProduct({});
    setManagingProducts(false);
  };

  const openBannerManager = (offer) => {
    setBannerOffer(offer);
    setError("");
  };

  const handleOpenCreateModal = () => {
    setEditingOfferId("");
    setOfferForm(createOfferFormState());
    setCreateTargetType("none");
    setCreateTargetId("");
    setCreateTargetOverride("");
    setError("");
    setIsOfferModalOpen(true);
  };

  const handleOpenEditModal = (offer) => {
    setEditingOfferId(offer.id_oferta);
    setOfferForm(createOfferFormState(offer));
    setCreateTargetType("none");
    setCreateTargetId("");
    setCreateTargetOverride("");
    setError("");
    setIsOfferModalOpen(true);
  };

  const handleCloseOfferModal = () => {
    setIsOfferModalOpen(false);
    setEditingOfferId("");
    setOfferForm(createOfferFormState());
  };

  const handleOfferSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      assertTenantReady();
      const payload = normalizeOfferPayload(offerForm);
      const pendingTargetType = createTargetType;
      const pendingTargetId = createTargetId;
      const pendingTargetOverride = createTargetOverride;
      if (payload.tipo === "PERCENT" && !(payload.porcentaje > 0)) {
        throw new Error("Ingresa un porcentaje válido mayor a 0");
      }
      let savedOffer = null;
      if (editingOfferId) {
        savedOffer = await offersApi.update(editingOfferId, payload, offerTenantOptions);
        pushToast("Oferta actualizada exitosamente");
      } else {
        savedOffer = await offersApi.create(payload, offerTenantOptions);
        pushToast("Oferta creada exitosamente");
      }
      setEditingOfferId("");
      setOfferForm(createOfferFormState());
      setCreateTargetType("none");
      setCreateTargetId("");
      setCreateTargetOverride("");
      setIsOfferModalOpen(false);
      await loadOffers();
      if (savedOffer) {
        if (pendingTargetType === "product" && pendingTargetId) {
          await offersApi.attachProducts(savedOffer.id_oferta, {
            productos: [{
              id_producto: pendingTargetId,
              precio_override: savedOffer.tipo === "PRICE_OVERRIDE" ? Number(pendingTargetOverride || 0) : null,
              activo: true,
            }],
          }, offerTenantOptions);
          pushToast("Oferta asignada al producto");
          await openProductsManager(savedOffer);
        } else if (pendingTargetType === "category" && pendingTargetId) {
          if (savedOffer.tipo !== "PERCENT") {
            throw new Error("Solo las ofertas PERCENT pueden asignarse a categorías");
          }
          await offersApi.attachCategories(savedOffer.id_oferta, {
            categorias: [{ id_categoria: pendingTargetId, activo: true }],
          }, offerTenantOptions);
          pushToast("Oferta asignada a la categoría");
          setManageOffer(savedOffer);
          setTargetTab("categorias");
        } else {
          await openProductsManager(savedOffer);
        }
      }
    } catch (err) {
      const message = err.message || "No se pudo guardar la oferta";
      setError(message);
      pushToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleOffer = async (offer) => {
    setError("");
    await withActionState(`toggle:${offer.id_oferta}`, async () => {
      try {
        assertTenantReady();
        await offersApi.update(offer.id_oferta, { activa: !offer.activa }, offerTenantOptions);
        pushToast(offer.activa ? "Oferta desactivada" : "Oferta activada");
        await loadOffers();
      } catch (err) {
        const message = err.message || "No se pudo cambiar el estado";
        setError(message);
        pushToast(message, "error");
      }
    });
  };

  const upsertProductInOffer = async (product, successMessage) => {
    if (!manageOffer) return;
    setManagingProducts(true);
    setError("");
    await withActionState(`product:save:${product.id_producto}`, async () => {
      try {
        const overrideValue = overrideByProduct[product.id_producto];
        if (manageOffer.tipo === "PRICE_OVERRIDE" && !(Number(overrideValue) >= 0)) {
          throw new Error("Ingresa un precio override válido para este producto");
        }
        await offersApi.attachProducts(manageOffer.id_oferta, {
          productos: [{
            id_producto: product.id_producto,
            precio_override: manageOffer.tipo === "PRICE_OVERRIDE" ? Number(overrideValue) : null,
            activo: true,
          }],
        }, offerTenantOptions);
        await loadManageProducts(manageOffer);
        pushToast(successMessage);
      } catch (err) {
        const message = err.message || "No se pudo asociar el producto";
        setError(message);
        pushToast(message, "error");
      } finally {
        setManagingProducts(false);
      }
    });
  };

  const handleAttachProduct = async (product) => {
    await upsertProductInOffer(product, "Producto asociado a la oferta");
  };

  const handleSaveProductOverride = async (product) => {
    await upsertProductInOffer(product, "Precio override actualizado");
  };

  const handleDetachProduct = async (idProducto) => {
    if (!manageOffer) return;
    setManagingProducts(true);
    setError("");
    await withActionState(`product:remove:${idProducto}`, async () => {
      try {
        await offersApi.detachProduct(manageOffer.id_oferta, idProducto, offerTenantOptions);
        setLinkedProducts((current) => current.filter((item) => item.id_producto !== idProducto));
        setOverrideByProduct((current) => {
          const next = { ...current };
          delete next[idProducto];
          return next;
        });
        await loadManageProducts(manageOffer);
        pushToast("Producto removido de la oferta");
      } catch (err) {
        const message = err.message || "No se pudo quitar el producto";
        setError(message);
        pushToast(message, "error");
      } finally {
        setManagingProducts(false);
      }
    });
  };

  const handleAttachCategory = async (category) => {
    if (!manageOffer) return;
    if (manageOffer.tipo !== "PERCENT") {
      const message = "Solo % por categoría";
      setError(message);
      pushToast(message, "error");
      return;
    }
    setManagingProducts(true);
    setError("");
    await withActionState(`category:save:${category.id_categoria}`, async () => {
      try {
        await offersApi.attachCategories(manageOffer.id_oferta, {
          categorias: [{
            id_categoria: category.id_categoria,
            activo: true,
          }],
        }, offerTenantOptions);
        await loadManageCategories(manageOffer);
        pushToast("Categoría asociada a la oferta");
      } catch (err) {
        const message = err.message || "No se pudo asociar la categoría";
        setError(message);
        pushToast(message, "error");
      } finally {
        setManagingProducts(false);
      }
    });
  };

  const handleDetachCategory = async (idCategoria) => {
    if (!manageOffer) return;
    setManagingProducts(true);
    setError("");
    await withActionState(`category:remove:${idCategoria}`, async () => {
      try {
        await offersApi.detachCategory(manageOffer.id_oferta, idCategoria, offerTenantOptions);
        setLinkedCategories((current) => current.filter((item) => item.id_categoria !== idCategoria));
        await loadManageCategories(manageOffer);
        pushToast("Categoría removida de la oferta");
      } catch (err) {
        const message = err.message || "No se pudo quitar la categoría";
        setError(message);
        pushToast(message, "error");
      } finally {
        setManagingProducts(false);
      }
    });
  };

  const handleBannerUpload = async (file) => {
    if (!bannerOffer || !file) return;
    setBannerUploading(bannerOffer.id_oferta);
    setError("");
    try {
      const payload = await offersApi.uploadBanner(bannerOffer.id_oferta, file, offerTenantOptions);
      setBannerOffer((current) => current ? { ...current, banner_url: payload.banner_url } : current);
      pushToast("Banner de oferta actualizado");
      await loadOffers();
    } catch (err) {
      const message = err.message || "No se pudo subir el banner";
      setError(message);
      pushToast(message, "error");
    } finally {
      setBannerUploading("");
    }
  };

  useEffect(() => {
    loadStores().catch((err) => {
      setError(err.message);
      pushToast(err.message, "error");
    });
  }, []);

  useEffect(() => {
    loadOffers().catch((err) => {
      setError(err.message);
      pushToast(err.message, "error");
    });
  }, [tenantId]);

  useEffect(() => {
    if (!manageOffer) return;
    if (targetTab === "categorias" && manageOffer.tipo === "PERCENT") {
      setProductsLoading(true);
      loadManageCategories(manageOffer)
        .catch((err) => {
          setError(err.message || "No se pudieron cargar las categorías");
          pushToast(err.message || "No se pudieron cargar las categorías", "error");
        })
        .finally(() => setProductsLoading(false));
      return;
    }
    if (targetTab === "productos") {
      setProductsLoading(true);
      loadManageProducts(manageOffer)
        .catch((err) => {
          setError(err.message || "No se pudieron cargar los productos");
          pushToast(err.message || "No se pudieron cargar los productos", "error");
        })
        .finally(() => setProductsLoading(false));
    }
  }, [manageOffer?.id_oferta, targetTab]);

  useEffect(() => {
    if (!createTargetType) return;
    if (createTargetType === "product") {
      ensureProductsLoaded().catch((err) => {
        setError(err.message || "No se pudieron cargar los productos");
        pushToast(err.message || "No se pudieron cargar los productos", "error");
      });
    }
    if (createTargetType === "category") {
      ensureCategoriesLoaded().catch((err) => {
        setError(err.message || "No se pudieron cargar las categorías");
        pushToast(err.message || "No se pudieron cargar las categorías", "error");
      });
    }
  }, [createTargetType, selectedStoreRef]);

  useEffect(() => {
    if (offerForm.tipo === "PERCENT") return;
    if (createTargetType === "category") {
      setCreateTargetType("none");
      setCreateTargetId("");
    }
  }, [offerForm.tipo, createTargetType]);

  return (
    <div className="offers-container">
      <ToastStack items={toasts} onDismiss={dismissToast} />

      {/* Top Header */}
      <div className="offers-header">
        <div className="offers-header-info">
          <h1>Gestión de Ofertas y Promociones</h1>
          <p>Crea descuentos por porcentaje o precios fijos especiales para activar en tu tienda online.</p>
        </div>

        <div className="offers-header-actions">
          {isSuperadmin && (
            <div style={{ minWidth: "220px" }}>
              <StoreRefPicker
                stores={stores}
                value={tenantId}
                onChange={setTenantId}
                required
                label=""
                placeholder="Filtrar por tienda..."
                helpText=""
              />
            </div>
          )}

          <button
            type="button"
            className="btn btn-ghost"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            onClick={() => loadOffers().catch((err) => {
              setError(err.message);
              pushToast(err.message, "error");
            })}
          >
            <RefreshIcon size={16} className={loading ? "spin-anim" : ""} />
            <span>{loading ? "Cargando..." : "Actualizar"}</span>
          </button>
        </div>
      </div>

      {/* Error alert */}
      {error ? (
        <div className="alert alert-danger" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{error}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setError("")}>✕</button>
        </div>
      ) : null}

      {/* Guide Banner */}
      {showGuide && (
        <div className="offers-guide-banner">
          <span style={{ fontSize: '22px' }}>📢</span>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 4px', fontSize: '0.92rem', fontWeight: 700 }}>
              ¿Cómo funcionan las ofertas y promociones?
            </h4>
            <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
              • <strong>Porcentaje (%):</strong> Descuenta una fracción automática (ej. 15% OFF) a productos específicos o categorías enteras.<br />
              • <strong>Precio Fijo (Override):</strong> Asigna un precio promocional final (ej. de 100 Bs a 79 Bs) directo a productos seleccionados.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setShowGuide(false)}
            title="Ocultar guía"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Bento Grid */}
      <div className="offers-kpi-grid">
        <div className="offers-kpi-card accent-indigo">
          <div className="offers-kpi-icon">
            <OfertasIcon size={24} />
          </div>
          <div className="offers-kpi-details">
            <span className="offers-kpi-label">Total Ofertas</span>
            <span className="offers-kpi-val">{metrics.total}</span>
          </div>
        </div>

        <div className="offers-kpi-card accent-emerald">
          <div className="offers-kpi-icon">
            <CheckIcon size={24} />
          </div>
          <div className="offers-kpi-details">
            <span className="offers-kpi-label">Ofertas Activas</span>
            <span className="offers-kpi-val">{metrics.active}</span>
          </div>
        </div>

        <div className="offers-kpi-card accent-purple">
          <div className="offers-kpi-icon">
            <TagIcon size={24} />
          </div>
          <div className="offers-kpi-details">
            <span className="offers-kpi-label">Porcentuales (%)</span>
            <span className="offers-kpi-val">{metrics.percentCount}</span>
          </div>
        </div>

        <div className="offers-kpi-card accent-rose">
          <div className="offers-kpi-icon">
            <BoxIcon size={24} />
          </div>
          <div className="offers-kpi-details">
            <span className="offers-kpi-label">Precios Fijos</span>
            <span className="offers-kpi-val">{metrics.overrideCount}</span>
          </div>
        </div>
      </div>

      {/* Main Full-Width Table View */}
      <div className="offers-table-pane full-width">
        <div className="offers-card">
          {/* Filter Toolbar */}
          <div className="offers-toolbar">
            <div className="offers-search-box">
              <span className="offers-search-icon">🔍</span>
              <input
                type="text"
                placeholder="Buscar oferta por nombre o badge..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
              />
            </div>

            <select
              className="offers-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="active">Solo Activas</option>
              <option value="inactive">Solo Inactivas</option>
            </select>

            <select
              className="offers-filter-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">Todos los tipos</option>
              <option value="PERCENT">Porcentaje (%)</option>
              <option value="PRICE_OVERRIDE">Precio Fijo</option>
            </select>

            <button
              type="button"
              className="btn btn-primary offers-create-btn"
              onClick={handleOpenCreateModal}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontWeight: 700 }}
            >
              <OfertasIcon size={16} />
              <span>+ Nueva Oferta</span>
            </button>
          </div>

          {/* Table */}
          <div className="table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table className="offers-table">
              <thead>
                <tr>
                  <th>Nombre / Badge</th>
                  <th>Tipo</th>
                  <th>Valor</th>
                  <th>Estado</th>
                  <th>Vigencia</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {displayedOffers.map((offer) => (
                  <tr key={offer.id_oferta}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem' }}>{offer.nombre}</div>
                      {offer.badge_text && (
                        <span className="offer-badge-tag">
                          🏷️ {offer.badge_text}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`offer-type-pill ${offer.tipo === 'PERCENT' ? 'percent' : 'price_override'}`}>
                        {offer.tipo === 'PERCENT' ? 'Porcentaje' : 'Precio Fijo'}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: '#10b981', fontSize: '0.96rem' }}>
                        {formatOfferValue(offer)}
                      </strong>
                    </td>
                    <td>
                      <span className={`status-pill ${offer.activa ? 'active' : 'inactive'}`}>
                        <span className="status-pill-dot" />
                        {offer.activa ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                        <div><strong>Inicio:</strong> {formatDateTime(offer.fecha_inicio)}</div>
                        <div><strong>Fin:</strong> {formatDateTime(offer.fecha_fin)}</div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          title="Editar oferta"
                          onClick={() => handleOpenEditModal(offer)}
                        >
                          <EditIcon size={14} />
                          <span>Editar</span>
                        </button>

                        <button
                          type="button"
                          className={`btn btn-sm ${offer.activa ? "btn-danger-ghost" : "btn-success-ghost"}`}
                          disabled={isPendingAction(`toggle:${offer.id_oferta}`)}
                          onClick={() => handleToggleOffer(offer)}
                        >
                          {offer.activa ? "Desactivar" : "Activar"}
                        </button>

                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--brand-primary)' }}
                          onClick={() => openProductsManager(offer)}
                          title="Asignar productos o categorías"
                        >
                          🎯 Asignar
                        </button>

                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ color: '#8b5cf6' }}
                          onClick={() => openBannerManager(offer)}
                          title="Cargar banner promocional"
                        >
                          🖼️ Banner
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && displayedOffers.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🏷️</div>
                      <p style={{ margin: 0, fontWeight: 600 }}>No se encontraron ofertas con los filtros seleccionados.</p>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: '14px' }}
                        onClick={handleOpenCreateModal}
                      >
                        + Crear Primera Oferta
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL: CREAR / EDITAR OFERTA (DISEÑO AMPLIO, MODERNO Y RESPONSIVO) */}
      {isOfferModalOpen && (
        <div className="offers-modal-overlay" onClick={handleCloseOfferModal}>
          <div
            className="offers-modal-window offers-form-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '780px' }}
          >
            {/* Modal Header */}
            <div className="offers-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div className="offers-modal-icon-badge">
                  {editingOfferId ? "✍️" : "🎁"}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {editingOfferId ? "Editar Oferta Promocional" : "Crear Nueva Oferta Comercial"}
                  </h3>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {editingOfferId
                      ? "Modifica los parámetros de descuento, vigencia y etiqueta en catálogo."
                      : "Define el tipo de descuento, duración y apariencia visual de tu promoción."}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleCloseOfferModal}
                title="Cerrar ventana"
              >
                ✕
              </button>
            </div>

            {/* Selector Visual de Tipo de Oferta (Interactive Cards) */}
            <div className="offers-type-grid">
              <div
                className={`offers-type-card ${offerForm.tipo === "PERCENT" ? "active" : ""}`}
                onClick={() => {
                  setOfferForm((current) => ({
                    ...current,
                    tipo: "PERCENT",
                    porcentaje: current.porcentaje || 15,
                  }));
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.3rem' }}>🏷️</span>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>Porcentaje (%)</strong>
                  </div>
                  {offerForm.tipo === "PERCENT" && <span className="offers-type-tag active">Activo</span>}
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Descuenta un % sobre el precio regular. Aplica a productos individuales o a categorías enteras.
                </p>
              </div>

              <div
                className={`offers-type-card ${offerForm.tipo === "PRICE_OVERRIDE" ? "active" : ""}`}
                onClick={() => {
                  setOfferForm((current) => ({
                    ...current,
                    tipo: "PRICE_OVERRIDE",
                    porcentaje: "",
                  }));
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.3rem' }}>💎</span>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>Precio Fijo Especial</strong>
                  </div>
                  {offerForm.tipo === "PRICE_OVERRIDE" && <span className="offers-type-tag active">Activo</span>}
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Fija un precio promocional único directo por producto (ej. de 100 Bs a 69.90 Bs).
                </p>
              </div>
            </div>

            {/* Formulario Principal */}
            <form onSubmit={handleOfferSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                <label>
                  <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                    Nombre de la Promoción *
                  </span>
                  <input
                    value={offerForm.nombre}
                    onChange={(event) => setOfferForm((current) => ({ ...current, nombre: event.target.value }))}
                    placeholder="Ej. Liquidación de Invierno, Black Friday, Hot Sale..."
                    required
                  />
                </label>

                <div>
                  <label>
                    <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                      Texto de Etiqueta (Badge para el catálogo)
                    </span>
                    <input
                      value={offerForm.badge_text}
                      placeholder="Ej. 20% OFF, LIQUIDACIÓN, 2x1"
                      onChange={(event) => setOfferForm((current) => ({ ...current, badge_text: event.target.value }))}
                    />
                  </label>
                  <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>Vista previa en tarjeta:</span>
                    <span className="offer-badge-preview">
                      🏷️ {offerForm.badge_text || "OFERTA"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Fila de Valor / Prioridad */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', alignItems: 'start' }}>
                {offerForm.tipo === "PERCENT" ? (
                  <label>
                    <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                      Porcentaje de Descuento (%) *
                    </span>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={offerForm.porcentaje}
                        onChange={(event) => setOfferForm((current) => ({ ...current, porcentaje: event.target.value }))}
                        placeholder="15"
                        required
                        style={{ paddingRight: '40px' }}
                      />
                      <span style={{ position: 'absolute', right: '14px', fontWeight: 800, color: 'var(--brand-primary)', pointerEvents: 'none' }}>
                        %
                      </span>
                    </div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                      Se restará automáticamente del precio regular en catálogo.
                    </span>
                  </label>
                ) : (
                  <div className="offers-note-box">
                    <strong style={{ display: 'block', marginBottom: '4px', color: 'var(--text-primary)' }}>💎 Precio Fijo Promocional:</strong>
                    <span>El precio de liquidación se define de forma personalizada al asociar cada producto.</span>
                  </div>
                )}

                <label>
                  <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                    Prioridad Visual en Catálogo
                  </span>
                  <input
                    type="number"
                    value={offerForm.prioridad}
                    onChange={(event) => setOfferForm((current) => ({ ...current, prioridad: event.target.value }))}
                    placeholder="0"
                  />
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    Si un producto tiene múltiples promociones, se aplicará la de mayor prioridad.
                  </span>
                </label>
              </div>

              {/* Fechas de Vigencia */}
              <div className="offers-dates-card">
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  🗓️ Periodo de Vigencia de la Promoción
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                  <label>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Fecha y Hora de Inicio
                    </span>
                    <input
                      type="datetime-local"
                      value={offerForm.fecha_inicio}
                      onChange={(event) => setOfferForm((current) => ({ ...current, fecha_inicio: event.target.value }))}
                      required
                    />
                  </label>

                  <label>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Fecha y Hora de Fin
                    </span>
                    <input
                      type="datetime-local"
                      value={offerForm.fecha_fin}
                      onChange={(event) => setOfferForm((current) => ({ ...current, fecha_fin: event.target.value }))}
                      required
                    />
                  </label>
                </div>
              </div>

              {/* Asignación Rápida Inicial (solo al crear) */}
              {!editingOfferId && (
                <div className="offers-target-card">
                  <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🎯 Asignación Inicial Rápida (Opcional)
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '10px' }}>
                    Puedes asociar un producto o categoría ahora o gestionarlo más adelante desde la tabla.
                  </span>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                    <label>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Asignar a
                      </span>
                      <select
                        value={createTargetType}
                        onChange={(event) => {
                          const nextType = event.target.value;
                          setCreateTargetType(nextType);
                          setCreateTargetId("");
                          setCreateTargetOverride("");
                        }}
                      >
                        <option value="none">Sin asignar por ahora</option>
                        <option value="product">Un Producto Específico</option>
                        <option value="category" disabled={offerForm.tipo !== "PERCENT"}>
                          Una Categoría Completa
                        </option>
                      </select>
                    </label>

                    {createTargetType !== "none" && (
                      <SearchableTargetInput
                        items={createTargetItems}
                        value={createTargetId}
                        onChange={setCreateTargetId}
                        getKey={(item) => createTargetType === "product" ? item.id_producto : item.id_categoria}
                        getLabel={(item) => createTargetType === "product"
                          ? `${item.nombre} (${item.precio_venta} Bs)`
                          : item.nombre}
                        label={createTargetType === "product" ? "Seleccionar Producto" : "Seleccionar Categoría"}
                        placeholder="Buscar..."
                        required
                      />
                    )}
                  </div>

                  {createTargetType === "product" && offerForm.tipo === "PRICE_OVERRIDE" && (
                    <label style={{ marginTop: '10px' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Precio Promocional Fijo para este Producto (Bs) *
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={createTargetOverride}
                        placeholder="Ej. 49.90"
                        onChange={(event) => setCreateTargetOverride(event.target.value)}
                        required
                      />
                    </label>
                  )}
                </div>
              )}

              {/* Toggle Oferta Activa */}
              <div className="offers-active-toggle-row">
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={offerForm.activa}
                    onChange={(event) => setOfferForm((current) => ({ ...current, activa: event.target.checked }))}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--brand-primary)', cursor: 'pointer' }}
                  />
                  <div>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', display: 'block' }}>
                      Oferta Activa (Publicada en catálogo)
                    </strong>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Si está activa y dentro de las fechas de vigencia, los clientes verán los descuentos de inmediato.
                    </span>
                  </div>
                </label>
              </div>

              {/* Botones de acción del Modal */}
              <div className="offers-modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleCloseOfferModal}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                  style={{ minWidth: '160px', padding: '10px 20px' }}
                >
                  {saving
                    ? "Guardando..."
                    : editingOfferId
                    ? "Guardar Cambios"
                    : "Crear Oferta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ASIGNADOR DE PRODUCTOS Y CATEGORÍAS */}
      {manageOffer && (
        <div className="offers-modal-overlay" onClick={closeProductsManager}>
          <div className="offers-modal-window" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  🎯 Asignar Objetivos: {manageOffer.nombre}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Tipo: <strong>{manageOffer.tipo === 'PERCENT' ? 'Porcentaje' : 'Precio Fijo'}</strong> ({formatOfferValue(manageOffer)})
                </span>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={closeProductsManager}
              >
                ✕
              </button>
            </div>

            {/* Target Tabs */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className={`theme-tab-pill ${targetTab === "productos" ? "active" : ""}`}
                onClick={() => setTargetTab("productos")}
              >
                <BoxIcon size={16} />
                <span>Productos ({linkedProducts.length})</span>
              </button>

              <button
                type="button"
                className={`theme-tab-pill ${targetTab === "categorias" ? "active" : ""}`}
                onClick={() => {
                  if (manageOffer.tipo !== "PERCENT") return;
                  setTargetTab("categorias");
                }}
                disabled={manageOffer.tipo !== "PERCENT"}
                title={manageOffer.tipo !== "PERCENT" ? "Solo las ofertas de porcentaje pueden asignarse a categorías completas" : ""}
              >
                <TagIcon size={16} />
                <span>Categorías ({linkedCategories.length})</span>
              </button>
            </div>

            {/* Modal Content Columns */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              {/* Linked Items Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  🔗 Elementos Actualmente Asociados
                </strong>

                <div style={{ overflowY: 'auto', maxHeight: '340px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {targetTab === "productos" ? (
                    linkedProducts.map((item) => {
                      const product = products.find((entry) => entry.id_producto === item.id_producto);
                      return (
                        <div key={item.id_producto} className="offers-modal-item">
                          <div>
                            <strong style={{ fontSize: '0.84rem' }}>{product?.nombre || "Producto"}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Original: {product?.precio_venta} Bs</div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {manageOffer.tipo === "PRICE_OVERRIDE" ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={overrideByProduct[item.id_producto] || ""}
                                placeholder="0.00 Bs"
                                onChange={(event) => setOverrideByProduct((current) => ({
                                  ...current,
                                  [item.id_producto]: event.target.value,
                                }))}
                                style={{ width: '80px', padding: '6px', fontSize: '0.82rem', textAlign: 'center' }}
                              />
                            ) : (
                              <span style={{ fontWeight: 800, color: '#10b981', fontSize: '0.88rem' }}>
                                -{manageOffer.porcentaje}%
                              </span>
                            )}

                            {manageOffer.tipo === "PRICE_OVERRIDE" && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleSaveProductOverride(item)}
                              >
                                OK
                              </button>
                            )}

                            <button
                              type="button"
                              className="btn btn-danger-ghost btn-sm"
                              onClick={() => handleDetachProduct(item.id_producto)}
                            >
                              Quitar
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    linkedCategories.map((item) => {
                      const category = categories.find((entry) => entry.id_categoria === item.id_categoria);
                      return (
                        <div key={item.id_categoria} className="offers-modal-item">
                          <strong style={{ fontSize: '0.86rem' }}>{category?.nombre || "Categoría"}</strong>
                          <button
                            type="button"
                            className="btn btn-danger-ghost btn-sm"
                            onClick={() => handleDetachCategory(item.id_categoria)}
                          >
                            Quitar
                          </button>
                        </div>
                      );
                    })
                  )}

                  {targetTab === "productos" && linkedProducts.length === 0 && (
                    <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      No hay productos asociados a esta oferta aún.
                    </div>
                  )}

                  {targetTab === "categorias" && linkedCategories.length === 0 && (
                    <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      No hay categorías asociadas a esta oferta aún.
                    </div>
                  )}
                </div>
              </div>

              {/* Available Items & Search Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  ➕ Buscar y Asociar Nuevos
                </strong>

                <input
                  placeholder={targetTab === "productos" ? "🔍 Buscar producto por nombre..." : "🔍 Buscar categoría..."}
                  value={targetTab === "productos" ? productQuery : categoryQuery}
                  onChange={(event) => targetTab === "productos" ? setProductQuery(event.target.value) : setCategoryQuery(event.target.value)}
                />

                <div style={{ overflowY: 'auto', maxHeight: '280px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {targetTab === "productos" ? (
                    availableProducts.map((product) => (
                      <div key={product.id_producto} className="offers-modal-item">
                        <div>
                          <strong style={{ fontSize: '0.84rem' }}>{product.nombre}</strong>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{product.precio_venta} Bs</div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleAttachProduct(product)}
                        >
                          Asociar
                        </button>
                      </div>
                    ))
                  ) : (
                    availableCategories.map((category) => (
                      <div key={category.id_categoria} className="offers-modal-item">
                        <strong style={{ fontSize: '0.84rem' }}>{category.nombre}</strong>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleAttachCategory(category)}
                        >
                          Asociar
                        </button>
                      </div>
                    ))
                  )}

                  {targetTab === "productos" && availableProducts.length === 0 && (
                    <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      No hay más productos disponibles para asociar.
                    </div>
                  )}

                  {targetTab === "categorias" && availableCategories.length === 0 && (
                    <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      No hay más categorías disponibles para asociar.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CARGADOR DE BANNER */}
      {bannerOffer && (
        <div className="offers-modal-overlay" onClick={() => setBannerOffer(null)}>
          <div className="offers-modal-window" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                🖼️ Banner Promocional: {bannerOffer.nombre}
              </h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setBannerOffer(null)}
              >
                ✕
              </button>
            </div>

            {bannerOffer.banner_url ? (
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '8px', textAlign: 'left' }}>
                  Vista previa del banner actual:
                </span>
                <img
                  src={getImageSrc(bannerOffer.banner_url)}
                  alt="Banner"
                  style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}
                />
              </div>
            ) : (
              <div style={{ background: 'var(--bg-surface-elevated)', border: '1px dashed var(--border-strong)', borderRadius: '14px', padding: '30px 14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Esta oferta aún no tiene un banner asignado para el carrusel de la tienda virtual.
              </div>
            )}

            <ImageDropZone
              title="Cargar imagen de banner"
              subtitle="Formatos recomendados: JPG, PNG o WebP (diseño horizontal)"
              statusText={bannerUploading === bannerOffer.id_oferta ? "Subiendo archivo..." : ""}
              disabled={bannerUploading === bannerOffer.id_oferta}
              onFileSelected={handleBannerUpload}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setBannerOffer(null)}
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
