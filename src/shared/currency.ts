export const DEFAULT_CURRENCY = "USD";

// Keep the list short and practical; you can extend any time.
export const COMMON_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "JPY",
  "CNY",
  "INR",
] as const;

export type CommonCurrency = (typeof COMMON_CURRENCIES)[number];


