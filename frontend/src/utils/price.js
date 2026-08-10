export function formatPrice(value, symbol = "S/") {
  const num = Number(value || 0).toFixed(2);
  const parts = num.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${symbol} ${parts.join(".")}`;
}
