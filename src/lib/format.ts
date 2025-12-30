import { DEFAULT_CURRENCY } from "@/shared/currency";

export function formatMoney(amount: number, currency: string = DEFAULT_CURRENCY) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrencyCode(code: string | undefined) {
  return (code ?? DEFAULT_CURRENCY).toUpperCase();
}


