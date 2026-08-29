import { DEFAULT_CURRENCY } from "@/shared/currency";

export function formatMoney(amount: number, currency: string = DEFAULT_CURRENCY) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrencyCode(code: string | undefined) {
  return (code ?? DEFAULT_CURRENCY).toUpperCase();
}

export function getCurrencySymbol(currency: string = DEFAULT_CURRENCY) {
  try {
    const part = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 0,
    })
      .formatToParts(0)
      .find((p) => p.type === "currency");
    return part?.value ?? formatCurrencyCode(currency);
  } catch {
    return formatCurrencyCode(currency);
  }
}


