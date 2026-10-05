import axios from "axios";

export function getApiBaseUrl() {
  const envBase = (import.meta.env.VITE_API_BASE || "").trim().replace(/\/+$/, "");
  if (envBase) {
    return envBase;
  }
  if (import.meta.env.PROD) {
    const errorMsg = "Error de configuración: La variable de entorno VITE_API_BASE es obligatoria en producción para comunicarse con Render.";
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  return "http://127.0.0.1:8000";
}

const axiosInstance = axios.create({
  baseURL: `${getApiBaseUrl()}/api`,
  timeout: 10000,
});

// Interceptor para inyectar el token JWT automáticamente en las cabeceras
axiosInstance.interceptors.request.use(
  (config) => {
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
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
