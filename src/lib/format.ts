export function formatMoney(amount: number, currency: string = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrencyCode(code: string | undefined) {
  return (code ?? "USD").toUpperCase();
}


