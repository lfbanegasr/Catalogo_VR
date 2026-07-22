import React, { useState, useEffect, useMemo } from 'react';

export default function StoreRefPicker({
  stores,
  value,
  onChange,
  required = false,
  label = "Tienda destino",
  placeholder = "Busca por nombre o slug...",
  helpText = "Puedes escribir nombre o slug.",
  allowEmpty = false,
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const selectedStore = useMemo(
    () => stores.find((store) => store.id_tienda === value) || null,
    [stores, value],
  );

  useEffect(() => {
    if (!selectedStore) {
      setText("");
      return;
    }
    setText(`${selectedStore.nombre_tienda} (${selectedStore.slug})`);
  }, [selectedStore]);

  const normalized = text.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (!normalized) return stores.slice(0, 8);
    return stores
      .filter((store) => {
        const name = store.nombre_tienda.toLowerCase();
        const slug = String(store.slug || "").toLowerCase();
        return name.includes(normalized) || slug.includes(normalized);
      })
      .slice(0, 8);
  }, [stores, normalized]);

  const selectStore = (store) => {
    if (!store) return;
    setText(`${store.nombre_tienda} (${store.slug})`);
    onChange(store.id_tienda);
    setOpen(false);
  };

  return (
    <label className="store-picker">
      <span className="store-picker-label">{label}</span>
      <div className="smart-search">
        <input
          value={text}
          required={required}
          autoComplete="off"
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => {
              const typed = text.trim().toLowerCase();
              if (typed) {
                const best = stores.find((store) => {
                  const label = `${store.nombre_tienda} (${store.slug})`.toLowerCase();
                  return (
                    store.nombre_tienda.toLowerCase() === typed ||
                    String(store.slug || "").toLowerCase() === typed ||
                    label === typed
                  );
                });
                if (best) {
                  selectStore(best);
                  return;
                }
              }
              setOpen(false);
            }, 100);
          }}
          onChange={(event) => {
            const next = event.target.value;
            setText(next);
            onChange("");
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && suggestions.length > 0) {
              event.preventDefault();
              selectStore(suggestions[0]);
            }
          }}
        />
        {open ? (
          <div className="smart-search-list">
            {allowEmpty ? (
              <button
                type="button"
                className="smart-search-item"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setText("");
                  onChange("");
                  setOpen(false);
                }}
              >
                <span>Todas las tiendas</span>
                <small>Sin filtro</small>
              </button>
            ) : null}
            {suggestions.length === 0 ? (
              <button type="button" className="smart-search-item empty" disabled>
                Sin resultados
              </button>
            ) : suggestions.map((store) => (
              <button
                key={store.id_tienda}
                type="button"
                className="smart-search-item"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectStore(store)}
              >
                <span>{store.nombre_tienda}</span>
                <small>{store.slug}</small>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <span className="store-picker-help">
        {helpText}
      </span>
    </label>
  );
}
