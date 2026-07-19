function CategoryFilter({
  categories,
  selectedCategoryId,
  onSelectCategoryId,
  disabled = false,
}) {
  const allCategories = [
    { id: "all", nombre: "Todas" },
    ...(Array.isArray(categories) ? categories : []),
  ];

  return (
    <div className="pill-row" role="tablist" aria-label="Filtrar por categoria">
      {allCategories.map((category) => {
        const active = String(selectedCategoryId) === String(category.id);

        return (
          <button
            key={category.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            className={`pill ${active ? "pill-active" : ""}`}
            onClick={() => onSelectCategoryId(category.id)}
          >
            {category.nombre || category.name || "Categoria"}
          </button>
        );
      })}
    </div>
  );
}

export default CategoryFilter;
