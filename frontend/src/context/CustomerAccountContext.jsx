import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  getCustomerAccount,
  getCustomerOrders,
  loginCustomer,
  registerCustomer,
} from "../api/api";

const CustomerAccountContext = createContext(null);

function getStoreSlug() {
  const params = new URLSearchParams(window.location.search);
  return params.get("slug") || import.meta.env.VITE_DEFAULT_STORE_SLUG || "demo-accesorios";
}

function tokenKey(slug) {
  return "customer_token:" + slug;
}

export function CustomerAccountProvider({ children }) {
  const slug = useMemo(() => getStoreSlug(), []);
  const [token, setToken] = useState(() => localStorage.getItem(tokenKey(slug)) || "");
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(Boolean(token));

  const saveSession = useCallback((data) => {
    const nextToken = data?.access_token || "";
    setToken(nextToken);
    setCustomer(data?.customer || null);
    if (nextToken) localStorage.setItem(tokenKey(slug), nextToken);
  }, [slug]);

  const logout = useCallback(() => {
    localStorage.removeItem(tokenKey(slug));
    setToken("");
    setCustomer(null);
    setOrders([]);
  }, [slug]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let active = true;
    getCustomerAccount(slug, token)
      .then((data) => {
        if (active) setCustomer(data);
      })
      .catch(() => {
        if (active) logout();
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [logout, slug, token]);

  const login = async (credentials) => {
    const data = await loginCustomer(slug, credentials);
    saveSession(data);
    return data.customer;
  };

  const register = async (payload) => {
    const data = await registerCustomer(slug, payload);
    saveSession(data);
    return data.customer;
  };

  const loadOrders = async () => {
    if (!token) return [];
    const data = await getCustomerOrders(slug, token);
    setOrders(Array.isArray(data) ? data : []);
    return data;
  };

  return (
    <CustomerAccountContext.Provider value={{
      slug,
      token,
      customer,
      orders,
      loading,
      login,
      register,
      logout,
      loadOrders,
    }}>
      {children}
    </CustomerAccountContext.Provider>
  );
}

export function useCustomerAccount() {
  const context = useContext(CustomerAccountContext);
  if (!context) throw new Error("useCustomerAccount debe usarse dentro de CustomerAccountProvider");
  return context;
}