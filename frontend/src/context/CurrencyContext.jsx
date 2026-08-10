import { createContext, useContext } from "react";

const CurrencyContext = createContext("S/");

export function CurrencyProvider({ value, children }) {
  return (
    <CurrencyContext.Provider value={value || "S/"}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
