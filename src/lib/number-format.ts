export function formatWholeNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

export function formatNumber(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

export function formatCurrency(value: number, fractionDigits = 2): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatDisplayValue(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value) ? formatWholeNumber(value) : formatNumber(value);
  }
  return String(value);
}
