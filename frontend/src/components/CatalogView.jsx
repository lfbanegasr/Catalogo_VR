import useCatalog from "../api/useCatalog";
import { useCart } from "../context/CartContext";
import { buildAssetUrl } from "../api/api";

function formatPrice(value) {
  return new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
    minimumFractionDigits: 2,
  })
    .format(Number(value || 0))
    .replace("BOB", "Bs.");
}

export function CatalogView({ slug, onOpenCart }) {
  const { catalog, loading, error, refetch } = useCatalog(slug);
  const { addToCart, cartCount } = useCart();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
        <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-500 font-medium animate-pulse">Cargando catálogo...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] p-6 text-center bg-red-50 border border-red-100 rounded-2xl">
        <p className="text-red-600 font-semibold mb-3">Ocurrió un error: {error}</p>
        <button onClick={refetch} className="px-5 py-2.5 bg-red-600 text-white rounded-xl font-medium shadow-sm hover:bg-red-700 transition">
          Reintentar
        </button>
      </div>
    );
  }

  if (!catalog || !catalog.productos || catalog.productos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] p-6 text-center">
        <p className="text-gray-500 font-medium">No hay productos disponibles en esta tienda.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-24">
      {/* Hero Header */}
      <header className="bg-gradient-to-r from-pink-500 to-rose-600 text-white px-5 py-8 rounded-b-[2rem] shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <span className="text-[10px] uppercase font-bold tracking-wider opacity-85">Catálogo Web</span>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1">{catalog.tienda?.nombre_tienda || "Tienda Virtual"}</h1>
          <p className="text-sm opacity-90 mt-1 font-medium">Selecciona tus productos y ordénalos directo por WhatsApp</p>
        </div>
        <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 bg-white opacity-10 rounded-full blur-xl"></div>
      </header>

      {/* Categorías */}
      {catalog.categorias && catalog.categorias.length > 0 && (
        <div className="px-5 mt-6">
          <h2 className="text-xs uppercase font-bold tracking-wider text-gray-400 mb-3">Categorías</h2>
          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
            <span className="flex-none px-4 py-2 bg-pink-500 text-white text-xs font-semibold rounded-full shadow-sm cursor-pointer">
              Todos
            </span>
            {catalog.categorias.map((cat) => (
              <span key={cat.id} className="flex-none px-4 py-2 bg-white text-gray-700 text-xs font-semibold rounded-full border border-gray-100 shadow-sm cursor-pointer hover:bg-gray-50 transition">
                {cat.nombre}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Lista de Productos (Grid Responsivo Mobile-First) */}
      <main className="px-5 mt-6 flex-1">
        <h2 className="text-xs uppercase font-bold tracking-wider text-gray-400 mb-4">Productos disponibles</h2>
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4">
          {catalog.productos.map((product) => {
            const imageSrc = buildAssetUrl(product.imagen_url);
            return (
              <div key={product.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition duration-200">
                {/* Imagen del producto */}
                <div className="aspect-square bg-gray-100 relative overflow-hidden flex items-center justify-center">
                  {imageSrc ? (
                    <img src={imageSrc} alt={product.nombre} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-gray-400">Sin foto</span>
                  )}
                  {product.badge_text && (
                    <span className="absolute top-2 left-2 bg-pink-500 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-sm">
                      {product.badge_text}
                    </span>
                  )}
                </div>

                {/* Info del producto */}
                <div className="p-3 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-gray-800 line-clamp-2 min-h-[32px]">{product.nombre}</h3>
                    {product.descripcion && (
                      <p className="text-[10px] text-gray-400 mt-1 line-clamp-2 leading-relaxed">{product.descripcion}</p>
                    )}
                  </div>
                  <div className="mt-3">
                    <p className="text-sm font-black text-pink-600">{formatPrice(product.precio_final || product.precio)}</p>
                    {product.precio_original > product.precio_final && (
                      <p className="text-[10px] text-gray-400 line-through mt-0.5">{formatPrice(product.precio_original)}</p>
                    )}
                    <button
                      onClick={() => addToCart(product)}
                      className="w-full mt-3 py-2 bg-pink-550 bg-pink-600 hover:bg-pink-700 text-white text-[11px] font-bold rounded-xl shadow-sm active:scale-95 transition-transform duration-100"
                    >
                      Añadir
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Floating Action Button (FAB) para el Carrito */}
      {cartCount > 0 && (
        <button
          onClick={onOpenCart}
          className="fixed bottom-6 right-6 bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-5 py-4 rounded-full shadow-2xl flex items-center gap-2.5 z-40 active:scale-95 transition-transform duration-100"
        >
          <div className="relative">
            {/* Ícono de carrito simplificado en SVG */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <span className="absolute -top-2.5 -right-2 bg-rose-500 text-white text-[9px] font-black rounded-full h-5 w-5 flex items-center justify-center border-2 border-emerald-500">
              {cartCount}
            </span>
          </div>
          <span className="text-xs font-black uppercase tracking-wider">Ver pedido</span>
        </button>
      )}
    </div>
  );
}

export default CatalogView;
