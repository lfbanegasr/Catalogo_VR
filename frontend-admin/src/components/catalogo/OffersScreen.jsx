import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api';
import { offersApi } from '../../api/offers';
import { Card } from '../Card';
import StoreRefPicker from '../StoreRefPicker';
import ImageDropZone from '../ImageDropZone';
import { ToastStack } from '../Toast';
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
      {label}
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
      <span className="helper-text">{helpText}</span>
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
      setOffers(data);
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
        throw new Error("Ingresa un porcentaje valido mayor a 0");
      }
      let savedOffer = null;
      if (editingOfferId) {
        savedOffer = await offersApi.update(editingOfferId, payload, offerTenantOptions);
        pushToast("Oferta actualizada");
      } else {
        savedOffer = await offersApi.create(payload, offerTenantOptions);
        pushToast("Oferta creada");
      }
      setEditingOfferId("");
      setOfferForm(createOfferFormState());
      setCreateTargetType("none");
      setCreateTargetId("");
      setCreateTargetOverride("");
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
          pushToast("Oferta creada y asignada al producto");
          await openProductsManager(savedOffer);
        } else if (pendingTargetType === "category" && pendingTargetId) {
          if (savedOffer.tipo !== "PERCENT") {
            throw new Error("Solo las ofertas PERCENT pueden asignarse a categorias");
          }
          await offersApi.attachCategories(savedOffer.id_oferta, {
            categorias: [{ id_categoria: pendingTargetId, activo: true }],
          }, offerTenantOptions);
          pushToast("Oferta creada y asignada a la categoria");
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
          throw new Error("Ingresa un precio override valido para este producto");
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
      const message = "Solo % por categoria";
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
        pushToast("Categoria asociada a la oferta");
      } catch (err) {
        const message = err.message || "No se pudo asociar la categoria";
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
        pushToast("Categoria removida de la oferta");
      } catch (err) {
        const message = err.message || "No se pudo quitar la categoria";
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
      pushToast("Banner actualizado");
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
          setError(err.message || "No se pudieron cargar las categorias");
          pushToast(err.message || "No se pudieron cargar las categorias", "error");
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
        setError(err.message || "No se pudieron cargar las categorias");
        pushToast(err.message || "No se pudieron cargar las categorias", "error");
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
    <>
      <ToastStack items={toasts} onDismiss={dismissToast} />
      
      {/* Guía informativa de uso */}
      <div style={{
        background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
        border: '1px solid #bfdbfe',
        borderRadius: '16px',
        padding: '16px',
        marginBottom: '20px',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start'
      }}>
        <span style={{ fontSize: '20px' }}>📢</span>
        <div>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 'bold', color: '#1e40af' }}>¿Cómo funcionan las ofertas?</h4>
          <p style={{ margin: 0, fontSize: '11px', color: '#1e3a8a', lineHeight: '1.5' }}>
            Las ofertas te permiten incentivar compras aplicando descuentos. Puedes crear dos tipos:
            <br />
            • <strong>Porcentaje (PERCENT):</strong> Descuenta una fracción del precio (ej. 10%) a productos o categorías enteras.
            <br />
            • <strong>Precio Fijo (PRICE_OVERRIDE):</strong> Establece un precio único final (ej. de 100 Bs a 79 Bs) directo a productos específicos.
          </p>
        </div>
      </div>

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '20px',
        alignItems: 'start'
      }} className="offers-split-layout">
        
        {/* LADO IZQUIERDO: LISTADO DE OFERTAS */}
        <div style={{ flex: '1 1 55%', minWidth: '250px', maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Card title="Ofertas Registradas">
            <div className="catalog-toolbar" style={{ marginBottom: '12px' }}>
              <div className="catalog-controls" style={{ width: '100%', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: '10px' }}>
                {isSuperadmin && (
                  <div style={{ flex: '1 1 200px' }}>
                    <StoreRefPicker
                      stores={stores}
                      value={tenantId}
                      onChange={setTenantId}
                      required
                      label="Tienda destino"
                      placeholder="Busca por nombre o slug..."
                      helpText="Filtra las ofertas de la tienda."
                    />
                  </div>
                )}
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ height: '38px', fontWeight: 'bold' }}
                  onClick={() => loadOffers().catch((err) => {
                    setError(err.message);
                    pushToast(err.message, "error");
                  })}
                >
                  {loading ? "Cargando..." : "🔄 Recargar"}
                </button>
              </div>
            </div>
            
            {error ? <p className="error-text">{error}</p> : null}

            <div className="table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
              <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left', color: '#6b7280' }}>
                    <th style={{ padding: '12px 8px' }}>Nombre</th>
                    <th style={{ padding: '12px 8px' }}>Tipo</th>
                    <th style={{ padding: '12px 8px' }}>Valor</th>
                    <th style={{ padding: '12px 8px' }}>Estado</th>
                    <th style={{ padding: '12px 8px' }}>Vigencia</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((offer) => (
                    <tr key={offer.id_oferta} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ fontWeight: 'bold', color: '#1f2937' }}>{offer.nombre}</div>
                        {offer.badge_text && (
                          <span style={{ fontSize: '9px', background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '2px' }}>
                            🏷️ {offer.badge_text}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '9px', fontWeight: 'bold', background: offer.tipo === 'PERCENT' ? '#e0e7ff' : '#fce7f3', color: offer.tipo === 'PERCENT' ? '#4f46e5' : '#db2777' }}>
                          {offer.tipo === 'PERCENT' ? 'Porcentaje' : 'Precio Fijo'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', fontWeight: 'bold', color: '#059669' }}>{formatOfferValue(offer)}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '9px', fontWeight: 'bold', background: offer.activa ? '#d1fae5' : '#fee2e2', color: offer.activa ? '#059669' : '#dc2626' }}>
                          {offer.activa ? "Activa" : "Inactiva"}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', color: '#6b7280', fontSize: '10px' }}>
                        <div><strong>Inicio:</strong> {formatDateTime(offer.fecha_inicio)}</div>
                        <div><strong>Fin:</strong> {formatDateTime(offer.fecha_fin)}</div>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '9px', fontWeight: 'bold' }}
                            onClick={() => {
                              setEditingOfferId(offer.id_oferta);
                              setOfferForm(createOfferFormState(offer));
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className={`btn ${offer.activa ? "btn-secondary" : "btn-primary"}`}
                            style={{
                              padding: '4px 8px',
                              fontSize: '9px',
                              fontWeight: 'bold',
                              background: offer.activa ? '#fef2f2' : '#ecfdf5',
                              color: offer.activa ? '#dc2626' : '#059669',
                              borderColor: offer.activa ? '#fecaca' : '#a7f3d0'
                            }}
                            onClick={() => handleToggleOffer(offer)}
                          >
                            {offer.activa ? "Desactivar" : "Activar"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            style={{ padding: '4px 8px', fontSize: '9px', fontWeight: 'bold', color: '#2563eb' }}
                            onClick={() => openProductsManager(offer)}
                          >
                            🎯 Asignar
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            style={{ padding: '4px 8px', fontSize: '9px', fontWeight: 'bold', color: '#7c3aed' }}
                            onClick={() => openBannerManager(offer)}
                          >
                            🖼️ Banner
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && offers.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#6b7280', fontSize: '12px' }}>
                        No hay ofertas registradas. ¡Crea una nueva en el formulario de la derecha!
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* LADO DERECHO: FORMULARIO CREAR/EDITAR */}
        <div style={{ flex: '1 1 350px', minWidth: '250px', maxWidth: '100%', position: 'sticky', top: '20px', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', borderRadius: '12px' }}>
          <Card title={editingOfferId ? "✍️ Editar Oferta" : "🎁 Nueva Oferta"}>
            <div style={{
              background: offerForm.tipo === "PERCENT" ? "#f5f3ff" : "#fff1f2",
              border: offerForm.tipo === "PERCENT" ? "1px solid #ddd6fe" : "1px solid #fecdd3",
              borderRadius: '12px',
              padding: '12px',
              marginBottom: '16px',
              fontSize: '11px',
              color: offerForm.tipo === "PERCENT" ? "#5b21b6" : "#9f1239"
            }}>
              {offerForm.tipo === "PERCENT" ? (
                <span>💡 <strong>Oferta de Porcentaje:</strong> Aplica un descuento general (ej. 15%) sobre el precio normal. Se puede asociar a múltiples productos o a categorías completas.</span>
              ) : (
                <span>💡 <strong>Anulación de Precio (Override):</strong> Define un precio único final (ej. 20 Bs). Solo se asigna a nivel de productos individuales.</span>
              )}
            </div>

            <form className="grid-form" onSubmit={handleOfferSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label>
                Nombre de la Oferta
                <input
                  value={offerForm.nombre}
                  onChange={(event) => setOfferForm((current) => ({ ...current, nombre: event.target.value }))}
                  placeholder="Ej. Descuento de Temporada, Liquidación..."
                  required
                />
              </label>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <label style={{ flex: '1 1 140px' }}>
                  Tipo de Oferta
                  <select
                    value={offerForm.tipo}
                    onChange={(event) => setOfferForm((current) => ({
                      ...current,
                      tipo: event.target.value,
                      porcentaje: event.target.value === "PERCENT" ? current.porcentaje : "",
                    }))}
                  >
                    <option value="PERCENT">Porcentaje (%)</option>
                    <option value="PRICE_OVERRIDE">Precio Fijo (Override)</option>
                  </select>
                </label>

                {offerForm.tipo === "PERCENT" ? (
                  <label style={{ flex: '1 1 140px' }}>
                    Porcentaje (%)
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={offerForm.porcentaje}
                      onChange={(event) => setOfferForm((current) => ({ ...current, porcentaje: event.target.value }))}
                      placeholder="Ej. 15"
                      required
                    />
                  </label>
                ) : (
                  <label style={{ flex: '1 1 140px' }}>
                    Valor
                    <input value="Se define por producto" disabled style={{ background: '#f3f4f6', cursor: 'not-allowed' }} />
                  </label>
                )}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <label style={{ flex: '2 1 160px' }}>
                  Badge Text (Texto en Etiqueta)
                  <input
                    value={offerForm.badge_text}
                    maxLength={80}
                    placeholder="Ej. -10% HOY, REGALO..."
                    onChange={(event) => setOfferForm((current) => ({ ...current, badge_text: event.target.value }))}
                  />
                </label>

                <label style={{ flex: '1 1 80px' }}>
                  Prioridad
                  <input
                    type="number"
                    value={offerForm.prioridad}
                    onChange={(event) => setOfferForm((current) => ({ ...current, prioridad: event.target.value }))}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <label style={{ flex: '1 1 140px' }}>
                  Fecha Inicio
                  <input
                    type="datetime-local"
                    value={offerForm.fecha_inicio}
                    onChange={(event) => setOfferForm((current) => ({ ...current, fecha_inicio: event.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#f9fafb', fontFamily: 'inherit', fontSize: '13px' }}
                  />
                </label>

                <label style={{ flex: '1 1 140px' }}>
                  Fecha Fin
                  <input
                    type="datetime-local"
                    value={offerForm.fecha_fin}
                    onChange={(event) => setOfferForm((current) => ({ ...current, fecha_fin: event.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#f9fafb', fontFamily: 'inherit', fontSize: '13px' }}
                  />
                </label>
              </div>

              {!editingOfferId && (
                <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '12px', marginTop: '4px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#4b5563', marginBottom: '8px' }}>Asignación Rápida Inicial (Opcional)</div>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'end' }}>
                    <label style={{ flex: '1 1 140px' }}>
                      Aplicar a
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
                        <option value="product">Un Producto</option>
                        <option value="category" disabled={offerForm.tipo !== "PERCENT"}>Una Categoría</option>
                      </select>
                    </label>

                    {createTargetType !== "none" && (
                      <div style={{ flex: '2 1 200px' }}>
                        <SearchableTargetInput
                          items={createTargetItems}
                          value={createTargetId}
                          onChange={setCreateTargetId}
                          getKey={(item) => createTargetType === "product" ? item.id_producto : item.id_categoria}
                          getLabel={(item) => createTargetType === "product"
                            ? `${item.nombre} (${item.precio_venta} Bs)`
                            : item.nombre}
                          label={createTargetType === "product" ? "Producto Objetivo" : "Categoría Objetivo"}
                          placeholder="Escribe para buscar..."
                          required
                        />
                      </div>
                    )}
                  </div>

                  {createTargetType === "product" && offerForm.tipo === "PRICE_OVERRIDE" && (
                    <label style={{ marginTop: '12px' }}>
                      Precio Especial (Bs)
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

              <label className="check-row" style={{ marginTop: '8px' }}>
                <input
                  type="checkbox"
                  checked={offerForm.activa}
                  onChange={(event) => setOfferForm((current) => ({ ...current, activa: event.target.checked }))}
                />
                Oferta Activa (Habilitada en la tienda)
              </label>

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                  {saving ? "Guardando..." : editingOfferId ? "Guardar Cambios" : "Crear Oferta"}
                </button>
                {editingOfferId && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setEditingOfferId("");
                      setOfferForm(createOfferFormState());
                    }}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </Card>
        </div>
      </div>

      {/* MODAL: ASIGNADOR DE PRODUCTOS / CATEGORIAS */}
      {manageOffer && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }} onClick={closeProductsManager}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            width: '100%',
            maxWidth: '850px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }} onClick={(e) => e.stopPropagation()}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3f4f6', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#111827' }}>🎯 Asignar Objetivos: {manageOffer.nombre}</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#6b7280' }}>
                  Tipo: <strong>{manageOffer.tipo === 'PERCENT' ? 'Porcentaje' : 'Precio Fijo'}</strong> ({formatOfferValue(manageOffer)})
                </p>
              </div>
              <button onClick={closeProductsManager} style={{ border: 'none', background: '#f3f4f6', cursor: 'pointer', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#6b7280' }}>✕</button>
            </div>

            <div className="target-tabs" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #f3f4f6', paddingBottom: '12px' }}>
              <button
                type="button"
                className={`btn ${targetTab === "productos" ? "btn-primary" : "btn-ghost"}`}
                style={{ padding: '6px 16px', fontSize: '11px' }}
                onClick={() => setTargetTab("productos")}
              >
                📦 Productos
              </button>
              <button
                type="button"
                className={`btn ${targetTab === "categorias" ? "btn-primary" : "btn-ghost"}`}
                style={{ padding: '6px 16px', fontSize: '11px' }}
                onClick={() => {
                  if (manageOffer.tipo !== "PERCENT") return;
                  setTargetTab("categorias");
                }}
                disabled={manageOffer.tipo !== "PERCENT"}
                title={manageOffer.tipo !== "PERCENT" ? "Solo las ofertas de Porcentaje (%) se pueden asignar a categorías enteras" : ""}
              >
                📁 Categorías
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '20px' }}>
              
              {/* COLUMNA IZQUIERDA DEL MODAL: ELEMENTOS ASOCIADOS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: '#374151' }}>
                  🔗 Elementos Asociados ({targetTab === "productos" ? linkedProducts.length : linkedCategories.length})
                </h4>
                
                <div style={{ overflowY: 'auto', maxHeight: '350px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {targetTab === "productos" ? (
                    linkedProducts.map((item) => {
                      const product = products.find((entry) => entry.id_producto === item.id_producto);
                      return (
                        <div key={item.id_producto} style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                          <div>
                            <strong>{product?.nombre || "Producto"}</strong>
                            <div style={{ fontSize: '9px', color: '#9ca3af' }}>Original: {product?.precio_venta} Bs</div>
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
                                style={{ width: '70px', padding: '4px', fontSize: '11px', textAlign: 'center', borderRadius: '6px', border: '1px solid #d1d5db' }}
                              />
                            ) : (
                              <span style={{ fontWeight: 'bold', color: '#059669' }}>-{manageOffer.porcentaje}%</span>
                            )}
                            <div style={{ display: 'flex', gap: '2px' }}>
                              {manageOffer.tipo === "PRICE_OVERRIDE" && (
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ padding: '2px 6px', fontSize: '9px' }}
                                  onClick={() => handleSaveProductOverride(item)}
                                >
                                  OK
                                </button>
                              )}
                              <button
                                type="button"
                                style={{ border: 'none', background: '#fee2e2', color: '#ef4444', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '10px' }}
                                onClick={() => handleDetachProduct(item.id_producto)}
                              >
                                Quitar
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    linkedCategories.map((item) => {
                      const category = categories.find((entry) => entry.id_categoria === item.id_categoria);
                      return (
                        <div key={item.id_categoria} style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                          <strong>{category?.nombre || "Categoría"}</strong>
                          <button
                            type="button"
                            style={{ border: 'none', background: '#fee2e2', color: '#ef4444', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '10px' }}
                            onClick={() => handleDetachCategory(item.id_categoria)}
                          >
                            Quitar
                          </button>
                        </div>
                      );
                    })
                  )}
                  {targetTab === "productos" && linkedProducts.length === 0 && (
                    <p style={{ margin: 0, padding: '20px 0', textAlign: 'center', color: '#9ca3af', fontSize: '11px' }}>No hay productos asociados a esta oferta.</p>
                  )}
                  {targetTab === "categorias" && linkedCategories.length === 0 && (
                    <p style={{ margin: 0, padding: '20px 0', textAlign: 'center', color: '#9ca3af', fontSize: '11px' }}>No hay categorías asociadas a esta oferta.</p>
                  )}
                </div>
              </div>

              {/* COLUMNA DERECHA DEL MODAL: BUSCADOR Y NUEVOS ELEMENTOS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: '#374151' }}>
                  ➕ Buscar y Asociar
                </h4>
                
                <input
                  placeholder={targetTab === "productos" ? "🔍 Buscar producto por nombre..." : "🔍 Buscar categoría por nombre..."}
                  value={targetTab === "productos" ? productQuery : categoryQuery}
                  onChange={(event) => targetTab === "productos" ? setProductQuery(event.target.value) : setCategoryQuery(event.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '11px', outline: 'none' }}
                />

                <div style={{ overflowY: 'auto', maxHeight: '290px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {targetTab === "productos" ? (
                    availableProducts.map((product) => (
                      <div key={product.id_producto} style={{ background: '#ffffff', border: '1px solid #f3f4f6', borderRadius: '8px', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                        <div>
                          <strong>{product.nombre}</strong>
                          <div style={{ fontSize: '9px', color: '#6b7280' }}>{product.precio_venta} Bs</div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: '4px 10px', fontSize: '10px' }}
                          onClick={() => handleAttachProduct(product)}
                        >
                          Asociar
                        </button>
                      </div>
                    ))
                  ) : (
                    availableCategories.map((category) => (
                      <div key={category.id_categoria} style={{ background: '#ffffff', border: '1px solid #f3f4f6', borderRadius: '8px', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                        <strong>{category.nombre}</strong>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: '4px 10px', fontSize: '10px' }}
                          onClick={() => handleAttachCategory(category)}
                        >
                          Asociar
                        </button>
                      </div>
                    ))
                  )}
                  {targetTab === "productos" && availableProducts.length === 0 && (
                    <p style={{ margin: 0, padding: '20px 0', textAlign: 'center', color: '#9ca3af', fontSize: '11px' }}>No hay más productos disponibles.</p>
                  )}
                  {targetTab === "categorias" && availableCategories.length === 0 && (
                    <p style={{ margin: 0, padding: '20px 0', textAlign: 'center', color: '#9ca3af', fontSize: '11px' }}>No hay más categorías disponibles.</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* MODAL: CARGADOR DE BANNER */}
      {bannerOffer && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }} onClick={() => setBannerOffer(null)}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            width: '100%',
            maxWidth: '550px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }} onClick={(e) => e.stopPropagation()}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3f4f6', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#111827' }}>🖼️ Banner Promocional: {bannerOffer.nombre}</h3>
              <button onClick={() => setBannerOffer(null)} style={{ border: 'none', background: '#f3f4f6', cursor: 'pointer', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#6b7280' }}>✕</button>
            </div>

            {bannerOffer.banner_url ? (
              <div className="banner-preview" style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#6b7280', margin: '0 0 6px 0', textAlign: 'left' }}>Vista previa actual:</p>
                <img
                  src={getImageSrc(bannerOffer.banner_url)}
                  alt="Banner"
                  style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #e5e7eb' }}
                />
              </div>
            ) : (
              <div style={{ background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: '10px', padding: '30px 10px', textAlign: 'center', color: '#9ca3af', fontSize: '11px' }}>
                Esta oferta aún no tiene un banner asignado para el carrusel de la tienda virtual.
              </div>
            )}

            <ImageDropZone
              title="Cargar imagen de banner"
              subtitle="Formatos recomendados: JPG, PNG o WEBP (diseño horizontal)"
              statusText={bannerUploading === bannerOffer.id_oferta ? "Subiendo archivo..." : ""}
              disabled={bannerUploading === bannerOffer.id_oferta}
              onFileSelected={handleBannerUpload}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #f3f4f6', paddingTop: '12px', marginTop: '4px' }}>
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
    </>
  );
}
