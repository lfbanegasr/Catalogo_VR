import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../../api';
import { Card } from '../Card';
import StoreRefPicker from '../StoreRefPicker';
import ImageDropZone from '../ImageDropZone';
import { getImageSrc } from '../../utils';
import { ToastStack } from '../Toast';
import ProductCoverEditor, { categoryCoverDefaults } from './ProductCoverEditor';
import ProductPicker from './ProductPicker';

const CATEGORY_FORM_DEFAULTS = {
  nombre: "",
  id_categoria_padre: null,
  orden: 0,
  activa: true,
  imagen_fit_default: "cover",
  imagen_posicion_x_default: 50,
  imagen_posicion_y_default: 30,
  imagen_zoom_default: 100,
  imagen_fondo_default: "#F8F5F2",
};

const PRODUCT_FORM_DEFAULTS = {
  tipo_producto: "SIMPLE",
  componentes: [],
  nombre: "",
  descripcion: "",
  precio_venta: 0,
  stock_actual: 0,
  id_categoria_principal: "",
  imagen_fit: null,
  imagen_posicion_x: null,
  imagen_posicion_y: null,
  imagen_zoom: null,
  imagen_fondo: null,
  activo: true,
};

function CategoryCoverDefaultsFields({ value, onChange }) {
  const update = (key, next) => onChange({ ...value, [key]: next });
  return (
    <section className="category-cover-defaults">
      <header><strong>Portadas de esta categoría</strong><span>Los productos heredarán este ajuste mientras no tengan uno individual.</span></header>
      <label>Modo predeterminado
        <select value={value.imagen_fit_default || "cover"} onChange={(event) => update("imagen_fit_default", event.target.value)}>
          <option value="cover">Rellenar el cuadro</option>
          <option value="contain">Mostrar imagen completa</option>
          <option value="auto">Automático según proporción</option>
        </select>
      </label>
      <label className="category-cover-color">Color de fondo
        <input type="color" value={value.imagen_fondo_default || "#F8F5F2"} onChange={(event) => update("imagen_fondo_default", event.target.value.toUpperCase())} />
      </label>
      <label className="cover-range-control"><span><strong>Posición horizontal</strong><output>{value.imagen_posicion_x_default ?? 50}%</output></span><input type="range" min="0" max="100" value={value.imagen_posicion_x_default ?? 50} onChange={(event) => update("imagen_posicion_x_default", Number(event.target.value))} /></label>
      <label className="cover-range-control"><span><strong>Posición vertical</strong><output>{value.imagen_posicion_y_default ?? 30}%</output></span><input type="range" min="0" max="100" value={value.imagen_posicion_y_default ?? 30} onChange={(event) => update("imagen_posicion_y_default", Number(event.target.value))} /></label>
      <label className="cover-range-control"><span><strong>Zoom</strong><output>{value.imagen_zoom_default ?? 100}%</output></span><input type="range" min="80" max="200" value={value.imagen_zoom_default ?? 100} onChange={(event) => update("imagen_zoom_default", Number(event.target.value))} /></label>
    </section>
  );
}

function SetComponentsEditor({
  value = [],
  onChange,
  products,
  categoryOptions = [],
  excludeProductId = "",
}) {
  const [variantsByProduct, setVariantsByProduct] = useState({});
  const [pickerTargetIndex, setPickerTargetIndex] = useState(null);
  const candidates = useMemo(
    () => (products || []).filter(
      (product) => product.activo
        && product.tipo_producto !== "SET"
        && product.id_producto !== excludeProductId,
    ),
    [products, excludeProductId],
  );

  useEffect(() => {
    const selectedIds = [...new Set(
      value.map((item) => item.id_producto_componente).filter(Boolean),
    )];
    selectedIds.forEach((productId) => {
      const product = candidates.find((item) => item.id_producto === productId);
      if (!product?.tiene_variantes || variantsByProduct[productId]) return;
      api.listVariantes(productId)
        .then((variants) => {
          setVariantsByProduct((current) => ({
            ...current,
            [productId]: (variants || []).filter((variant) => variant.activa),
          }));
        })
        .catch(() => {
          setVariantsByProduct((current) => ({ ...current, [productId]: [] }));
        });
    });
  }, [value, candidates, variantsByProduct]);

  const updateComponent = (index, changes) => {
    onChange(value.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...changes } : item
    )));
  };

  const selectProduct = (product) => {
    const nextComponent = {
      id_producto_componente: product.id_producto,
      id_variante_componente: null,
      cantidad: 1,
    };
    if (pickerTargetIndex === -1) {
      onChange([...value, nextComponent]);
    } else {
      onChange(value.map((item, index) => (
        index === pickerTargetIndex
          ? { ...nextComponent, id_componente: item.id_componente }
          : item
      )));
    }
    setPickerTargetIndex(null);
  };

  const totalUnits = value.reduce(
    (total, item) => total + Number(item.cantidad || 0),
    0,
  );
  const categoryMap = useMemo(
    () => new Map(categoryOptions.map((category) => [
      String(category.id_categoria),
      category.label || category.nombre,
    ])),
    [categoryOptions],
  );
  const availability = value.map((componentItem) => {
    const product = candidates.find(
      (item) => item.id_producto === componentItem.id_producto_componente,
    );
    const variants = variantsByProduct[componentItem.id_producto_componente] || [];
    const variant = variants.find(
      (item) => item.id_variante === componentItem.id_variante_componente,
    );
    const requiresVariant = Boolean(product?.tiene_variantes);
    const ready = Boolean(product) && (!requiresVariant || Boolean(variant));
    const availableStock = ready
      ? Number(variant?.stock_actual ?? product?.stock_actual ?? 0)
      : 0;
    const quantity = Math.max(1, Number(componentItem.cantidad || 1));
    return { product, variants, variant, requiresVariant, ready, availableStock, quantity };
  });
  const estimatedStock = availability.length > 0
    ? Math.min(...availability.map((item) => Math.floor(item.availableStock / item.quantity)))
    : 0;
  const hasIncompleteComponent = availability.some((item) => !item.ready);

  return (
    <section className="set-components-editor">
      <div className="set-components-head">
        <div>
          <strong>Productos incluidos ({value.length})</strong>
          <span>El inventario se calcula desde estos productos.</span>
        </div>
        <div className={"set-stock-summary " + (hasIncompleteComponent ? "is-incomplete" : "")}>
          <span>Stock estimado</span>
          <strong>{estimatedStock} {estimatedStock === 1 ? "set" : "sets"}</strong>
        </div>
      </div>
      {value.map((componentItem, index) => {
        const {
          product,
          variants,
          variant,
          requiresVariant,
          availableStock,
          quantity,
        } = availability[index];
        const productCategoryId = String(
          product?.id_categoria_principal || product?.id_categoria || "",
        );
        return (
          <div className="set-component-row" key={componentItem.id_componente || index}>
            <div className="set-component-product">
              <span className="set-component-thumb">
                {product?.imagen_url ? (
                  <img src={getImageSrc(product.imagen_url)} alt="" />
                ) : (
                  <span>{String(product?.nombre || componentItem.nombre_producto || "P").slice(0, 1).toUpperCase()}</span>
                )}
              </span>
              <div>
                <strong>{product?.nombre || componentItem.nombre_producto || "Producto no disponible"}</strong>
                <small>{categoryMap.get(productCategoryId) || "Sin categoria"}</small>
              </div>
              <button type="button" className="btn-link" onClick={() => setPickerTargetIndex(index)}>
                Cambiar
              </button>
            </div>

            {requiresVariant ? (
              <label className="set-component-variant">Variante incluida
                <select
                  required
                  value={componentItem.id_variante_componente || ""}
                  onChange={(event) => updateComponent(index, {
                    id_variante_componente: event.target.value || null,
                  })}
                >
                  <option value="">Selecciona una variante</option>
                  {variants.map((option) => (
                    <option key={option.id_variante} value={option.id_variante}>
                      {(option.atributos || []).map((item) => item.valor).join(" / ")
                        || option.sku} - stock {option.stock_actual}
                    </option>
                  ))}
                </select>
              </label>
            ) : <span className="set-component-no-variant">Sin variantes</span>}

            <div className="set-quantity-control" aria-label="Cantidad incluida">
              <span>Cantidad</span>
              <div>
                <button
                  type="button"
                  disabled={quantity <= 1}
                  onClick={() => updateComponent(index, { cantidad: Math.max(1, quantity - 1) })}
                  aria-label="Reducir cantidad"
                >-</button>
                <input
                  type="number"
                  min="1"
                  required
                  value={quantity}
                  onChange={(event) => updateComponent(index, {
                    cantidad: Math.max(1, Number(event.target.value || 1)),
                  })}
                />
                <button
                  type="button"
                  onClick={() => updateComponent(index, { cantidad: quantity + 1 })}
                  aria-label="Aumentar cantidad"
                >+</button>
              </div>
            </div>

            <div className={"set-component-availability " + (requiresVariant && !variant ? "is-warning" : "")}>
              <span>{requiresVariant && !variant ? "Falta seleccionar variante" : "Disponible"}</span>
              <strong>{requiresVariant && !variant ? "-" : availableStock}</strong>
            </div>
            <button
              type="button"
              className="set-remove-component"
              onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
              aria-label={"Quitar " + (product?.nombre || "producto")}
            >
              x
            </button>
          </div>
        );
      })}
      {value.length === 0 ? (
        <div className="set-components-empty">
          <strong>Aun no agregaste productos</strong>
          <span>Elige al menos dos unidades para formar el set.</span>
        </div>
      ) : null}
      <div className="set-components-footer">
        <button
          type="button"
          className="btn btn-primary-ghost"
          disabled={value.length >= candidates.length}
          onClick={() => setPickerTargetIndex(-1)}
        >
          + Agregar otro producto
        </button>
        <span className={totalUnits < 2 || hasIncompleteComponent ? "text-danger small" : "muted small"}>
          {hasIncompleteComponent
            ? "Selecciona la variante exacta de cada producto."
            : totalUnits < 2
              ? "El set debe incluir al menos 2 unidades en total."
              : totalUnits + " unidades incluidas en total."}
        </span>
      </div>
      <ProductPicker
        open={pickerTargetIndex !== null}
        products={candidates}
        categoryOptions={categoryOptions}
        selectedIds={value
          .filter((_, index) => index !== pickerTargetIndex)
          .map((item) => item.id_producto_componente)}
        title={pickerTargetIndex === -1 ? "Agregar producto al set" : "Cambiar producto del set"}
        onSelect={selectProduct}
        onClose={() => setPickerTargetIndex(null)}
      />
    </section>
  );
}

export default function CatalogoScreen({ isSuperadmin }) {
  const editorRef = useRef(null);

  const handleOpenCreateForm = () => {
    setEditing(null);
    resetFormForTab(tab);
    setPendingImageFile(null);
    setError("");
    setEditorOpen(true);
  };

  const closeEntityEditor = () => {
    if (isSaving) return;
    setEditorOpen(false);
    setEditing(null);
    setPendingImageFile(null);
  };
  const [tab, setTab] = useState("categorias");
  const [stores, setStores] = useState([]);
  const [ownStore, setOwnStore] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [rows, setRows] = useState([]);
  const [categoriasDisponibles, setCategoriasDisponibles] = useState([]);
  const [tenantId, setTenantId] = useState("");
  const [error, setError] = useState("");
  const [replacingImageUrl, setReplacingImageUrl] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState(null);
  const [busyImageProductId, setBusyImageProductId] = useState("");
  const [uploadMetaByProduct, setUploadMetaByProduct] = useState({});
  const [productQuery, setProductQuery] = useState("");
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [showRemoved, setShowRemoved] = useState(false);
  const [attributeForm, setAttributeForm] = useState({
    nombre: "",
    tipo_dato: "OPTION",
    unidad: "",
    permite_multiples: false,
    usable_en_variantes: false,
    activo: true,
  });
  const [attributeCategoryId, setAttributeCategoryId] = useState("");
  const [selectedCategoryAttributeIds, setSelectedCategoryAttributeIds] = useState([]);
  const [variantCategoryAttributeIds, setVariantCategoryAttributeIds] = useState([]);
  const [editingProductAttributeConfig, setEditingProductAttributeConfig] = useState([]);
  const [editingProductAttributeValues, setEditingProductAttributeValues] = useState({});
  const [editingVariants, setEditingVariants] = useState([]);
  const [variantBusy, setVariantBusy] = useState(false);
  const [busyVariantImageId, setBusyVariantImageId] = useState("");
  const [variantForm, setVariantForm] = useState({
    sku: "",
    precio_venta: "",
    costo_adquisicion: "",
    stock_actual: 0,
    es_predeterminada: false,
    atributos: {},
  });
  const [form, setForm] = useState(tab === "categorias" ? { ...CATEGORY_FORM_DEFAULTS } : { ...PRODUCT_FORM_DEFAULTS });
  const [toasts, setToasts] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [coverEditor, setCoverEditor] = useState(null);
  const [coverEditorBusy, setCoverEditorBusy] = useState(false);
  const [pendingImagePreviewUrl, setPendingImagePreviewUrl] = useState("");
  const editorType = editing?.mode || (tab === "categorias" ? "categoria" : "producto");

  const pushToast = (message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, type }]);
    setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4000);
  };

  const dismissToast = (id) => setToasts((current) => current.filter((item) => item.id !== id));

  useEffect(() => {
    if (!pendingImageFile) {
      setPendingImagePreviewUrl("");
      return undefined;
    }
    const objectUrl = URL.createObjectURL(pendingImageFile);
    setPendingImagePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [pendingImageFile]);
  const categoryOptions = useMemo(() => {
    const byId = new Map(categoriasDisponibles.map((category) => [category.id_categoria, category]));
    const labelFor = (category) => {
      const names = [category.nombre];
      const visited = new Set([category.id_categoria]);
      let parentId = category.id_categoria_padre;
      while (parentId && byId.has(parentId) && !visited.has(parentId)) {
        visited.add(parentId);
        const parent = byId.get(parentId);
        names.unshift(parent.nombre);
        parentId = parent.id_categoria_padre;
      }
      return names.join(" > ");
    };
    return categoriasDisponibles.map((category) => ({
      ...category,
      label: labelFor(category),
    }));
  }, [categoriasDisponibles]);
  const categoriaMap = useMemo(
    () => new Map(categoryOptions.map((c) => [c.id_categoria, c.label])),
    [categoryOptions],
  );
  const selectedStore = useMemo(
    () => stores.find((store) => store.id_tienda === tenantId) || null,
    [stores, tenantId],
  );
  const selectedStoreRef = isSuperadmin
    ? selectedStore?.slug || selectedStore?.nombre_tienda || ""
    : undefined;
  const catalogStore = isSuperadmin ? selectedStore : ownStore;
  const catalogSlug = catalogStore?.slug || "";
  const publicCatalogUrl = useMemo(() => {
    if (!catalogSlug) return "";
    const configuredBase = String(import.meta.env.VITE_PUBLIC_CATALOG_URL || "").trim();
    const fallbackBase = import.meta.env.DEV ? "http://localhost:5173/" : window.location.origin;
    const url = new URL(configuredBase || fallbackBase, window.location.origin);
    url.search = "";
    url.hash = "";
    url.searchParams.set("slug", catalogSlug);
    return url.toString();
  }, [catalogSlug]);
  const filteredProductRows = useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    return rows.filter((product) => {
      if (!showRemoved && !product.activo) return false;
      if (categoriaFiltro) {
        const categoriaId = String(product.id_categoria_principal || product.id_categoria || "");
        if (categoriaId !== categoriaFiltro) return false;
      }
      if (!query) return true;
      const haystack = [
        product.nombre,
        product.descripcion,
        product.id_producto,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [rows, productQuery, categoriaFiltro, showRemoved]);
  const visibleCategoryRows = useMemo(
    () => rows.filter((category) => showRemoved || category.activa),
    [rows, showRemoved],
  );
  const productSuggestions = useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    if (!query) return [];
    const unique = new Set();
    const matches = [];
    for (const product of rows.filter((item) => showRemoved || item.activo)) {
      const label = String(product.nombre || "").trim();
      if (!label) continue;
      if (label.toLowerCase().includes(query) && !unique.has(label.toLowerCase())) {
        unique.add(label.toLowerCase());
        matches.push(label);
      }
      if (matches.length >= 6) break;
    }
    return matches;
  }, [rows, productQuery, showRemoved]);
  const variantAttributeConfig = useMemo(
    () => editingProductAttributeConfig.filter(
      (config) =>
        config.usado_en_variantes
        && config.atributo?.usable_en_variantes
        && config.atributo?.tipo_dato === "OPTION",
    ),
    [editingProductAttributeConfig],
  );
  const missingVariantCombinations = useMemo(() => {
    const optionGroups = variantAttributeConfig.map((config) => ({
      id_atributo: config.id_atributo,
      options: (config.atributo?.opciones || []).filter((option) => option.activo),
    }));
    if (optionGroups.length === 0 || optionGroups.some((group) => group.options.length === 0)) {
      return [];
    }
    const combinations = optionGroups.reduce(
      (current, group) => current.flatMap((combination) => group.options.map((option) => ([
        ...combination,
        { id_atributo: group.id_atributo, id_opcion: option.id_opcion },
      ]))),
      [[]],
    );
    const combinationKey = (attributes) => attributes
      .map((attribute) => String(attribute.id_atributo) + ":" + String(attribute.id_opcion))
      .sort()
      .join("|");
    const existingKeys = new Set(
      editingVariants.map((variant) => combinationKey(variant.atributos || [])),
    );
    return combinations.filter((combination) => !existingKeys.has(combinationKey(combination)));
  }, [editingVariants, variantAttributeConfig]);

  const assertStoreSelected = () => {
    if (isSuperadmin && !selectedStoreRef) {
      throw new Error("Selecciona una tienda");
    }
  };
  const validateSetComposition = (components = []) => {
    const totalUnits = components.reduce(
      (total, item) => total + Number(item.cantidad || 0),
      0,
    );
    if (totalUnits < 2) {
      throw new Error("El set debe incluir al menos 2 unidades en total.");
    }
    for (const component of components) {
      const product = rows.find(
        (item) => item.id_producto === component.id_producto_componente,
      );
      if (!product || !product.activo) {
        throw new Error("Uno de los productos del set ya no esta disponible.");
      }
      if (product.tiene_variantes && !component.id_variante_componente) {
        throw new Error("Selecciona la variante exacta de " + product.nombre + ".");
      }
    }
  };
  const copyCatalogUrl = async () => {
    if (!publicCatalogUrl) return;
    try {
      await navigator.clipboard.writeText(publicCatalogUrl);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2200);
    } catch {
      setError("No se pudo copiar el enlace. Selecciónalo y cópialo manualmente.");
    }
  };

  const catalogSharePanel = (
    <div className="catalog-share">
      <div className="catalog-share-summary">
        <span className="catalog-share-icon" aria-hidden="true">↗</span>
        <div>
          <strong>Compartir catálogo</strong>
          <small>{catalogSlug ? `Enlace público de ${catalogStore?.nombre_tienda || catalogSlug}` : "Selecciona una tienda para generar el enlace"}</small>
        </div>
      </div>
      <button
        type="button"
        className="btn btn-ghost catalog-share-toggle"
        disabled={!catalogSlug}
        onClick={() => setShareOpen((current) => !current)}
      >
        {shareOpen ? "Ocultar enlace" : "Obtener enlace"}
      </button>
      {shareOpen && publicCatalogUrl ? (
        <div className="catalog-share-panel">
          <label>
            Enlace de la tienda
            <input value={publicCatalogUrl} readOnly onFocus={(event) => event.target.select()} />
          </label>
          <div className="catalog-share-actions">
            <button type="button" className="btn btn-primary" onClick={copyCatalogUrl}>{shareCopied ? "¡Copiado!" : "Copiar enlace"}</button>
            <button type="button" className="btn btn-ghost" onClick={() => window.open(publicCatalogUrl, "_blank", "noopener,noreferrer")}>Ver catálogo</button>
          </div>
        </div>
      ) : null}
    </div>
  );

  const findProductCategory = (product) => {
    const categoryId = product?.id_categoria_principal || product?.id_categoria || "";
    return categoriasDisponibles.find((item) => String(item.id_categoria) === String(categoryId)) || null;
  };

  const getAdminCoverAdjustment = (product) => {
    const defaults = categoryCoverDefaults(findProductCategory(product));
    const fit = product?.imagen_fit || defaults.fit;
    return {
      backgroundColor: product?.imagen_fondo || defaults.background,
      imageStyle: {
        objectFit: fit === "auto" ? "contain" : fit,
        objectPosition: `${product?.imagen_posicion_x ?? defaults.positionX}% ${product?.imagen_posicion_y ?? defaults.positionY}%`,
        transform: `scale(${(product?.imagen_zoom ?? defaults.zoom) / 100})`,
      },
    };
  };

  const openProductCoverEditor = (product, options = {}) => {
    setCoverEditor({
      target: options.target || "existing",
      product,
      category: findProductCategory(product),
      file: options.file || null,
      imageUrl: options.imageUrl || (product?.imagen_url ? getImageSrc(product.imagen_url) : ""),
      replaceUrl: options.replaceUrl || "",
    });
  };

  const openVariantCoverEditor = (variant, options = {}) => {
    const parentProduct = editing?.row || {};
    const categoryDefaults = categoryCoverDefaults(findProductCategory(parentProduct));
    const inheritedDefaults = {
      nombre: "Portada general del producto",
      imagen_fit_default: parentProduct.imagen_fit || categoryDefaults.fit,
      imagen_posicion_x_default: parentProduct.imagen_posicion_x ?? categoryDefaults.positionX,
      imagen_posicion_y_default: parentProduct.imagen_posicion_y ?? categoryDefaults.positionY,
      imagen_zoom_default: parentProduct.imagen_zoom ?? categoryDefaults.zoom,

      imagen_fondo_default: parentProduct.imagen_fondo || categoryDefaults.background,
    };
    const variantName = (variant.atributos || []).map((item) => item.valor).join(" / ")
      || variant.sku
      || "Variante";
    setCoverEditor({
      target: "variant",
      variant,
      product: { ...variant, nombre: parentProduct.nombre + " - " + variantName },
      category: inheritedDefaults,
      file: options.file || null,
      imageUrl: options.imageUrl
        || getImageSrc(variant.imagen_url || parentProduct.imagen_url || ""),
      replaceUrl: "",
    });
  };


  const applyProductCover = async ({ file, payload }) => {
    if (!coverEditor) return;
    if (coverEditor.target === "new") {
      if (file) setPendingImageFile(file);
      setForm((current) => ({ ...current, ...payload }));
      setCoverEditor(null);
      pushToast("Portada preparada. Crea el producto para subirla.");
      return;
    }
    if (coverEditor.target === "variant") {
      const variantId = coverEditor.variant?.id_variante;
      if (!variantId) return;
      setCoverEditorBusy(true);
      setError("");
      try {
        if (file) {
          await api.uploadVarianteImage(variantId, file);
        }
        const updated = await api.updateVariante(variantId, payload);
        setEditingVariants((current) => current.map((item) => (
          item.id_variante === variantId ? updated : item
        )));
        await load();
        setCoverEditor(null);
        pushToast(file ? "Imagen de variante subida y ajustada" : "Ajuste de variante guardado");
      } catch (err) {
        const message = err.message || "No se pudo ajustar la imagen de la variante";
        setError(message);
        pushToast(message, "error");
      } finally {
        setCoverEditorBusy(false);
      }
      return;
    }

    const productId = coverEditor.product?.id_producto;
    if (!productId) return;
    setCoverEditorBusy(true);
    setError("");
    try {
      let imageResult = null;
      if (file && coverEditor.replaceUrl) {
        imageResult = await api.replaceProductoImage(productId, coverEditor.replaceUrl, file);
      } else if (file) {
        imageResult = await api.uploadProductoImage(productId, file);
      }
      const updated = await api.updateProducto(productId, payload, selectedStoreRef);
      const merged = {
        ...coverEditor.product,
        ...updated,
        ...(imageResult || {}),
        ...payload,
      };
      setRows((current) => current.map((item) => item.id_producto === productId ? merged : item));
      setEditing((current) => current?.row?.id_producto === productId
        ? { ...current, row: { ...current.row, ...merged } }
        : current);
      await load();
      setCoverEditor(null);
      pushToast(file ? "Portada subida y ajustada correctamente" : "Ajuste de portada guardado");
    } catch (err) {
      const message = err.message || "No se pudo aplicar el ajuste de portada";
      setError(message);
      pushToast(message, "error");
    } finally {
      setCoverEditorBusy(false);
    }
  };

  const toggleRowVisibility = async (row, mode) => {
    const isCategory = mode === "categoria";
    const isActive = isCategory ? row.activa : row.activo;
    if (isActive) {
      const label = isCategory ? "categoria" : "producto";
      const confirmed = window.confirm(
        `¿Ocultar esta ${label} del catálogo público? No se eliminarán sus datos y podrás volver a mostrarla cuando quieras.`,
      );
      if (!confirmed) return;
    }
    assertStoreSelected();
    if (isCategory) {
      await api.updateCategoria(
        row.id_categoria,
        { activa: !isActive },
        selectedStoreRef,
      );
    } else {
      await api.updateProducto(
        row.id_producto,
        { activo: !isActive },
        selectedStoreRef,
      );
    }
    await load();
  };
  const openProductEditor = async (product) => {
    const categoryId = product.id_categoria_principal || product.id_categoria || "";
    setEditing({
      mode: "producto",
      row: {
        ...product,
        id_categoria_principal: categoryId,
        imagenes: product.imagenes && product.imagenes.length > 0
          ? product.imagenes
          : (product.imagen_url ? [product.imagen_url] : []),
      },
    });
    setEditingProductAttributeConfig([]);
    setEditingProductAttributeValues({});
    setEditingVariants([]);
    setVariantForm({
      sku: "",
      precio_venta: "",
      costo_adquisicion: "",
      stock_actual: 0,
      es_predeterminada: false,
      atributos: {},
    });
    if (product.tipo_producto === "SET") return;

    try {
      const variantsPromise = api.listVariantes(product.id_producto);
      if (!categoryId) {
        setEditingVariants(await variantsPromise);
        return;
      }
      const [config, values, variants] = await Promise.all([
        api.listCategoriaAtributos(categoryId),
        api.listProductoAtributos(product.id_producto),
        variantsPromise,
      ]);
      setEditingProductAttributeConfig(config);
      setEditingVariants(variants);
      const valueMap = {};
      values.forEach((item) => {
        valueMap[item.id_atributo] = item.id_opcion || item.valor;
      });
      setEditingProductAttributeValues(valueMap);
    } catch (e) {
      setError(e.message);
    }
  };
  const buildProductAttributePayload = () =>
    editingProductAttributeConfig
      .filter((config) => {
        const value = editingProductAttributeValues[config.id_atributo];
        return value !== undefined && value !== null && value !== "";
      })
      .map((config) => {
        const attribute = config.atributo;
        const value = editingProductAttributeValues[config.id_atributo];
        if (attribute.tipo_dato === "OPTION") {
          return { id_atributo: attribute.id_atributo, id_opcion: value };
        }
        if (attribute.tipo_dato === "NUMBER") {
          return { id_atributo: attribute.id_atributo, valor_numero: Number(value) };
        }
        if (attribute.tipo_dato === "BOOLEAN") {
          return {
            id_atributo: attribute.id_atributo,
            valor_booleano: value === true || value === "true",
          };
        }
        return { id_atributo: attribute.id_atributo, valor_texto: String(value) };
      });

  const createEditingVariant = async () => {
    if (!editing?.row?.id_producto) return;
    const atributos = variantAttributeConfig.map((config) => ({
      id_atributo: config.id_atributo,
      id_opcion: variantForm.atributos[config.id_atributo],
    }));
    if (atributos.length === 0 || atributos.some((item) => !item.id_opcion)) {
      throw new Error("Selecciona una opcion para cada atributo de la variante.");
    }
    const optionalNumber = (value) => value === "" || value == null ? null : Number(value);
    setVariantBusy(true);
    try {
      await api.createVariante(editing.row.id_producto, {
        sku: variantForm.sku.trim() || null,
        precio_venta: optionalNumber(variantForm.precio_venta),
        costo_adquisicion: optionalNumber(variantForm.costo_adquisicion),
        stock_actual: Number(variantForm.stock_actual || 0),
        es_predeterminada: variantForm.es_predeterminada,
        atributos,
      });
      setEditingVariants(await api.listVariantes(editing.row.id_producto));
      setVariantForm({
        sku: "",
        precio_venta: "",
        costo_adquisicion: "",
        stock_actual: 0,
        es_predeterminada: false,
        atributos: {},
      });
    } finally {
      setVariantBusy(false);
    }
  };

  const createMissingVariantCombinations = async () => {
    if (!editing?.row?.id_producto) return;
    if (missingVariantCombinations.length === 0) {
      throw new Error("No hay combinaciones nuevas para crear.");
    }
    if (missingVariantCombinations.length > 50) {
      throw new Error("Hay demasiadas combinaciones. Reduce las opciones antes de continuar.");
    }
    if (missingVariantCombinations.length > 12 && !window.confirm(
      "Se crearan " + missingVariantCombinations.length + " variantes. Deseas continuar?",
    )) {
      return;
    }
    const optionalNumber = (value) => value === "" || value == null ? null : Number(value);
    setVariantBusy(true);
    try {
      for (const [index, atributos] of missingVariantCombinations.entries()) {
        await api.createVariante(editing.row.id_producto, {
          sku: null,
          precio_venta: optionalNumber(variantForm.precio_venta),
          costo_adquisicion: optionalNumber(variantForm.costo_adquisicion),
          stock_actual: Number(variantForm.stock_actual || 0),
          es_predeterminada: editingVariants.length === 0 && index === 0,
          atributos,
        });
      }
      const refreshedVariants = await api.listVariantes(editing.row.id_producto);
      setEditingVariants(refreshedVariants);
      await load();
      pushToast("Combinaciones de variantes creadas correctamente");
    } catch (err) {
      const message = err.message || "No se pudieron crear todas las combinaciones";
      setError(message);
      pushToast(message, "error");
    } finally {
      setVariantBusy(false);
    }
  };

  const saveEditingVariant = async (variant) => {
    const optionalNumber = (value) => value === "" || value == null ? null : Number(value);
    setVariantBusy(true);
    try {
      await api.updateVariante(variant.id_variante, {
        sku: variant.sku,
        precio_venta: optionalNumber(variant.precio_venta),
        costo_adquisicion: optionalNumber(variant.costo_adquisicion),
        stock_actual: Number(variant.stock_actual || 0),
        activa: Boolean(variant.activa),
        es_predeterminada: Boolean(variant.es_predeterminada),
      });
      setEditingVariants(await api.listVariantes(editing.row.id_producto));
    } finally {
      setVariantBusy(false);
    }
  };

  const uploadVariantImage = async (variant, file) => {
    if (!file || !variant?.id_variante) return;
    setBusyVariantImageId(variant.id_variante);
    try {
      const updated = await api.uploadVarianteImage(variant.id_variante, file);
      setEditingVariants((current) => current.map((item) => (
        item.id_variante === variant.id_variante ? updated : item
      )));
      await load();
    } finally {
      setBusyVariantImageId("");
    }
  };

  const resetFormForTab = (nextTab) =>
    setForm(nextTab === "categorias" ? { ...CATEGORY_FORM_DEFAULTS } : { ...PRODUCT_FORM_DEFAULTS });

  const loadStores = async () => {
    if (!isSuperadmin) {
      setOwnStore(await api.adminGetMyStore());
      return;
    }
    const data = await api.adminListTiendas();
    setStores(data);
    if (!tenantId && data[0]?.id_tienda) {
      setTenantId(data[0].id_tienda);
    }
  };

  const load = async () => {
    if (isSuperadmin && !selectedStoreRef) {
      setRows([]);
      setCategoriasDisponibles([]);
      return;
    }
    const data = tab === "categorias"
      ? await api.listCategorias(selectedStoreRef)
      : tab === "atributos"
        ? await api.listAtributos(selectedStoreRef)
        : await api.listProductos(selectedStoreRef);
    setRows(data);
    if (tab === "categorias") {
      setCategoriasDisponibles(data);
      return;
    }
    if (tab === "atributos") {
      const categorias = await api.listCategorias(selectedStoreRef);
      setCategoriasDisponibles(categorias);
      return;
    }
    const categorias = await api.listCategorias(selectedStoreRef);
    setCategoriasDisponibles(categorias);
  };

  const handleReload = async () => {
    setError("");
    if (isSuperadmin) {
      await loadStores();
    }
    await load();
  };

  const uploadImage = async (idProducto, file) => {
    if (!file || !idProducto) return;
    setBusyImageProductId(idProducto);
    setUploadMetaByProduct((prev) => ({
      ...prev,
      [idProducto]: {
        fileName: file.name,
        status: "Subiendo imagen...",
        error: "",
      },
    }));
    try {
      const payload = await api.uploadProductoImage(idProducto, file);
      await load();
      setUploadMetaByProduct((prev) => ({
        ...prev,
        [idProducto]: {
          fileName: file.name,
          status: "Imagen guardada",
          error: "",
        },
      }));
      return payload;
    } finally {
      setBusyImageProductId("");
    }
  };

  const handleMoveImage = async (index, direction) => {
    if (!editing || !editing.row) return;
    const imgs = [...(editing.row.imagenes || [])];
    if (direction === 'left' && index > 0) {
      [imgs[index], imgs[index - 1]] = [imgs[index - 1], imgs[index]];
    } else if (direction === 'right' && index < imgs.length - 1) {
      [imgs[index], imgs[index + 1]] = [imgs[index + 1], imgs[index]];
    } else {
      return;
    }
    
    try {
      setError("");
      setEditing((prev) => ({
        ...prev,
        row: { ...prev.row, imagenes: imgs, imagen_url: imgs[0] }
      }));
      
      const result = await api.reorderProductoImages(editing.row.id_producto, imgs);
      if (result) {
        setEditing((prev) => ({
          ...prev,
          row: { 
            ...prev.row, 
            imagenes: result.imagenes || [result.imagen_url], 
            imagen_url: result.imagen_url 
          }
        }));
      }
      await load();
    } catch (err) {
      setError(err.message || "Error al cambiar el orden de las imágenes");
    }
  };

  const handleDeleteImage = async (url) => {
    if (!editing || !editing.row) return;
    if (!window.confirm("¿Estás seguro de que deseas eliminar esta imagen de forma permanente?")) return;
    
    try {
      setError("");
      setBusyImageProductId(editing.row.id_producto);
      const result = await api.deleteProductoImage(editing.row.id_producto, url);
      if (result) {
        setEditing((prev) => ({
          ...prev,
          row: { 
            ...prev.row, 
            imagenes: result.imagenes || [result.imagen_url], 
            imagen_url: result.imagen_url 
          }
        }));
      }
      await load();
    } catch (err) {
      setError(err.message || "Error al eliminar la imagen");
    } finally {
      setBusyImageProductId("");
    }
  };

  useEffect(() => {
    loadStores().catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [tab, selectedStoreRef]);
  useEffect(() => {
    resetFormForTab(tab);
    setEditing(null);
    setEditorOpen(false);
    setPendingImageFile(null);
    setProductQuery("");
    setCategoriaFiltro("");
    setShowRemoved(false);
    if (tab !== "productos") {
      setProductSearchOpen(false);
    }
  }, [tab, selectedStoreRef]);
  useEffect(() => {
    if (tab !== "atributos" || !attributeCategoryId) {
      setSelectedCategoryAttributeIds([]);
      setVariantCategoryAttributeIds([]);
      return;
    }
    api.listCategoriaAtributos(attributeCategoryId)
      .then((items) => {
        setSelectedCategoryAttributeIds(items.map((item) => item.id_atributo));
        setVariantCategoryAttributeIds(
          items.filter((item) => item.usado_en_variantes).map((item) => item.id_atributo),
        );
      })
      .catch((e) => setError(e.message));
  }, [tab, attributeCategoryId, selectedStoreRef]);

  useEffect(() => {
    if (editing) setEditorOpen(true);
  }, [editing]);

  useEffect(() => {
    if (!editorOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      const firstInput = editorRef.current?.querySelector(
        "input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
      );
      firstInput?.focus();
    }, 100);
    const handleKeyDown = (event) => {
      if (
        event.key === "Escape"
        && !isSaving
        && !coverEditor
        && !document.querySelector(".product-picker-dialog")
      ) {
        closeEntityEditor();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [editorOpen, isSaving, coverEditor]);

  if (tab === "atributos") {
    return (
      <Card title="Atributos del catálogo" className="catalog-compact">
        {catalogSharePanel}
        <div className="catalog-toolbar">
          <div className="catalog-tabs">
            <button className="tab-btn" onClick={() => setTab("categorias")}>Categorias</button>
            <button className="tab-btn" onClick={() => setTab("productos")}>Productos</button>
            <button className="tab-btn active" onClick={() => setTab("atributos")}>Atributos</button>
          </div>
          <div className="catalog-controls">
            {isSuperadmin ? (
              <StoreRefPicker stores={stores} value={tenantId} onChange={setTenantId} required />
            ) : <div className="catalog-controls-spacer" />}
            <button className="btn btn-ghost" onClick={() => handleReload().catch((e) => setError(e.message))}>Recargar</button>
          </div>
        </div>
        {error ? <p className="error-text">{error}</p> : null}

        <div className="inline-editor">
          <h4>Crear atributo</h4>
          <form className="grid-form" onSubmit={async (event) => {
            event.preventDefault();
            try {
              assertStoreSelected();
              await api.createAtributo({
                ...attributeForm,
                unidad: attributeForm.unidad || null,
              }, selectedStoreRef);
              setAttributeForm({
                nombre: "",
                tipo_dato: "OPTION",
                unidad: "",
                permite_multiples: false,
                usable_en_variantes: false,
                activo: true,
              });
              await load();
            } catch (e) { setError(e.message); }
          }}>
            <label>Nombre<input required value={attributeForm.nombre} onChange={(e) => setAttributeForm((current) => ({ ...current, nombre: e.target.value }))} /></label>
            <label>Tipo<select value={attributeForm.tipo_dato} onChange={(e) => setAttributeForm((current) => ({ ...current, tipo_dato: e.target.value }))}>
              <option value="OPTION">Lista de opciones</option>
              <option value="TEXT">Texto</option>
              <option value="NUMBER">Numero</option>
              <option value="BOOLEAN">Si / No</option>
            </select></label>
            <label>Unidad opcional<input value={attributeForm.unidad} placeholder="cm, GB, kt..." onChange={(e) => setAttributeForm((current) => ({ ...current, unidad: e.target.value }))} /></label>
            <label className="check-row"><input type="checkbox" checked={attributeForm.permite_multiples} onChange={(e) => setAttributeForm((current) => ({ ...current, permite_multiples: e.target.checked }))} />Permitir varios valores</label>
            <label className="check-row"><input type="checkbox" checked={attributeForm.usable_en_variantes} onChange={(e) => setAttributeForm((current) => ({ ...current, usable_en_variantes: e.target.checked }))} />Usable en variantes</label>
            <button className="btn btn-primary">Crear atributo</button>
          </form>
        </div>

        <div className="table-wrap desktop-only">
          <table className="data-table">
            <thead><tr><th>Nombre</th><th>Tipo</th><th>Opciones</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {rows.map((attribute) => (
                <tr key={attribute.id_atributo}>
                  <td className="font-semibold">{attribute.nombre}</td>
                  <td>{attribute.tipo_dato}</td>
                  <td>{(attribute.opciones || []).map((option) => option.valor).join(", ") || "-"}</td>
                  <td><span className={attribute.activo ? "status-badge active" : "status-badge inactive"}>{attribute.activo ? "Activo" : "Inactivo"}</span></td>
                  <td className="actions-cell">
                    {attribute.tipo_dato === "OPTION" ? (
                      <button className="btn btn-ghost" onClick={async () => {
                        const value = window.prompt("Nueva opcion");
                        if (!value || !value.trim()) return;
                        try {
                          await api.createAtributoOpcion(attribute.id_atributo, { valor: value.trim() });
                          await load();
                        } catch (e) { setError(e.message); }
                      }}>Agregar opcion</button>
                    ) : null}
                    <button className="btn btn-ghost" onClick={async () => {
                      try {
                        await api.updateAtributo(attribute.id_atributo, { activo: !attribute.activo });
                        await load();
                      } catch (e) { setError(e.message); }
                    }}>{attribute.activo ? "Desactivar" : "Activar"}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="inline-editor">
          <h4>Configurar atributos por categoria</h4>
          <label>Categoria<select value={attributeCategoryId} onChange={(e) => setAttributeCategoryId(e.target.value)}>
            <option value="">Selecciona una categoria</option>
            {categoryOptions.map((category) => <option key={category.id_categoria} value={category.id_categoria}>{category.label}</option>)}
          </select></label>
          {attributeCategoryId ? (
            <div className="grid-form">
              {rows.filter((attribute) => attribute.activo).map((attribute) => {
                const selected = selectedCategoryAttributeIds.includes(attribute.id_atributo);
                const canBeVariant = attribute.usable_en_variantes && attribute.tipo_dato === "OPTION";
                return (
                  <div key={attribute.id_atributo}>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => {
                          setSelectedCategoryAttributeIds((current) => e.target.checked
                            ? [...current, attribute.id_atributo]
                            : current.filter((id) => id !== attribute.id_atributo));
                          if (!e.target.checked) {
                            setVariantCategoryAttributeIds((current) =>
                              current.filter((id) => id !== attribute.id_atributo));
                          }
                        }}
                      />
                      {attribute.nombre}
                    </label>
                    {selected && canBeVariant ? (
                      <label className="check-row muted small">
                        <input
                          type="checkbox"
                          checked={variantCategoryAttributeIds.includes(attribute.id_atributo)}
                          onChange={(e) => setVariantCategoryAttributeIds((current) => e.target.checked
                            ? [...current, attribute.id_atributo]
                            : current.filter((id) => id !== attribute.id_atributo))}
                        />
                        Usar para crear variantes
                      </label>
                    ) : null}
                  </div>
                );
              })}
              <button className="btn btn-primary" type="button" onClick={async () => {
                try {
                  const selected = selectedCategoryAttributeIds.map((id, index) => ({
                    id_atributo: id,
                    requerido: false,
                    filtrable: true,
                    usado_en_variantes: variantCategoryAttributeIds.includes(id),
                    orden: index,
                  }));
                  await api.replaceCategoriaAtributos(attributeCategoryId, selected);
                } catch (e) { setError(e.message); }
              }}>Guardar configuracion</button>
            </div>
          ) : <p className="muted">Selecciona una categoria para indicar sus caracteristicas.</p>}
        </div>
      </Card>
    );
  }

  return (
    <>
    <Card title="Catálogo privado" className="catalog-compact">
      {catalogSharePanel}
      <div className="catalog-toolbar">
        <div className="catalog-tabs">
          <button className={`tab-btn ${tab === "categorias" ? "active" : ""}`} onClick={() => setTab("categorias")}>Categorías</button>
          <button className={`tab-btn ${tab === "productos" ? "active" : ""}`} onClick={() => setTab("productos")}>Productos</button>
          <button className="tab-btn" onClick={() => setTab("atributos")}>Atributos</button>
        </div>
        <div className="catalog-controls">
          {tab !== "atributos" && (
            <button
              type="button"
              className="btn btn-primary create-action-btn"
              onClick={handleOpenCreateForm}
            >
              + {tab === "categorias" ? "Crear categoría" : "Crear producto"}
            </button>
          )}
          {isSuperadmin ? (
            <StoreRefPicker
              stores={stores}
              value={tenantId}
              onChange={setTenantId}
              required
            />
          ) : <div className="catalog-controls-spacer" />}
          <button className="btn btn-ghost catalog-refresh" onClick={() => handleReload().catch((e) => setError(e.message))}>Recargar</button>
          <label className="check-row show-removed-toggle">
            <input
              type="checkbox"
              checked={showRemoved}
              onChange={(event) => setShowRemoved(event.target.checked)}
            />
            Mostrar ocultos
          </label>
        </div>
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      {tab === "productos" ? (
        <div className="product-filters">
          <label>
            Buscar producto
            <div className="smart-search">
              <input
                value={productQuery}
                autoComplete="off"
                placeholder="Nombre, descripción o ID..."
                onFocus={() => setProductSearchOpen(true)}
                onBlur={() => window.setTimeout(() => setProductSearchOpen(false), 120)}
                onChange={(event) => setProductQuery(event.target.value)}
              />
              {productSearchOpen && productSuggestions.length > 0 ? (
                <div className="smart-search-list">
                  {productSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="smart-search-item"
                      onClick={() => {
                        setProductQuery(suggestion);
                        setProductSearchOpen(false);
                      }}
                    >
                      <span>{suggestion}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </label>
          <label>
            Categoría
            <select
              value={categoriaFiltro}
              onChange={(event) => setCategoriaFiltro(event.target.value)}
            >
              <option value="">Todas</option>
              {categoriasDisponibles.map((c) => (
                <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setProductQuery("");
              setCategoriaFiltro("");
            }}
          >
            Limpiar filtros
          </button>
        </div>
      ) : null}

      {/* --- VISTA DESKTOP: TABLA --- */}
      <div className="table-wrap desktop-only">
        <table>
          <thead>
            {tab === "categorias"
              ? <tr><th>ID</th><th>Nombre</th><th>Activa</th><th>Acciones</th></tr>
              : <tr><th>ID</th><th>Nombre</th><th>Precio</th><th>Stock</th><th>Activo</th><th>Imagen</th><th>Acciones</th></tr>}
          </thead>
          <tbody>
            {(tab === "productos" ? filteredProductRows : visibleCategoryRows).map((r) => {
              if (tab === "categorias") {
                if (!r.id_categoria) return null;
                return (
                  <tr key={r.id_categoria}>
                    <td className="small-id">{r.id_categoria.substring(0, 8)}...</td>
                    <td className="font-semibold">{r.nombre}</td>
                    <td>
                      <span className={`status-badge ${r.activa ? "active" : "inactive"}`}>
                        {r.activa ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button className="btn btn-ghost" onClick={() => setEditing({ mode: "categoria", row: r })}>Editar</button>
                      <button className={`btn ${r.activa ? "btn-danger-ghost" : "btn-success-ghost"}`} onClick={() => toggleRowVisibility(r, "categoria").catch((e) => setError(e.message))}>{r.activa ? "Ocultar" : "Mostrar"}</button>
                    </td>
                  </tr>
                );
              } else {
                if (!r.id_producto) return null;
                return (
                  <tr key={r.id_producto}>
                    <td className="small-id">{r.id_producto.substring(0, 8)}...</td>
                    <td className="font-semibold">{r.nombre}{r.tipo_producto === "SET" ? " (Set)" : ""}</td>
                    <td className="price-cell">{r.precio_venta} Bs.</td>
                    <td>
                      <span className={`stock-badge ${r.stock_actual <= 5 ? "low" : ""}`}>
                        {r.stock_actual}{r.tiene_variantes ? " total" : ""}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${r.activo ? "active" : "inactive"}`}>
                        {r.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td>
                      {r.imagen_url ? (
                        <div className="table-img-wrapper">
                          <img src={getImageSrc(r.imagen_url)} alt="" className="table-thumb" style={getAdminCoverAdjustment(r).imageStyle} />
                        </div>
                      ) : (
                        <span className="no-image-text">Sin imagen</span>
                      )}
                    </td>
                    <td className="actions-cell">
                      <button className="btn btn-ghost" onClick={() => openProductEditor(r)}>Editar</button>
                      <button className={`btn ${r.activo ? "btn-danger-ghost" : "btn-success-ghost"}`} onClick={() => toggleRowVisibility(r, "producto").catch((e) => setError(e.message))}>{r.activo ? "Ocultar" : "Mostrar"}</button>
                      <ImageDropZone
                        compact
                        title={busyImageProductId === r.id_producto ? "Subiendo..." : "Imagen"}
                        subtitle="Arrastra o selecciona"
                        selectedFileName={uploadMetaByProduct[r.id_producto]?.fileName || ""}
                        statusText={uploadMetaByProduct[r.id_producto]?.status || ""}
                        errorText={uploadMetaByProduct[r.id_producto]?.error || ""}
                        disabled={busyImageProductId === r.id_producto}
                        onFileSelected={(file) => openProductCoverEditor(r, {
                          file,
                          replaceUrl: r.imagenes?.[0] || r.imagen_url || "",
                        })}
                      />
                    </td>
                  </tr>
                );
              }
            })}
          </tbody>
        </table>
      </div>

      {/* --- VISTA MOBILE: TARJETAS --- */}
      <div className="mobile-only mobile-cards-grid">
        {tab === "categorias" ? (
          visibleCategoryRows.map((r) => {
            if (!r.id_categoria) return null;
            return (
              <div key={r.id_categoria} className="admin-card category-card">
                <div className="card-info">
                  <span className="card-id">ID: {r.id_categoria.substring(0, 8)}...</span>
                  <h4 className="card-name">{r.nombre}</h4>
                  <span className={`status-badge ${r.activa ? "active" : "inactive"}`}>
                    {r.activa ? "Activa" : "Inactiva"}
                  </span>
                </div>
                <div className="card-actions">
                  <button className="btn btn-ghost" onClick={() => setEditing({ mode: "categoria", row: r })}>Editar</button>
                  <button 
                    className={`btn ${r.activa ? "btn-danger-ghost" : "btn-success-ghost"}`} 
                    onClick={() => toggleRowVisibility(r, "categoria").catch((e) => setError(e.message))}
                  >
                    {r.activa ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          filteredProductRows.map((r) => {
            if (!r.id_producto) return null;
            return (
              <div key={r.id_producto} className="admin-card product-card">
                <div className="product-card-header">
                  <div className="product-card-img" style={{ backgroundColor: getAdminCoverAdjustment(r).backgroundColor }}>
                    {r.imagen_url ? (
                      <img src={getImageSrc(r.imagen_url)} alt={r.nombre} style={getAdminCoverAdjustment(r).imageStyle} />
                    ) : (
                      <div className="placeholder-img"><span className="icon">🛍️</span></div>
                    )}
                  </div>
                  <div className="product-card-main">
                    <span className="card-id">ID: {r.id_producto.substring(0, 8)}...</span>
                    <h4 className="card-name">{r.nombre}{r.tipo_producto === "SET" ? " (Set)" : ""}</h4>
                    <div className="product-card-metrics">
                      <span className="price-tag">{r.precio_venta} Bs.</span>
                      <span className={`stock-tag ${r.stock_actual <= 5 ? "low" : ""}`}>
                        {r.stock_actual} {r.tipo_producto === "SET" ? "sets disponibles" : r.tiene_variantes ? "entre variantes" : "en stock"}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="product-card-footer">
                  <span className={`status-badge ${r.activo ? "active" : "inactive"}`}>
                    {r.activo ? "Activo" : "Inactivo"}
                  </span>
                  <div className="card-actions">
                    <button className="btn btn-ghost" onClick={() => openProductEditor(r)}>
                      Editar
                    </button>
                    <button 
                      className={`btn ${r.activo ? "btn-danger-ghost" : "btn-success-ghost"}`} 
                      onClick={() => toggleRowVisibility(r, "producto").catch((e) => setError(e.message))}
                    >
                      {r.activo ? "Ocultar" : "Mostrar"}
                    </button>
                  </div>
                </div>
                
                <div className="product-card-image-upload">
                  <ImageDropZone
                    compact
                    title={busyImageProductId === r.id_producto ? "Subiendo..." : "Imagen"}
                    subtitle="Arrastra o selecciona"
                    selectedFileName={uploadMetaByProduct[r.id_producto]?.fileName || ""}
                    statusText={uploadMetaByProduct[r.id_producto]?.status || ""}
                    errorText={uploadMetaByProduct[r.id_producto]?.error || ""}
                    disabled={busyImageProductId === r.id_producto}
                    onFileSelected={(file) => openProductCoverEditor(r, {
                      file,
                      replaceUrl: r.imagenes?.[0] || r.imagen_url || "",
                    })}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {editorOpen ? (
        <div
          className={"catalog-editor-backdrop " + (editorType === "producto" ? "is-product" : "is-category")}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEntityEditor();
          }}
        >
          <section
            className={"catalog-entity-editor " + (editorType === "producto" ? "is-product" : "is-category")}
            ref={editorRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="catalog-editor-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="catalog-editor-head">
              <div>
                <span className="catalog-editor-eyebrow">{editorType === "categoria" ? "Organizacion del catalogo" : "Inventario y publicacion"}</span>
                <h2 id="catalog-editor-title">
                  {(editing ? "Editar " : "Crear ") + (editorType === "categoria" ? "categoria" : "producto")}
                </h2>
                <p>{editorType === "categoria"
                  ? "Define como se agrupan y presentan tus productos."
                  : "Completa la informacion y guarda cuando todo este listo."}</p>
              </div>
              <button type="button" className="icon-close-btn" onClick={closeEntityEditor} aria-label="Cerrar editor">x</button>
            </header>
            <div className="catalog-editor-body">
        {editing ? (
          <div className="grid-form catalog-editor-form">
            <label>Nombre<input value={editing.row.nombre || ""} onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, nombre: e.target.value } }))} /></label>
            {editing.mode === "categoria" ? (
              <>
                <label>Categoría padre<select value={editing.row.id_categoria_padre || ""} onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, id_categoria_padre: e.target.value || null } }))}><option value="">Categoría raíz</option>{categoryOptions.filter((c) => c.id_categoria !== editing.row.id_categoria).map((c) => <option key={c.id_categoria} value={c.id_categoria}>{c.label}</option>)}</select></label>
                <label>Orden<input type="number" min="0" value={editing.row.orden || 0} onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, orden: Number(e.target.value || 0) } }))} /></label>
                <CategoryCoverDefaultsFields value={editing.row} onChange={(row) => setEditing((current) => ({ ...current, row }))} />
                <label className="check-row"><input type="checkbox" checked={!!editing.row.activa} onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, activa: e.target.checked } }))} />Activa</label>
              </>
            ) : (
              <>
                <label>Descripción<textarea value={editing.row.descripcion || ""} onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, descripcion: e.target.value } }))} /></label>
                <label>Precio<input type="number" step="0.01" value={editing.row.precio_venta || 0} onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, precio_venta: e.target.value } }))} /></label>
                <label>{editing.row.tipo_producto === "SET" ? "Disponibilidad calculada" : editing.row.tiene_variantes ? "Stock total de variantes" : "Stock"}
                  <input
                    type="number"
                    value={editing.row.stock_actual || 0}
                    disabled={editing.row.tipo_producto === "SET" || editing.row.tiene_variantes}
                    title={editing.row.tipo_producto === "SET" ? "Se calcula desde los productos incluidos" : editing.row.tiene_variantes ? "Edita el stock individual de cada variante debajo" : undefined}
                    onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, stock_actual: e.target.value } }))}
                  />
                  {editing.row.tipo_producto === "SET" ? (
                    <small className="muted">Se calcula automaticamente segun la disponibilidad de los productos incluidos.</small>
                  ) : editing.row.tiene_variantes ? (
                    <small className="muted">Se calcula automáticamente. Edita cada variante debajo.</small>
                  ) : null}
                </label>
                {editing.row.tipo_producto === "SET" ? (
                  <label>Categoria<input value="Sets (asignada automaticamente)" disabled /></label>
                ) : (
                <label>Categoría<select value={editing.row.id_categoria_principal || editing.row.id_categoria || ""} onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, id_categoria_principal: e.target.value || null } }))}><option value="">Sin categoría</option>{categoryOptions.map((c) => <option key={c.id_categoria} value={c.id_categoria}>{c.label}</option>)}</select></label>
                )}
                {editing.row.tipo_producto === "SET" ? (
                  <SetComponentsEditor
                    value={editing.row.componentes || []}
                    onChange={(componentes) => setEditing((current) => ({
                      ...current,
                      row: { ...current.row, componentes },
                    }))}
                    products={rows}
                    categoryOptions={categoryOptions}
                    excludeProductId={editing.row.id_producto}
                  />
                ) : null}
                {editingProductAttributeConfig.length > 0 ? (
                  <div className="grid-form">
                    <strong>Caracteristicas del producto</strong>
                    {editingProductAttributeConfig.map((config) => {
                      const attribute = config.atributo;
                      const value = editingProductAttributeValues[attribute.id_atributo] ?? "";
                      if (attribute.tipo_dato === "OPTION") {
                        return (
                          <label key={attribute.id_atributo}>{attribute.nombre}
                            <select value={value} onChange={(e) => setEditingProductAttributeValues((current) => ({ ...current, [attribute.id_atributo]: e.target.value }))}>
                              <option value="">Sin especificar</option>
                              {(attribute.opciones || []).filter((option) => option.activo).map((option) => <option key={option.id_opcion} value={option.id_opcion}>{option.valor}</option>)}
                            </select>
                          </label>
                        );
                      }
                      if (attribute.tipo_dato === "BOOLEAN") {
                        return (
                          <label key={attribute.id_atributo}>{attribute.nombre}
                            <select value={String(value)} onChange={(e) => setEditingProductAttributeValues((current) => ({ ...current, [attribute.id_atributo]: e.target.value }))}>
                              <option value="">Sin especificar</option>
                              <option value="true">Si</option>
                              <option value="false">No</option>
                            </select>
                          </label>
                        );
                      }
                      return (
                        <label key={attribute.id_atributo}>{attribute.nombre}
                          <input
                            type={attribute.tipo_dato === "NUMBER" ? "number" : "text"}
                            step={attribute.tipo_dato === "NUMBER" ? "any" : undefined}
                            value={value}
                            onChange={(e) => setEditingProductAttributeValues((current) => ({ ...current, [attribute.id_atributo]: e.target.value }))}
                          />
                        </label>
                      );
                    })}
                  </div>
                ) : null}
                {/* --- NUEVO GESTOR DE IMÁGENES INTERACTIVO --- */}
                {editing.row.tipo_producto !== "SET" ? <div className="variant-manager">
                  <div className="image-manager-gallery-title">
                    <span>Variantes e inventario ({editingVariants.length})</span>
                    <span className="muted small">Cada combinacion mantiene su propio precio y stock</span>
                  </div>

                  {variantAttributeConfig.length > 0 ? (
                    <div className="grid-form">
                      <strong>Nueva variante</strong>
                      {variantAttributeConfig.map((config) => (
                        <label key={config.id_atributo}>{config.atributo.nombre}
                          <select
                            value={variantForm.atributos[config.id_atributo] || ""}
                            onChange={(e) => setVariantForm((current) => ({
                              ...current,
                              atributos: {
                                ...current.atributos,
                                [config.id_atributo]: e.target.value,
                              },
                            }))}
                          >
                            <option value="">Selecciona una opcion</option>
                            {(config.atributo.opciones || [])
                              .filter((option) => option.activo)
                              .map((option) => (
                                <option key={option.id_opcion} value={option.id_opcion}>
                                  {option.valor}
                                </option>
                              ))}
                          </select>
                        </label>
                      ))}
                      <label>SKU opcional
                        <input
                          value={variantForm.sku}
                          placeholder="Se genera automaticamente"
                          onChange={(e) => setVariantForm((current) => ({ ...current, sku: e.target.value }))}
                        />
                      </label>
                      <label>Precio opcional
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={variantForm.precio_venta}
                          placeholder="Usar precio del producto"
                          onChange={(e) => setVariantForm((current) => ({ ...current, precio_venta: e.target.value }))}
                        />
                      </label>
                      <label>Costo opcional
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={variantForm.costo_adquisicion}
                          onChange={(e) => setVariantForm((current) => ({ ...current, costo_adquisicion: e.target.value }))}
                        />
                      </label>
                      <label>Stock
                        <input
                          type="number"
                          min="0"
                          value={variantForm.stock_actual}
                          onChange={(e) => setVariantForm((current) => ({ ...current, stock_actual: e.target.value }))}
                        />
                      </label>
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={variantForm.es_predeterminada}
                          onChange={(e) => setVariantForm((current) => ({ ...current, es_predeterminada: e.target.checked }))}
                        />
                        Variante predeterminada
                      </label>
                      <button
                        className="btn btn-primary"
                        type="button"
                        disabled={variantBusy}
                        onClick={() => createEditingVariant().catch((e) => setError(e.message))}
                      >
                        {variantBusy ? "Guardando..." : "Crear variante"}
                      </button>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        disabled={variantBusy || missingVariantCombinations.length === 0}
                        onClick={() => createMissingVariantCombinations().catch((e) => setError(e.message))}
                      >
                        Crear combinaciones faltantes ({missingVariantCombinations.length})
                      </button>
                      <small className="muted">Usa el precio, costo y stock indicados arriba para todas las combinaciones nuevas.</small>
                    </div>
                  ) : (
                    <p className="muted small">
                      Configura en la pestana Atributos una opcion de la categoria y marca
                      "Usar para crear variantes".
                    </p>
                  )}

                  {editingVariants.length > 0 ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Combinacion</th>
                            <th>SKU</th>
                            <th>Imagen</th>
                            <th>Precio</th>
                            <th>Costo</th>
                            <th>Stock</th>
                            <th>Estado</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {editingVariants.map((variant) => (
                            <tr key={variant.id_variante}>
                              <td>{(variant.atributos || []).map((item) => item.valor).join(" / ")}</td>
                              <td>
                                <input
                                  value={variant.sku || ""}
                                  onChange={(e) => setEditingVariants((current) => current.map((item) =>
                                    item.id_variante === variant.id_variante ? { ...item, sku: e.target.value } : item))}
                                />
                              </td>
                              <td>
                                <div className="variant-image-editor">
                                  {variant.imagen_url ? (
                                    <img
                                      className="variant-admin-thumb"
                                      src={getImageSrc(variant.imagen_url)}
                                      alt={`Imagen de ${(variant.atributos || []).map((item) => item.valor).join(" / ")}`}
                                    />
                                  ) : (
                                    <span className="no-image-text">Usa la imagen general</span>
                                  )}
                                  <ImageDropZone
                                    compact
                                    title={busyVariantImageId === variant.id_variante ? "Subiendo..." : "Imagen de variante"}
                                    subtitle="Selecciona JPG, PNG o WEBP"
                                    disabled={busyVariantImageId === variant.id_variante}
                                    onFileSelected={(file) => openVariantCoverEditor(variant, { file })}
                                    statusText="Podras ajustar el encuadre antes de guardar"
                                  />
                                  <button
                                    type="button"
                                    className="btn btn-ghost variant-cover-button"
                                    disabled={busyVariantImageId === variant.id_variante}
                                    onClick={() => openVariantCoverEditor(variant)}
                                  >
                                    Ajustar encuadre
                                  </button>
                                </div>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={variant.precio_venta ?? ""}
                                  placeholder="Producto"
                                  onChange={(e) => setEditingVariants((current) => current.map((item) =>
                                    item.id_variante === variant.id_variante ? { ...item, precio_venta: e.target.value } : item))}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={variant.costo_adquisicion ?? ""}
                                  onChange={(e) => setEditingVariants((current) => current.map((item) =>
                                    item.id_variante === variant.id_variante ? { ...item, costo_adquisicion: e.target.value } : item))}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  value={variant.stock_actual}
                                  onChange={(e) => setEditingVariants((current) => current.map((item) =>
                                    item.id_variante === variant.id_variante ? { ...item, stock_actual: e.target.value } : item))}
                                />
                              </td>
                              <td>
                                <label className="check-row">
                                  <input
                                    type="checkbox"
                                    checked={variant.activa}
                                    onChange={(e) => setEditingVariants((current) => current.map((item) =>
                                      item.id_variante === variant.id_variante ? { ...item, activa: e.target.checked } : item))}
                                  />
                                  Activa
                                </label>
                                <label className="check-row">
                                  <input
                                    type="checkbox"
                                    checked={variant.es_predeterminada}
                                    onChange={(e) => setEditingVariants((current) => current.map((item) =>
                                      item.id_variante === variant.id_variante
                                        ? { ...item, es_predeterminada: e.target.checked }
                                        : { ...item, es_predeterminada: e.target.checked ? false : item.es_predeterminada }))}
                                  />
                                  Principal
                                </label>
                              </td>
                              <td>
                                <button
                                  className="btn btn-ghost"
                                  type="button"
                                  disabled={variantBusy}
                                  onClick={() => saveEditingVariant(variant).catch((e) => setError(e.message))}
                                >
                                  Guardar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div> : null}

                <div className="image-manager-gallery-wrapper">
                  <div className="image-manager-gallery-title">
                    <span>Imágenes del producto ({editing.row.imagenes?.length || 0})</span>
                    <span className="muted small">La primera imagen será la portada</span>
                    {editing.row.imagen_url ? (
                      <button type="button" className="btn btn-ghost" onClick={() => openProductCoverEditor(editing.row)}>
                        Ajustar portada
                      </button>
                    ) : null}
                  </div>
                  
                  {/* File input oculto para reemplazo de imágenes específicas */}
                  <input
                    id="replace-image-input"
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file || !replacingImageUrl) return;
                      const isCover = replacingImageUrl === (editing.row.imagenes?.[0] || editing.row.imagen_url);
                      if (isCover) {
                        openProductCoverEditor(editing.row, { file, replaceUrl: replacingImageUrl });
                        setReplacingImageUrl(null);
                        return;
                      }
                      try {
                        setError("");
                        setBusyImageProductId(editing.row.id_producto);
                        const result = await api.replaceProductoImage(editing.row.id_producto, replacingImageUrl, file);
                        if (result) {
                          setEditing((prev) => ({
                            ...prev,
                            row: {
                              ...prev.row,
                              imagenes: result.imagenes || [result.imagen_url],
                              imagen_url: result.imagen_url,
                            },
                          }));
                        }
                        await load();
                      } catch (err) {
                        setError(err.message || "Error al reemplazar imagen");
                      } finally {
                        setBusyImageProductId("");
                        setReplacingImageUrl(null);
                      }
                    }}
                  />

                  <div className="image-manager-gallery">
                    {editing.row.imagenes && editing.row.imagenes.length > 0 ? (
                      editing.row.imagenes.map((url, index) => (
                        <div key={url} className="image-manager-item">
                          <img src={getImageSrc(url)} alt={`Imagen ${index + 1}`} />
                          
                          {index === 0 && (
                            <span className="image-manager-badge">Portada</span>
                          )}
                          
                          <div className="image-manager-overlay">
                            <div className="image-manager-actions-top">
                              <button
                                type="button"
                                className="image-manager-btn btn-danger"
                                title="Eliminar imagen"
                                onClick={() => handleDeleteImage(url)}
                              >
                                🗑️
                              </button>
                            </div>
                            
                            <div className="image-manager-actions-bottom">
                              <button
                                type="button"
                                className="image-manager-btn"
                                title="Mover izquierda"
                                disabled={index === 0}
                                onClick={() => handleMoveImage(index, 'left')}
                              >
                                ◀
                              </button>
                              
                              <button
                                type="button"
                                className="image-manager-btn"
                                title="Reemplazar imagen"
                                onClick={() => {
                                  setReplacingImageUrl(url);
                                  document.getElementById('replace-image-input').click();
                                }}
                              >
                                🔄
                              </button>
                              
                              <button
                                type="button"
                                className="image-manager-btn"
                                title="Mover derecha"
                                disabled={index === editing.row.imagenes.length - 1}
                                onClick={() => handleMoveImage(index, 'right')}
                              >
                                ▶
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="image-manager-empty">
                        No hay imágenes en este producto.
                      </div>
                    )}
                  </div>
                </div>

                <ImageDropZone
                  title="Agregar nueva imagen"
                  subtitle="Arrastra y suelta o selecciona archivo para añadir"
                  disabled={busyImageProductId === editing.row.id_producto}
                  onFileSelected={async (file) => {
                    const hasCover = Boolean(editing.row.imagenes?.length || editing.row.imagen_url);
                    if (!hasCover) {
                      openProductCoverEditor(editing.row, { file });
                      return;
                    }
                    try {
                      setError("");
                      const result = await uploadImage(editing.row.id_producto, file);
                      if (result) {
                        setEditing((prev) => ({
                          ...prev,
                          row: {
                            ...prev.row,
                            imagenes: result.imagenes || [result.imagen_url],
                            imagen_url: result.imagen_url,
                          },
                        }));
                      }
                    } catch (err) {
                      setError(err.message || "Error al subir la imagen");
                    }
                  }}
                />
                <label className="check-row"><input type="checkbox" checked={!!editing.row.activo} onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, activo: e.target.checked } }))} />Activo</label>
              </>
            )}
            <div className="row catalog-editor-actions">
              <button className="btn btn-primary" disabled={isSaving} style={{ opacity: isSaving ? 0.6 : 1, cursor: isSaving ? 'not-allowed' : 'pointer' }} onClick={async () => {
                if (isSaving) return;
                setIsSaving(true);
                try {
                  assertStoreSelected();
                  if (editing.mode === "categoria") {
                    await api.updateCategoria(editing.row.id_categoria, {
                      nombre: editing.row.nombre,
                      id_categoria_padre: editing.row.id_categoria_padre || null,
                      orden: Number(editing.row.orden || 0),
                      activa: editing.row.activa,
                      imagen_fit_default: editing.row.imagen_fit_default || "cover",
                      imagen_posicion_x_default: Number(editing.row.imagen_posicion_x_default ?? 50),
                      imagen_posicion_y_default: Number(editing.row.imagen_posicion_y_default ?? 30),
                      imagen_zoom_default: Number(editing.row.imagen_zoom_default ?? 100),
                      imagen_fondo_default: editing.row.imagen_fondo_default || null,
                    }, selectedStoreRef);
                  } else {
                    if (editing.row.tipo_producto === "SET") {
                      validateSetComposition(editing.row.componentes || []);
                    }
                    await api.updateProducto(editing.row.id_producto, {
                      nombre: editing.row.nombre,
                      descripcion: editing.row.descripcion || "",
                      precio_venta: Number(editing.row.precio_venta || 0),
                      ...(editing.row.tipo_producto === "SET" ? {
                        tipo_producto: "SET",
                        componentes: (editing.row.componentes || []).map((item) => ({
                          id_producto_componente: item.id_producto_componente,
                          id_variante_componente: item.id_variante_componente || null,
                          cantidad: Number(item.cantidad || 1),
                        })),
                      } : {
                        stock_actual: Number(editing.row.stock_actual || 0),
                        id_categoria_principal: editing.row.id_categoria_principal || editing.row.id_categoria || null,
                      }),
                      activo: editing.row.activo,
                      imagen_fit: editing.row.imagen_fit || null,
                      imagen_posicion_x: editing.row.imagen_posicion_x ?? null,
                      imagen_posicion_y: editing.row.imagen_posicion_y ?? null,
                      imagen_zoom: editing.row.imagen_zoom ?? null,
                      imagen_fondo: editing.row.imagen_fondo || null,
                    }, selectedStoreRef);
                    if (editingProductAttributeConfig.length > 0) {
                      await api.replaceProductoAtributos(
                        editing.row.id_producto,
                        buildProductAttributePayload(),
                      );
                    }
                  }
                  setEditing(null);
                  setEditorOpen(false);
                  await load();
                  pushToast(editing.mode === "categoria" ? "Categoría guardada correctamente" : "Producto guardado correctamente");
                } catch (e) { setError(e.message); pushToast(e.message, "error"); } finally { setIsSaving(false); }
              }}>{isSaving ? "Guardando..." : "Guardar"}</button>
              <button type="button" className="btn btn-ghost" onClick={closeEntityEditor}>Cancelar</button>
            </div>
          </div>
        ) : (
          <form className="grid-form catalog-editor-form" onSubmit={async (e) => {
            e.preventDefault();
            if (isSaving) return;
            setIsSaving(true);
            try {
              assertStoreSelected();
              if (tab === "categorias") {
                await api.createCategoria(form, selectedStoreRef);
              } else {
                if (form.tipo_producto === "SET") {
                  validateSetComposition(form.componentes || []);
                }
                const created = await api.createProducto({
                  ...form,
                  precio_venta: Number(form.precio_venta || 0),
                  stock_actual: Number(form.stock_actual || 0),
                  nombre_categoria: form.nombre_categoria || null,
                }, selectedStoreRef);
                if (pendingImageFile && created?.id_producto) {
                  await uploadImage(created.id_producto, pendingImageFile);
                }
              }
              resetFormForTab(tab);
              setPendingImageFile(null);
              setEditorOpen(false);
              await load();
              pushToast(tab === "categorias" ? "✅ Categoría creada correctamente" : "✅ Producto creado correctamente");
            } catch (err) { setError(err.message); pushToast(err.message, "error"); } finally { setIsSaving(false); }
          }}>
            <label>Nombre<input value={form.nombre || ""} onChange={(e) => setForm((s) => ({ ...s, nombre: e.target.value }))} required /></label>
            {tab === "categorias" ? (
              <>
                <label>Categoría padre<select value={form.id_categoria_padre || ""} onChange={(e) => setForm((s) => ({ ...s, id_categoria_padre: e.target.value || null }))}><option value="">Categoría raíz</option>{categoryOptions.map((c) => <option key={c.id_categoria} value={c.id_categoria}>{c.label}</option>)}</select></label>
                <label>Orden<input type="number" min="0" value={form.orden || 0} onChange={(e) => setForm((s) => ({ ...s, orden: Number(e.target.value || 0) }))} /></label>
                <CategoryCoverDefaultsFields value={form} onChange={setForm} />
                <label className="check-row"><input type="checkbox" checked={!!form.activa} onChange={(e) => setForm((s) => ({ ...s, activa: e.target.checked }))} />Activa</label>
              </>
            ) : (
              <>
                <label>Tipo de producto
                  <select
                    value={form.tipo_producto || "SIMPLE"}
                    onChange={(event) => setForm((current) => ({
                      ...current,
                      tipo_producto: event.target.value,
                      componentes: event.target.value === "SET" ? current.componentes || [] : [],
                      stock_actual: event.target.value === "SET" ? 0 : current.stock_actual,
                      id_categoria_principal: event.target.value === "SET" ? null : current.id_categoria_principal,
                    }))}
                  >
                    <option value="SIMPLE">Producto normal</option>
                    <option value="SET">Set de productos</option>
                  </select>
                </label>
                <label>Descripción<textarea value={form.descripcion || ""} onChange={(e) => setForm((s) => ({ ...s, descripcion: e.target.value }))} /></label>
                <label>Precio<input type="number" step="0.01" value={form.precio_venta || 0} onChange={(e) => setForm((s) => ({ ...s, precio_venta: e.target.value }))} required /></label>
                {form.tipo_producto !== "SET" ? <label>Stock<input type="number" value={form.stock_actual || 0} onChange={(e) => setForm((s) => ({ ...s, stock_actual: e.target.value }))} /></label> : null}
                {form.tipo_producto !== "SET" ? (
                <label>Categoría<select value={form.id_categoria_principal || ""} onChange={(e) => setForm((s) => ({ ...s, id_categoria_principal: e.target.value || null }))}><option value="">Sin categoría</option>{categoryOptions.map((c) => <option key={c.id_categoria} value={c.id_categoria}>{c.label}</option>)}</select></label>
                ) : <small className="muted">La categoria Sets se asignara automaticamente.</small>}
                {form.tipo_producto === "SET" ? (
                  <SetComponentsEditor
                    value={form.componentes || []}
                    onChange={(componentes) => setForm((current) => ({
                      ...current,
                      componentes,
                    }))}
                    products={rows}
                    categoryOptions={categoryOptions}
                  />
                ) : null}
                <ImageDropZone
                  title="Portada del producto"
                  subtitle="Arrastra una imagen para ajustar y previsualizar antes de subir"
                  previewUrl={pendingImagePreviewUrl}
                  selectedFileName={pendingImageFile?.name || ""}
                  onFileSelected={(file) => openProductCoverEditor(form, { target: "new", file })}
                />
                {pendingImageFile ? (
                  <button type="button" className="btn btn-ghost" onClick={() => openProductCoverEditor(form, {
                    target: "new",
                    file: pendingImageFile,
                    imageUrl: pendingImagePreviewUrl,
                  })}>Volver a ajustar portada</button>
                ) : null}
                <label className="check-row"><input type="checkbox" checked={!!form.activo} onChange={(e) => setForm((s) => ({ ...s, activo: e.target.checked }))} />Activo</label>
              </>
            )}
            <div className="row catalog-editor-actions">
              <button className="btn btn-primary" disabled={isSaving} style={{ opacity: isSaving ? 0.6 : 1, cursor: isSaving ? 'not-allowed' : 'pointer' }}>
                {isSaving ? "Guardando..." : "Crear"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={closeEntityEditor}>Cancelar</button>
            </div>
          </form>
        )}
            </div>
          </section>
        </div>
      ) : null}
    </Card>
    <ProductCoverEditor
      open={Boolean(coverEditor)}
      imageUrl={coverEditor?.imageUrl || ""}
      file={coverEditor?.file || null}
      product={coverEditor?.product || null}
      category={coverEditor?.category || null}
      entityLabel={coverEditor?.target === "variant" ? "variante" : "producto"}
      busy={coverEditorBusy}
      onCancel={() => { if (!coverEditorBusy) setCoverEditor(null); }}
      onApply={applyProductCover}
    />
    <ToastStack items={toasts} onDismiss={dismissToast} />
    </>
  );
}
