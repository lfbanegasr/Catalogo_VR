import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../../api';
import StoreRefPicker from '../StoreRefPicker';
import ImageDropZone from '../ImageDropZone';
import { getImageSrc, buildPublicStoreUrl } from '../../utils';
import { ToastStack } from '../Toast';
import ProductCoverEditor, { categoryCoverDefaults } from './ProductCoverEditor';
import ProductPicker from './ProductPicker';
import CatalogPdfDownload from './CatalogPdfDownload';
import {
  BoxIcon,
  TagIcon,
  SlidersIcon,
  SearchIcon,
  GridIcon,
  ListIcon,
  PlusIcon,
  EditIcon,
  ImageIcon,
  EyeIcon,
  EyeOffIcon,
  CopyIcon,
  CheckIcon,
  ExternalLinkIcon,
  CloseIcon,
  TrashIcon,
  RefreshIcon,
} from '../common/Icons';

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
      <header>
        <strong>Portadas de esta categoría</strong>
        <span>Los productos heredarán este ajuste mientras no tengan uno individual.</span>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginTop: '12px' }}>
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
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginTop: '12px' }}>
        <label className="cover-range-control">
          <span><strong>Posición horizontal</strong> <output>{value.imagen_posicion_x_default ?? 50}%</output></span>
          <input type="range" min="0" max="100" value={value.imagen_posicion_x_default ?? 50} onChange={(event) => update("imagen_posicion_x_default", Number(event.target.value))} />
        </label>
        <label className="cover-range-control">
          <span><strong>Posición vertical</strong> <output>{value.imagen_posicion_y_default ?? 30}%</output></span>
          <input type="range" min="0" max="100" value={value.imagen_posicion_y_default ?? 30} onChange={(event) => update("imagen_posicion_y_default", Number(event.target.value))} />
        </label>
        <label className="cover-range-control">
          <span><strong>Zoom</strong> <output>{value.imagen_zoom_default ?? 100}%</output></span>
          <input type="range" min="80" max="200" value={value.imagen_zoom_default ?? 100} onChange={(event) => update("imagen_zoom_default", Number(event.target.value))} />
        </label>
      </div>
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
          <strong>Aún no agregaste productos</strong>
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

  // Tabs de pantalla: "productos" | "categorias" | "atributos" | "descargar"
  const [tab, setTab] = useState("productos");
  // Modo de visualización: "grid" | "table"
  const [viewMode, setViewMode] = useState("grid");
  // Pestaña activa dentro del modal de edición
  const [modalTab, setModalTab] = useState("general");

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
  const [isReloading, setIsReloading] = useState(false);

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
    return buildPublicStoreUrl(catalogSlug);
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

  // Métricas rápidas del catálogo (KPIs)
  const stats = useMemo(() => {
    if (tab === "categorias") {
      const total = rows.length;
      const activas = rows.filter((c) => c.activa).length;
      return { total, activas, inactivas: total - activas };
    }
    const allProd = tab === "productos" ? rows : [];
    const total = allProd.length;
    const inStock = allProd.filter((p) => Number(p.stock_actual || 0) > 5).length;
    const lowStock = allProd.filter((p) => Number(p.stock_actual || 0) > 0 && Number(p.stock_actual || 0) <= 5).length;
    const outStock = allProd.filter((p) => Number(p.stock_actual || 0) <= 0).length;
    return { total, inStock, lowStock, outStock };
  }, [tab, rows]);

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
        throw new Error("Uno de los productos del set ya no está disponible.");
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
      const label = isCategory ? "categoría" : "producto";
      const confirmed = window.confirm(
        `¿Ocultar este ${label} del catálogo público? No se eliminarán sus datos y podrás volver a mostrarlo cuando quieras.`,
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
    setModalTab("general");
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
      throw new Error("Selecciona una opción para cada atributo de la variante.");
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
      pushToast("Variante creada correctamente");
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
      "Se crearán " + missingVariantCombinations.length + " variantes. ¿Deseas continuar?",
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
      pushToast("Variante actualizada");
    } finally {
      setVariantBusy(false);
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
      pushToast("Imagen eliminada");
    } catch (err) {
      setError(err.message || "Error al eliminar la imagen");
    } finally {
      setBusyImageProductId("");
    }
  };

  const handleOpenCreateForm = () => {
    setEditing(null);
    resetFormForTab(tab);
    setPendingImageFile(null);
    setError("");
    setModalTab("general");
    setEditorOpen(true);
  };

  const closeEntityEditor = () => {
    if (isSaving) return;
    setEditorOpen(false);
    setEditing(null);
    setPendingImageFile(null);
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

  return (
    <div className="catalog-main-container">
      {/* HEADER DE LA PANTALLA */}
      <div className="catalog-header-row">
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Catálogo de Productos
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Administra tus productos, variantes, categorías y catálogos interactivos para tus clientes.
          </p>
        </div>

        <div className="catalog-header-actions">
          {isSuperadmin ? (
            <StoreRefPicker
              stores={stores}
              value={tenantId}
              onChange={setTenantId}
              required
            />
          ) : null}

          <button
            type="button"
            className="catalog-sync-btn"
            disabled={isReloading}
            onClick={async () => {
              setIsReloading(true);
              try {
                await handleReload();
                pushToast("Catálogo sincronizado correctamente");
              } catch (e) {
                setError(e.message);
              } finally {
                setTimeout(() => setIsReloading(false), 600);
              }
            }}
            title="Sincronizar y actualizar datos"
          >
            <RefreshIcon size={16} className={`catalog-sync-icon ${isReloading ? "is-spinning" : ""}`} />
            <span>{isReloading ? "Sincronizando..." : "Actualizar"}</span>
          </button>

          {catalogSlug && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShareOpen((s) => !s)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <ExternalLinkIcon size={16} />
              <span>{shareOpen ? "Ocultar Enlace" : "Compartir Catálogo"}</span>
            </button>
          )}
        </div>
      </div>

      {/* BANNER DE COMPARTIR CATÁLOGO PÚBLICO */}
      {shareOpen && publicCatalogUrl && (
        <div className="catalog-share-banner">
          <div className="catalog-share-info">
            <div className="catalog-share-avatar">
              <ExternalLinkIcon size={20} />
            </div>
            <div>
              <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                Enlace Público de tu Catálogo
              </strong>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Tus clientes pueden explorar productos y hacer pedidos directamente desde este enlace.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div className="catalog-share-linkbox">
              {publicCatalogUrl}
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={copyCatalogUrl}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {shareCopied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
              <span>{shareCopied ? "¡Copiado!" : "Copiar"}</span>
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => window.open(publicCatalogUrl, "_blank", "noopener,noreferrer")}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <ExternalLinkIcon size={15} />
              <span>Abrir Tienda</span>
            </button>
          </div>
        </div>
      )}

      {/* KPI BENTO STRIP DE INVENTARIO */}
      <div className="catalog-kpi-bento">
        {tab === "categorias" ? (
          <>
            <div className="catalog-kpi-card accent-cyan">
              <div className="catalog-kpi-header">
                <span className="catalog-kpi-label">Total Categorías</span>
                <div className="catalog-kpi-icon-wrap cyan"><TagIcon size={18} /></div>
              </div>
              <div className="catalog-kpi-number">{stats.total}</div>
              <div className="catalog-kpi-footnote">
                <span className="catalog-kpi-dot cyan" />
                <span>Estructuradas en el catálogo</span>
              </div>
            </div>
            <div className="catalog-kpi-card accent-emerald">
              <div className="catalog-kpi-header">
                <span className="catalog-kpi-label">Categorías Activas</span>
                <div className="catalog-kpi-icon-wrap emerald"><CheckIcon size={18} /></div>
              </div>
              <div className="catalog-kpi-number">{stats.activas}</div>
              <div className="catalog-kpi-footnote">
                <span className="catalog-kpi-dot emerald" />
                <span>Visibles en tienda pública</span>
              </div>
            </div>
            <div className="catalog-kpi-card accent-amber">
              <div className="catalog-kpi-header">
                <span className="catalog-kpi-label">Categorías Ocultas</span>
                <div className="catalog-kpi-icon-wrap amber"><EyeOffIcon size={18} /></div>
              </div>
              <div className="catalog-kpi-number">{stats.inactivas}</div>
              <div className="catalog-kpi-footnote">
                <span className="catalog-kpi-dot amber" />
                <span>Desactivadas temporalmente</span>
              </div>
            </div>
            <div className="catalog-kpi-card accent-purple">
              <div className="catalog-kpi-header">
                <span className="catalog-kpi-label">Estructura</span>
                <div className="catalog-kpi-icon-wrap purple"><SlidersIcon size={18} /></div>
              </div>
              <div className="catalog-kpi-number" style={{ fontSize: '1.45rem' }}>Jerárquica</div>
              <div className="catalog-kpi-footnote">
                <span className="catalog-kpi-dot purple" />
                <span>Árbol Padre / Subcategorías</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="catalog-kpi-card accent-cyan">
              <div className="catalog-kpi-header">
                <span className="catalog-kpi-label">Total Productos</span>
                <div className="catalog-kpi-icon-wrap cyan"><BoxIcon size={18} /></div>
              </div>
              <div className="catalog-kpi-number">{stats.total}</div>
              <div className="catalog-kpi-footnote">
                <span className="catalog-kpi-dot cyan" />
                <span>En inventario general</span>
              </div>
            </div>
            <div className="catalog-kpi-card accent-emerald">
              <div className="catalog-kpi-header">
                <span className="catalog-kpi-label">En Stock Normal</span>
                <div className="catalog-kpi-icon-wrap emerald"><CheckIcon size={18} /></div>
              </div>
              <div className="catalog-kpi-number">{stats.inStock}</div>
              <div className="catalog-kpi-footnote">
                <span className="catalog-kpi-dot emerald" />
                <span>&gt; 5 unidades disponibles</span>
              </div>
            </div>
            <div className="catalog-kpi-card accent-amber">
              <div className="catalog-kpi-header">
                <span className="catalog-kpi-label">Alerta Bajo Stock</span>
                <div className="catalog-kpi-icon-wrap amber"><SlidersIcon size={18} /></div>
              </div>
              <div className="catalog-kpi-number">{stats.lowStock}</div>
              <div className="catalog-kpi-footnote">
                <span className="catalog-kpi-dot amber" />
                <span>1 a 5 unidades restantes</span>
              </div>
            </div>
            <div className="catalog-kpi-card accent-rose">
              <div className="catalog-kpi-header">
                <span className="catalog-kpi-label">Sin Stock / Agotados</span>
                <div className="catalog-kpi-icon-wrap rose"><CloseIcon size={18} /></div>
              </div>
              <div className="catalog-kpi-number">{stats.outStock}</div>
              <div className="catalog-kpi-footnote">
                <span className="catalog-kpi-dot rose" />
                <span>Requieren reposición urgente</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* SUB-NAVEGACIÓN POR PESTAÑAS (PILLS MODERNOS) */}
      <div className="catalog-nav-pills-bar">
        <div className="catalog-nav-pills">
          <button
            type="button"
            className={`catalog-tab-pill ${tab === "productos" ? "active" : ""}`}
            onClick={() => setTab("productos")}
          >
            <BoxIcon size={16} />
            <span>Productos</span>
            {tab === "productos" && <span className="catalog-pill-count">{filteredProductRows.length}</span>}
          </button>

          <button
            type="button"
            className={`catalog-tab-pill ${tab === "categorias" ? "active" : ""}`}
            onClick={() => setTab("categorias")}
          >
            <TagIcon size={16} />
            <span>Categorías</span>
            {tab === "categorias" && <span className="catalog-pill-count">{visibleCategoryRows.length}</span>}
          </button>

          <button
            type="button"
            className={`catalog-tab-pill ${tab === "atributos" ? "active" : ""}`}
            onClick={() => setTab("atributos")}
          >
            <SlidersIcon size={16} />
            <span>Atributos & Variantes</span>
          </button>

          <button
            type="button"
            className={`catalog-tab-pill ${tab === "descargar" ? "active" : ""}`}
            onClick={() => setTab("descargar")}
          >
            <ExternalLinkIcon size={16} />
            <span>Catálogo PDF</span>
          </button>
        </div>

        {tab !== "atributos" && tab !== "descargar" && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenCreateForm}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <PlusIcon size={16} />
            <span>{tab === "categorias" ? "Nueva Categoría" : "Nuevo Producto"}</span>
          </button>
        )}
      </div>

      {error ? (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '12px 16px', color: '#ef4444', fontSize: '0.86rem' }}>
          ⚠️ {error}
        </div>
      ) : null}

      {/* CONTROLES Y FILTROS (TOOLBAR) */}
      {tab === "productos" && (
        <div className="catalog-toolbar-card">
          <div className="catalog-toolbar-left">
            {/* Buscador inteligente */}
            <div className="catalog-search-wrapper">
              <div className="catalog-search-box">
                <SearchIcon size={18} style={{ color: 'var(--text-muted)' }} />
                <input
                  className="catalog-search-input"
                  value={productQuery}
                  autoComplete="off"
                  placeholder="Buscar por nombre, descripción o ID..."
                  onFocus={() => setProductSearchOpen(true)}
                  onBlur={() => window.setTimeout(() => setProductSearchOpen(false), 150)}
                  onChange={(event) => setProductQuery(event.target.value)}
                />
              </div>

              {productSearchOpen && productSuggestions.length > 0 && (
                <div className="catalog-search-dropdown">
                  {productSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="catalog-search-dropdown-item"
                      onClick={() => {
                        setProductQuery(suggestion);
                        setProductSearchOpen(false);
                      }}
                    >
                      <SearchIcon size={14} style={{ color: 'var(--text-muted)' }} />
                      <span>{suggestion}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filtro por Categoría */}
            <select
              className="catalog-select-filter"
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
            >
              <option value="">Todas las categorías</option>
              {categoriasDisponibles.map((c) => (
                <option key={c.id_categoria} value={c.id_categoria}>
                  {c.nombre}
                </option>
              ))}
            </select>

            {/* Limpiar filtros */}
            {(productQuery || categoriaFiltro) && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setProductQuery("");
                  setCategoriaFiltro("");
                }}
                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
              >
                Limpiar filtros
              </button>
            )}
          </div>

          <div className="catalog-toolbar-right">
            {/* Mostrar Ocultos */}
            <label className="catalog-toggle-label">
              <input
                type="checkbox"
                checked={showRemoved}
                onChange={(e) => setShowRemoved(e.target.checked)}
              />
              <span>Mostrar ocultos</span>
            </label>

            {/* Selector de vista Grid / Table */}
            <div className="catalog-view-switch">
              <button
                type="button"
                className={`catalog-view-btn ${viewMode === "grid" ? "active" : ""}`}
                onClick={() => setViewMode("grid")}
                title="Vista Cuadrícula"
              >
                <GridIcon size={18} />
              </button>
              <button
                type="button"
                className={`catalog-view-btn ${viewMode === "table" ? "active" : ""}`}
                onClick={() => setViewMode("table")}
                title="Vista Tabla de Inventario"
              >
                <ListIcon size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL SEGÚN PESTAÑA */}

      {/* PESTAÑA: PRODUCTOS */}
      {tab === "productos" && (
        <>
          {filteredProductRows.length === 0 ? (
            <div className="empty-state-modern" style={{ background: 'var(--bg-surface)', borderRadius: '20px', border: '1px solid var(--border-subtle)', padding: '48px 24px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🛍️</div>
              <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', margin: 0 }}>No se encontraron productos</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '4px 0 16px' }}>
                {productQuery || categoriaFiltro
                  ? "Prueba cambiando los términos de búsqueda o limpiando los filtros."
                  : "Empieza creando tu primer producto para el catálogo."}
              </p>
              <button type="button" className="btn btn-primary" onClick={handleOpenCreateForm}>
                + Crear Producto
              </button>
            </div>
          ) : viewMode === "grid" ? (
            /* VISTA GRID BENTO DE PRODUCTOS */
            <div className="catalog-products-grid">
              {filteredProductRows.map((product) => {
                const stock = Number(product.stock_actual || 0);
                const isOutOfStock = stock <= 0;
                const isLowStock = stock > 0 && stock <= 5;
                const coverStyle = getAdminCoverAdjustment(product);
                const categoryName = categoriaMap.get(product.id_categoria_principal || product.id_categoria) || "Sin categoría";

                return (
                  <div key={product.id_producto} className="catalog-product-card">
                    {/* Caja de Imagen de Portada */}
                    <div className="catalog-card-image-box" style={{ backgroundColor: coverStyle.backgroundColor }}>
                      {product.imagen_url ? (
                        <img
                          src={getImageSrc(product.imagen_url)}
                          alt={product.nombre}
                          className="catalog-card-img"
                          style={coverStyle.imageStyle}
                        />
                      ) : (
                        <div style={{ display: 'grid', placeItems: 'center', color: 'var(--text-muted)', fontSize: '2rem' }}>
                          🛍️
                        </div>
                      )}

                      {/* Badge flotante de Set */}
                      {product.tipo_producto === "SET" && (
                        <span className="catalog-badge-set">📦 Set / Combo</span>
                      )}

                      {/* Badge flotante de Stock */}
                      <span className={`catalog-badge-stock ${isOutOfStock ? "is-out" : isLowStock ? "is-low" : "is-ok"}`}>
                        {isOutOfStock ? "Agotado" : isLowStock ? `Bajo Stock (${stock})` : `En Stock (${stock})`}
                      </span>
                    </div>

                    {/* Cuerpo de la tarjeta */}
                    <div className="catalog-card-body">
                      <span className="catalog-card-category">{categoryName}</span>
                      <h4 className="catalog-card-title" title={product.nombre}>
                        {product.nombre}
                      </h4>

                      <div className="catalog-card-price-row">
                        <span className="catalog-card-price">
                          {product.precio_venta} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Bs.</span>
                        </span>

                        <span className={`status-badge ${product.activo ? "active" : "inactive"}`}>
                          {product.activo ? "Activo" : "Oculto"}
                        </span>
                      </div>
                    </div>

                    {/* Acciones de la tarjeta */}
                    <div className="catalog-card-footer">
                      <button
                        type="button"
                        className="catalog-card-action-btn"
                        onClick={() => openProductEditor(product)}
                      >
                        <EditIcon size={14} />
                        <span>Editar</span>
                      </button>

                      <button
                        type="button"
                        className="catalog-card-action-btn"
                        onClick={() => openProductCoverEditor(product)}
                        title="Ajustar portada visualmente"
                      >
                        <ImageIcon size={14} />
                        <span>Portada</span>
                      </button>

                      <button
                        type="button"
                        className={`catalog-card-action-btn ${product.activo ? "is-danger" : "is-success"}`}
                        onClick={() => toggleRowVisibility(product, "producto").catch((e) => setError(e.message))}
                        title={product.activo ? "Ocultar del catálogo" : "Mostrar en catálogo"}
                        style={{ padding: '7px 11px' }}
                      >
                        {product.activo ? <EyeOffIcon size={15} /> : <EyeIcon size={15} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* VISTA TABLA DETALLADA DE PRODUCTOS */
            <div className="catalog-table-card">
              <table className="sales-modern-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Precio</th>
                    <th>Stock</th>
                    <th>Estado</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProductRows.map((product) => {
                    const stock = Number(product.stock_actual || 0);
                    const isOutOfStock = stock <= 0;
                    const isLowStock = stock > 0 && stock <= 5;
                    const coverStyle = getAdminCoverAdjustment(product);
                    const categoryName = categoriaMap.get(product.id_categoria_principal || product.id_categoria) || "Sin categoría";

                    return (
                      <tr key={product.id_producto}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div className="catalog-row-thumb" style={{ backgroundColor: coverStyle.backgroundColor }}>
                              {product.imagen_url ? (
                                <img
                                  src={getImageSrc(product.imagen_url)}
                                  alt=""
                                  style={{ width: '100%', height: '100%', ...coverStyle.imageStyle }}
                                />
                              ) : (
                                <span>🛍️</span>
                              )}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                                {product.nombre} {product.tipo_producto === "SET" && <span style={{ color: 'var(--brand-primary)', fontSize: '0.75rem' }}>(Set)</span>}
                              </div>
                              <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                ID: {product.id_producto.slice(0, 8)}...
                              </small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{categoryName}</span>
                        </td>
                        <td>
                          <strong style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                            {product.precio_venta} Bs.
                          </strong>
                        </td>
                        <td>
                          <span className={`catalog-badge-stock ${isOutOfStock ? "is-out" : isLowStock ? "is-low" : "is-ok"}`} style={{ position: 'static' }}>
                            {stock} {product.tiene_variantes ? "total" : "en stock"}
                          </span>
                        </td>
                        <td>
                          <span className={`status-badge ${product.activo ? "active" : "inactive"}`}>
                            {product.activo ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => openProductEditor(product)}
                              style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => openProductCoverEditor(product)}
                              style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                            >
                              Portada
                            </button>
                            <button
                              type="button"
                              className={`btn ${product.activo ? "btn-danger-ghost" : "btn-success-ghost"}`}
                              onClick={() => toggleRowVisibility(product, "producto").catch((e) => setError(e.message))}
                              style={{ padding: '6px 10px' }}
                            >
                              {product.activo ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* PESTAÑA: CATEGORÍAS */}
      {tab === "categorias" && (
        <div className="catalog-table-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
              Estructura de Categorías
            </h3>
            <label className="catalog-toggle-label">
              <input
                type="checkbox"
                checked={showRemoved}
                onChange={(e) => setShowRemoved(e.target.checked)}
              />
              <span>Mostrar categorías inactivas</span>
            </label>
          </div>

          <table className="sales-modern-table">
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Ruta Jerárquica</th>
                <th>Orden</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibleCategoryRows.map((cat) => {
                const parentCategory = categoryOptions.find((c) => c.id_categoria === cat.id_categoria_padre);
                return (
                  <tr key={cat.id_categoria}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--brand-glow)', color: 'var(--brand-primary)', display: 'grid', placeItems: 'center' }}>
                          <TagIcon size={18} />
                        </div>
                        <div>
                          <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{cat.nombre}</strong>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ID: {cat.id_categoria.slice(0, 8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {parentCategory ? `${parentCategory.nombre} > ${cat.nombre}` : "Categoría Raíz"}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        #{cat.orden || 0}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${cat.activa ? "active" : "inactive"}`}>
                        {cat.activa ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => setEditing({ mode: "categoria", row: cat })}
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className={`btn ${cat.activa ? "btn-danger-ghost" : "btn-success-ghost"}`}
                          onClick={() => toggleRowVisibility(cat, "categoria").catch((e) => setError(e.message))}
                          style={{ padding: '6px 10px' }}
                        >
                          {cat.activa ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* PESTAÑA: ATRIBUTOS & VARIANTES */}
      {tab === "atributos" && (
        <div className="catalog-attributes-container">
          {/* Creador de Atributos */}
          <div className="catalog-panel-card">
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
              Crear Nuevo Atributo Global
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Define características como Tallas, Colores o Materiales que luego podrás asociar a categorías.
            </p>

            <form
              className="grid-form"
              onSubmit={async (event) => {
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
                  pushToast("Atributo creado correctamente");
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              <label>
                Nombre del atributo
                <input
                  required
                  placeholder="Ej: Talla, Color, Memoria..."
                  value={attributeForm.nombre}
                  onChange={(e) => setAttributeForm((c) => ({ ...c, nombre: e.target.value }))}
                />
              </label>

              <label>
                Tipo de dato
                <select
                  value={attributeForm.tipo_dato}
                  onChange={(e) => setAttributeForm((c) => ({ ...c, tipo_dato: e.target.value }))}
                >
                  <option value="OPTION">Lista de opciones (Recomendado para variantes)</option>
                  <option value="TEXT">Texto libre</option>
                  <option value="NUMBER">Número</option>
                  <option value="BOOLEAN">Sí / No</option>
                </select>
              </label>

              <label>
                Unidad de medida (Opcional)
                <input
                  placeholder="Ej: cm, GB, kg, ml..."
                  value={attributeForm.unidad}
                  onChange={(e) => setAttributeForm((c) => ({ ...c, unidad: e.target.value }))}
                />
              </label>

              <label className="check-row">
                <input
                  type="checkbox"
                  checked={attributeForm.permite_multiples}
                  onChange={(e) => setAttributeForm((c) => ({ ...c, permite_multiples: e.target.checked }))}
                />
                <span>Permitir seleccionar varios valores a la vez</span>
              </label>

              <label className="check-row">
                <input
                  type="checkbox"
                  checked={attributeForm.usable_en_variantes}
                  onChange={(e) => setAttributeForm((c) => ({ ...c, usable_en_variantes: e.target.checked }))}
                />
                <span>Habilitar para crear combinaciones de variantes</span>
              </label>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>
                + Crear Atributo
              </button>
            </form>

            <div style={{ marginTop: '20px' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                Atributos Existentes ({rows.length})
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {rows.map((attribute) => (
                  <div
                    key={attribute.id_atributo}
                    style={{
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '12px',
                      padding: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        {attribute.nombre}
                      </strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Tipo: {attribute.tipo_dato} {attribute.unidad ? `(${attribute.unidad})` : ''}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {(attribute.opciones || []).map((o) => o.valor).join(", ") || "Sin opciones aún"}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {attribute.tipo_dato === "OPTION" && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={async () => {
                            const value = window.prompt("Nueva opción para " + attribute.nombre);
                            if (!value || !value.trim()) return;
                            try {
                              await api.createAtributoOpcion(attribute.id_atributo, { valor: value.trim() });
                              await load();
                              pushToast("Opción agregada");
                            } catch (e) {
                              setError(e.message);
                            }
                          }}
                        >
                          + Opción
                        </button>
                      )}

                      <button
                        type="button"
                        className={`btn ${attribute.activo ? "btn-danger-ghost" : "btn-success-ghost"}`}
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        onClick={async () => {
                          try {
                            await api.updateAtributo(attribute.id_atributo, { activo: !attribute.activo });
                            await load();
                          } catch (e) {
                            setError(e.message);
                          }
                        }}
                      >
                        {attribute.activo ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Configuración de Atributos por Categoría */}
          <div className="catalog-panel-card">
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
              Asociar Atributos a Categoría
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Selecciona una categoría para definir qué características se solicitarán en sus productos.
            </p>

            <label style={{ marginBottom: '14px' }}>
              Selecciona una categoría
              <select
                value={attributeCategoryId}
                onChange={(e) => setAttributeCategoryId(e.target.value)}
              >
                <option value="">-- Elige una categoría --</option>
                {categoryOptions.map((cat) => (
                  <option key={cat.id_categoria} value={cat.id_categoria}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </label>

            {attributeCategoryId ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Atributos disponibles para esta categoría:
                </div>

                {rows.filter((a) => a.activo).map((attribute) => {
                  const selected = selectedCategoryAttributeIds.includes(attribute.id_atributo);
                  const canBeVariant = attribute.usable_en_variantes && attribute.tipo_dato === "OPTION";

                  return (
                    <div
                      key={attribute.id_atributo}
                      style={{
                        background: 'var(--bg-surface-elevated)',
                        border: `1px solid ${selected ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
                        borderRadius: '12px',
                        padding: '12px',
                        transition: 'border-color 0.2s',
                      }}
                    >
                      <label className="check-row" style={{ fontWeight: 600 }}>
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
                        <span>{attribute.nombre}</span>
                      </label>

                      {selected && canBeVariant && (
                        <div style={{ marginTop: '8px', paddingLeft: '24px' }}>
                          <label className="check-row" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <input
                              type="checkbox"
                              checked={variantCategoryAttributeIds.includes(attribute.id_atributo)}
                              onChange={(e) => setVariantCategoryAttributeIds((current) => e.target.checked
                                ? [...current, attribute.id_atributo]
                                : current.filter((id) => id !== attribute.id_atributo))}
                            />
                            <span>Usar este atributo para generar variantes de stock / precio</span>
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ alignSelf: 'flex-start', marginTop: '12px' }}
                  onClick={async () => {
                    try {
                      const selected = selectedCategoryAttributeIds.map((id, index) => ({
                        id_atributo: id,
                        requerido: false,
                        filtrable: true,
                        usado_en_variantes: variantCategoryAttributeIds.includes(id),
                        orden: index,
                      }));
                      await api.replaceCategoriaAtributos(attributeCategoryId, selected);
                      pushToast("Configuración de categoría guardada");
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                >
                  Guardar Configuración de Categoría
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                👈 Selecciona una categoría arriba para configurar sus atributos.
              </div>
            )}
          </div>
        </div>
      )}

      {/* PESTAÑA: DESCARGAR / CATÁLOGO PDF */}
      {tab === "descargar" && (
        <div className="catalog-table-card">
          <CatalogPdfDownload
            categories={categoriasDisponibles}
            products={rows}
            store={catalogStore}
            tiendaRef={selectedStoreRef}
            disabled={isSuperadmin && !selectedStoreRef}
          />
        </div>
      )}

      {/* ==========================================================================
          MODAL DE CREACIÓN / EDICIÓN CON PESTAÑAS INTERNAS
          ========================================================================== */}
      {editorOpen && (
        <div
          className="catalog-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEntityEditor();
          }}
        >
          <section
            className="catalog-modal-window"
            ref={editorRef}
            role="dialog"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
          >
            {/* Header del Modal */}
            <header className="catalog-modal-header">
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--brand-primary)' }}>
                  {editorType === "categoria" ? "Estructura de Catálogo" : "Gestión de Producto"}
                </span>
                <h2 style={{ margin: '4px 0 0', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                  {(editing ? "Editar " : "Nuevo ") + (editorType === "categoria" ? "Categoría" : "Producto")}
                </h2>
              </div>
              <button
                type="button"
                className="icon-close-btn"
                onClick={closeEntityEditor}
                aria-label="Cerrar modal"
              >
                <CloseIcon size={20} />
              </button>
            </header>

            {/* Pestañas internas del modal para productos */}
            {editorType === "producto" && (
              <div className="catalog-modal-tabs">
                <button
                  type="button"
                  className={`catalog-modal-tab-btn ${modalTab === "general" ? "active" : ""}`}
                  onClick={() => setModalTab("general")}
                >
                  📝 Información Básica
                </button>
                <button
                  type="button"
                  className={`catalog-modal-tab-btn ${modalTab === "pricing" ? "active" : ""}`}
                  onClick={() => setModalTab("pricing")}
                >
                  💰 Precios e Inventario
                </button>
                <button
                  type="button"
                  className={`catalog-modal-tab-btn ${modalTab === "gallery" ? "active" : ""}`}
                  onClick={() => setModalTab("gallery")}
                >
                  🖼️ Galería y Portada
                </button>
                {editing && editing.row.tipo_producto !== "SET" && (
                  <button
                    type="button"
                    className={`catalog-modal-tab-btn ${modalTab === "variants" ? "active" : ""}`}
                    onClick={() => setModalTab("variants")}
                  >
                    🔀 Variantes ({editingVariants.length})
                  </button>
                )}
              </div>
            )}

            {/* Cuerpo del Modal */}
            <div className="catalog-modal-body">
              {editing ? (
                /* --- FORMULARIO DE EDICIÓN --- */
                editing.mode === "categoria" ? (
                  <div className="grid-form">
                    <label>
                      Nombre de la categoría
                      <input
                        required
                        value={editing.row.nombre || ""}
                        onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, nombre: e.target.value } }))}
                      />
                    </label>

                    <label>
                      Categoría padre (opcional)
                      <select
                        value={editing.row.id_categoria_padre || ""}
                        onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, id_categoria_padre: e.target.value || null } }))}
                      >
                        <option value="">Categoría raíz (sin padre)</option>
                        {categoryOptions
                          .filter((c) => c.id_categoria !== editing.row.id_categoria)
                          .map((c) => (
                            <option key={c.id_categoria} value={c.id_categoria}>{c.label}</option>
                          ))}
                      </select>
                    </label>

                    <label>
                      Orden de visualización
                      <input
                        type="number"
                        min="0"
                        value={editing.row.orden || 0}
                        onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, orden: Number(e.target.value || 0) } }))}
                      />
                    </label>

                    <CategoryCoverDefaultsFields
                      value={editing.row}
                      onChange={(row) => setEditing((current) => ({ ...current, row }))}
                    />

                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={!!editing.row.activa}
                        onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, activa: e.target.checked } }))}
                      />
                      <span>Categoría activa en catálogo público</span>
                    </label>
                  </div>
                ) : (
                  /* --- EDICIÓN DE PRODUCTO CON PESTAÑAS --- */
                  <div>
                    {modalTab === "general" && (
                      <div className="grid-form">
                        <label>
                          Nombre del producto
                          <input
                            required
                            value={editing.row.nombre || ""}
                            onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, nombre: e.target.value } }))}
                          />
                        </label>

                        <label>
                          Descripción
                          <textarea
                            rows={4}
                            placeholder="Describe detalles, especificaciones, etc..."
                            value={editing.row.descripcion || ""}
                            onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, descripcion: e.target.value } }))}
                          />
                        </label>

                        {editing.row.tipo_producto === "SET" ? (
                          <label>
                            Categoría
                            <input value="Sets / Combos (Asignada automáticamente)" disabled />
                          </label>
                        ) : (
                          <label>
                            Categoría principal
                            <select
                              value={editing.row.id_categoria_principal || editing.row.id_categoria || ""}
                              onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, id_categoria_principal: e.target.value || null } }))}
                            >
                              <option value="">Sin categoría</option>
                              {categoryOptions.map((c) => (
                                <option key={c.id_categoria} value={c.id_categoria}>{c.label}</option>
                              ))}
                            </select>
                          </label>
                        )}

                        <label className="check-row">
                          <input
                            type="checkbox"
                            checked={!!editing.row.activo}
                            onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, activo: e.target.checked } }))}
                          />
                          <span>Producto activo y visible para compras</span>
                        </label>
                      </div>
                    )}

                    {modalTab === "pricing" && (
                      <div className="grid-form">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                          <label>
                            Precio de venta (Bs.)
                            <input
                              type="number"
                              step="0.01"
                              required
                              value={editing.row.precio_venta || 0}
                              onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, precio_venta: e.target.value } }))}
                            />
                          </label>

                          <label>
                            {editing.row.tipo_producto === "SET"
                              ? "Stock Calculado"
                              : editing.row.tiene_variantes
                                ? "Stock Total Variantes"
                                : "Stock Actual"}
                            <input
                              type="number"
                              value={editing.row.stock_actual || 0}
                              disabled={editing.row.tipo_producto === "SET" || editing.row.tiene_variantes}
                              onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, stock_actual: e.target.value } }))}
                            />
                            {editing.row.tipo_producto === "SET" ? (
                              <small className="muted">Calculado desde los productos componentes.</small>
                            ) : editing.row.tiene_variantes ? (
                              <small className="muted">Edita el stock de cada variante en la pestaña Variantes.</small>
                            ) : null}
                          </label>
                        </div>

                        {editing.row.tipo_producto === "SET" && (
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
                        )}

                        {editingProductAttributeConfig.length > 0 && (
                          <div style={{ marginTop: '14px', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                            <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                              Características de la categoría
                            </strong>
                            <div className="grid-form" style={{ marginTop: '10px' }}>
                              {editingProductAttributeConfig.map((config) => {
                                const attribute = config.atributo;
                                const value = editingProductAttributeValues[attribute.id_atributo] ?? "";

                                if (attribute.tipo_dato === "OPTION") {
                                  return (
                                    <label key={attribute.id_atributo}>
                                      {attribute.nombre}
                                      <select
                                        value={value}
                                        onChange={(e) => setEditingProductAttributeValues((c) => ({
                                          ...c,
                                          [attribute.id_atributo]: e.target.value,
                                        }))}
                                      >
                                        <option value="">Sin especificar</option>
                                        {(attribute.opciones || [])
                                          .filter((o) => o.activo)
                                          .map((o) => (
                                            <option key={o.id_opcion} value={o.id_opcion}>{o.valor}</option>
                                          ))}
                                      </select>
                                    </label>
                                  );
                                }
                                if (attribute.tipo_dato === "BOOLEAN") {
                                  return (
                                    <label key={attribute.id_atributo}>
                                      {attribute.nombre}
                                      <select
                                        value={String(value)}
                                        onChange={(e) => setEditingProductAttributeValues((c) => ({
                                          ...c,
                                          [attribute.id_atributo]: e.target.value,
                                        }))}
                                      >
                                        <option value="">Sin especificar</option>
                                        <option value="true">Sí</option>
                                        <option value="false">No</option>
                                      </select>
                                    </label>
                                  );
                                }
                                return (
                                  <label key={attribute.id_atributo}>
                                    {attribute.nombre}
                                    <input
                                      type={attribute.tipo_dato === "NUMBER" ? "number" : "text"}
                                      step={attribute.tipo_dato === "NUMBER" ? "any" : undefined}
                                      value={value}
                                      onChange={(e) => setEditingProductAttributeValues((c) => ({
                                        ...c,
                                        [attribute.id_atributo]: e.target.value,
                                      }))}
                                    />
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {modalTab === "gallery" && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <strong style={{ fontSize: '0.94rem', color: 'var(--text-primary)' }}>
                              Imágenes del Producto ({editing.row.imagenes?.length || 0})
                            </strong>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              La primera imagen funcionará como portada principal en el catálogo.
                            </div>
                          </div>

                          {editing.row.imagen_url && (
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => openProductCoverEditor(editing.row)}
                            >
                              🎨 Ajustar Enfoque de Portada
                            </button>
                          )}
                        </div>

                        {/* Input invisible para reemplazar imagen específica */}
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
                              pushToast("Imagen reemplazada");
                            } catch (err) {
                              setError(err.message || "Error al reemplazar imagen");
                            } finally {
                              setBusyImageProductId("");
                              setReplacingImageUrl(null);
                            }
                          }}
                        />

                        {/* Galería de imágenes interactivas */}
                        <div className="image-manager-gallery">
                          {editing.row.imagenes && editing.row.imagenes.length > 0 ? (
                            editing.row.imagenes.map((url, index) => (
                              <div key={url} className="image-manager-item">
                                <img src={getImageSrc(url)} alt={`Foto ${index + 1}`} />
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
                                      <TrashIcon size={14} />
                                    </button>
                                  </div>
                                  <div className="image-manager-actions-bottom">
                                    <button
                                      type="button"
                                      className="image-manager-btn"
                                      title="Mover a la izquierda"
                                      disabled={index === 0}
                                      onClick={() => handleMoveImage(index, 'left')}
                                    >
                                      ◀
                                    </button>
                                    <button
                                      type="button"
                                      className="image-manager-btn"
                                      title="Reemplazar foto"
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
                                      title="Mover a la derecha"
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
                              Aún no has agregado fotos a este producto.
                            </div>
                          )}
                        </div>

                        <ImageDropZone
                          title="Subir nueva imagen"
                          subtitle="Arrastra y suelta o haz clic para subir una nueva foto"
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
                              pushToast("Foto subida correctamente");
                            } catch (err) {
                              setError(err.message || "Error al subir la imagen");
                            }
                          }}
                        />
                      </div>
                    )}

                    {modalTab === "variants" && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                          <strong style={{ fontSize: '0.94rem', color: 'var(--text-primary)' }}>
                            Gestor de Variantes e Inventario
                          </strong>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Cada variante mantiene su propio SKU, precio, costo, stock y foto específica.
                          </div>
                        </div>

                        {variantAttributeConfig.length > 0 ? (
                          <div className="grid-form" style={{ background: 'var(--bg-surface-elevated)', padding: '16px', borderRadius: '16px' }}>
                            <strong>+ Agregar Variante Manual</strong>
                            {variantAttributeConfig.map((config) => (
                              <label key={config.id_atributo}>
                                {config.atributo.nombre}
                                <select
                                  value={variantForm.atributos[config.id_atributo] || ""}
                                  onChange={(e) => setVariantForm((c) => ({
                                    ...c,
                                    atributos: {
                                      ...c.atributos,
                                      [config.id_atributo]: e.target.value,
                                    },
                                  }))}
                                >
                                  <option value="">Selecciona una opción</option>
                                  {(config.atributo.opciones || [])
                                    .filter((o) => o.activo)
                                    .map((o) => (
                                      <option key={o.id_opcion} value={o.id_opcion}>{o.valor}</option>
                                    ))}
                                </select>
                              </label>
                            ))}

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                              <label>
                                SKU
                                <input
                                  placeholder="Auto"
                                  value={variantForm.sku}
                                  onChange={(e) => setVariantForm((c) => ({ ...c, sku: e.target.value }))}
                                />
                              </label>
                              <label>
                                Precio
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="General"
                                  value={variantForm.precio_venta}
                                  onChange={(e) => setVariantForm((c) => ({ ...c, precio_venta: e.target.value }))}
                                />
                              </label>
                              <label>
                                Stock
                                <input
                                  type="number"
                                  value={variantForm.stock_actual}
                                  onChange={(e) => setVariantForm((c) => ({ ...c, stock_actual: e.target.value }))}
                                />
                              </label>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
                              <button
                                type="button"
                                className="btn btn-primary"
                                disabled={variantBusy}
                                onClick={() => createEditingVariant().catch((e) => setError(e.message))}
                              >
                                {variantBusy ? "Guardando..." : "+ Crear Variante"}
                              </button>

                              {missingVariantCombinations.length > 0 && (
                                <button
                                  type="button"
                                  className="btn btn-ghost"
                                  disabled={variantBusy}
                                  onClick={() => createMissingVariantCombinations().catch((e) => setError(e.message))}
                                >
                                  ⚡ Crear combinaciones faltantes ({missingVariantCombinations.length})
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--bg-surface-elevated)', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                            💡 Para habilitar variantes, ve a la pestaña <strong>Atributos & Variantes</strong> y marca las opciones de la categoría para "Usar para crear variantes".
                          </div>
                        )}

                        {editingVariants.length > 0 && (
                          <div className="table-wrap" style={{ marginTop: '12px' }}>
                            <table className="sales-modern-table">
                              <thead>
                                <tr>
                                  <th>Combinación</th>
                                  <th>SKU</th>
                                  <th>Precio</th>
                                  <th>Stock</th>
                                  <th>Foto</th>
                                  <th></th>
                                </tr>
                              </thead>
                              <tbody>
                                {editingVariants.map((variant) => (
                                  <tr key={variant.id_variante}>
                                    <td>
                                      <strong>{(variant.atributos || []).map((i) => i.valor).join(" / ")}</strong>
                                    </td>
                                    <td>
                                      <input
                                        style={{ padding: '4px 8px', fontSize: '0.8rem', width: '100px' }}
                                        value={variant.sku || ""}
                                        onChange={(e) => setEditingVariants((current) => current.map((item) =>
                                          item.id_variante === variant.id_variante ? { ...item, sku: e.target.value } : item))}
                                      />
                                    </td>
                                    <td>
                                      <input
                                        type="number"
                                        step="0.01"
                                        style={{ padding: '4px 8px', fontSize: '0.8rem', width: '90px' }}
                                        value={variant.precio_venta ?? ""}
                                        placeholder="General"
                                        onChange={(e) => setEditingVariants((current) => current.map((item) =>
                                          item.id_variante === variant.id_variante ? { ...item, precio_venta: e.target.value } : item))}
                                      />
                                    </td>
                                    <td>
                                      <input
                                        type="number"
                                        style={{ padding: '4px 8px', fontSize: '0.8rem', width: '70px' }}
                                        value={variant.stock_actual}
                                        onChange={(e) => setEditingVariants((current) => current.map((item) =>
                                          item.id_variante === variant.id_variante ? { ...item, stock_actual: e.target.value } : item))}
                                      />
                                    </td>
                                    <td>
                                      <button
                                        type="button"
                                        className="btn btn-ghost"
                                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                        onClick={() => openVariantCoverEditor(variant)}
                                      >
                                        📷 Foto
                                      </button>
                                    </td>
                                    <td>
                                      <button
                                        type="button"
                                        className="btn btn-primary"
                                        style={{ padding: '4px 10px', fontSize: '0.75rem' }}
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
                        )}
                      </div>
                    )}
                  </div>
                )
              ) : (
                /* --- FORMULARIO DE CREACIÓN NUEVA --- */
                <form
                  id="create-entity-form"
                  className="grid-form"
                  onSubmit={async (e) => {
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
                    } catch (err) {
                      setError(err.message);
                      pushToast(err.message, "error");
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                >
                  <label>
                    Nombre {tab === "categorias" ? "de la categoría" : "del producto"}
                    <input
                      required
                      value={form.nombre || ""}
                      onChange={(e) => setForm((s) => ({ ...s, nombre: e.target.value }))}
                      placeholder={tab === "categorias" ? "Ej: Calzado, Ropa, Electrónica..." : "Ej: Zapatillas Urban Pro..."}
                    />
                  </label>

                  {tab === "categorias" ? (
                    <>
                      <label>
                        Categoría padre
                        <select
                          value={form.id_categoria_padre || ""}
                          onChange={(e) => setForm((s) => ({ ...s, id_categoria_padre: e.target.value || null }))}
                        >
                          <option value="">Categoría raíz</option>
                          {categoryOptions.map((c) => (
                            <option key={c.id_categoria} value={c.id_categoria}>{c.label}</option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Orden de visualización
                        <input
                          type="number"
                          min="0"
                          value={form.orden || 0}
                          onChange={(e) => setForm((s) => ({ ...s, orden: Number(e.target.value || 0) }))}
                        />
                      </label>

                      <CategoryCoverDefaultsFields value={form} onChange={setForm} />

                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={!!form.activa}
                          onChange={(e) => setForm((s) => ({ ...s, activa: e.target.checked }))}
                        />
                        <span>Activar categoría de inmediato</span>
                      </label>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                        <label>
                          Tipo de producto
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
                            <option value="SET">Set / Combo de productos</option>
                          </select>
                        </label>

                        {form.tipo_producto !== "SET" && (
                          <label>
                            Categoría principal
                            <select
                              value={form.id_categoria_principal || ""}
                              onChange={(e) => setForm((s) => ({ ...s, id_categoria_principal: e.target.value || null }))}
                            >
                              <option value="">Sin categoría</option>
                              {categoryOptions.map((c) => (
                                <option key={c.id_categoria} value={c.id_categoria}>{c.label}</option>
                              ))}
                            </select>
                          </label>
                        )}
                      </div>

                      <label>
                        Descripción
                        <textarea
                          rows={3}
                          placeholder="Describe brevemente el producto..."
                          value={form.descripcion || ""}
                          onChange={(e) => setForm((s) => ({ ...s, descripcion: e.target.value }))}
                        />
                      </label>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                        <label>
                          Precio de venta (Bs.)
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={form.precio_venta || 0}
                            onChange={(e) => setForm((s) => ({ ...s, precio_venta: e.target.value }))}
                          />
                        </label>

                        {form.tipo_producto !== "SET" && (
                          <label>
                            Stock inicial
                            <input
                              type="number"
                              min="0"
                              value={form.stock_actual || 0}
                              onChange={(e) => setForm((s) => ({ ...s, stock_actual: e.target.value }))}
                            />
                          </label>
                        )}
                      </div>

                      {form.tipo_producto === "SET" && (
                        <SetComponentsEditor
                          value={form.componentes || []}
                          onChange={(componentes) => setForm((current) => ({
                            ...current,
                            componentes,
                          }))}
                          products={rows}
                          categoryOptions={categoryOptions}
                        />
                      )}

                      <ImageDropZone
                        title="Foto de portada"
                        subtitle="Arrastra una foto o haz clic para seleccionarla"
                        previewUrl={pendingImagePreviewUrl}
                        selectedFileName={pendingImageFile?.name || ""}
                        onFileSelected={(file) => openProductCoverEditor(form, { target: "new", file })}
                      />

                      {pendingImageFile && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => openProductCoverEditor(form, {
                            target: "new",
                            file: pendingImageFile,
                            imageUrl: pendingImagePreviewUrl,
                          })}
                        >
                          🎨 Re-ajustar encuadre de portada
                        </button>
                      )}

                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={!!form.activo}
                          onChange={(e) => setForm((s) => ({ ...s, activo: e.target.checked }))}
                        />
                        <span>Activar producto de inmediato</span>
                      </label>
                    </>
                  )}
                </form>
              )}
            </div>

            {/* Footer con Acciones de Guardar / Cancelar */}
            <footer className="catalog-modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeEntityEditor}
                disabled={isSaving}
              >
                Cancelar
              </button>

              {editing ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={isSaving}
                  onClick={async () => {
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
                    } catch (e) {
                      setError(e.message);
                      pushToast(e.message, "error");
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                >
                  {isSaving ? "Guardando..." : "Guardar Cambios"}
                </button>
              ) : (
                <button
                  type="submit"
                  form="create-entity-form"
                  className="btn btn-primary"
                  disabled={isSaving}
                >
                  {isSaving ? "Guardando..." : `Crear ${tab === "categorias" ? "Categoría" : "Producto"}`}
                </button>
              )}
            </footer>
          </section>
        </div>
      )}

      {/* MODAL DE ENCUADRE VISUAL DE PORTADA */}
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

      {/* STACK GLOBAL DE NOTIFICACIONES TOAST */}
      <ToastStack items={toasts} onDismiss={dismissToast} />
    </div>
  );
}
