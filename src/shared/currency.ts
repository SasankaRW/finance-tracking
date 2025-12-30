// App-wide default currency (used for new records and generic fallbacks).
export const DEFAULT_CURRENCY = "LKR";
export const HOME_CURRENCY = "LKR";

// Keep the list short and practical; you can extend any time.
export const COMMON_CURRENCIES = [
  "LKR",
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




