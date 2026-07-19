import { useState, useEffect, useCallback } from "react";
import axiosInstance from "./axiosConfig";

/**
 * Custom Hook para consumir el catálogo público de una tienda (flujo B2C).
 * @param {string} slug - El slug único de la tienda.
 */
export function useCatalog(slug) {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCatalog = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const response = await axiosInstance.get(`/public/catalog/${slug}`);
      setCatalog(response.data);
    } catch (err) {
      console.error("Error al obtener el catálogo público:", err);
      setError(err.response?.data?.detail || err.message || "Error al cargar el catálogo.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  // Cargar el catálogo al montar o cuando cambie el slug
  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  return {
    catalog,
    loading,
    error,
    refetch: fetchCatalog,
  };
}

export default useCatalog;
