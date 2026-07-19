import axios from "axios";

// Obtener la URL base desde las variables de entorno de Vite o usar fallback de desarrollo
const API_BASE_URL = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const axiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000,
});

// Interceptor para inyectar el token JWT automáticamente en las cabeceras
axiosInstance.interceptors.request.use(
  (config) => {
    // Usamos la misma clave que ya se usa en la aplicación para guardar el token
    const token = localStorage.getItem("tienda_admin_token");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor de respuesta para manejar errores globales (ej: desautenticación)
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn("Token inválido o expirado. Limpiando sesión...");
      localStorage.removeItem("tienda_admin_token");
      // Opcional: Redirigir al login si el contexto del router estuviera configurado
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
