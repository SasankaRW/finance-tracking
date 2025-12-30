import { useQuery } from "@tanstack/react-query";

export type FxRatesResponse = {
  base: string;
  timestamp: number | null;
  rates: Record<string, number>;
};

function norm(code: string) {
  return (code ?? "").trim().toUpperCase();
}

async function fetchFxRates(base: string, symbols: string[]): Promise<FxRatesResponse> {
  // For static export, call the external API directly
  const upstream = await fetch(`https://open.er-api.com/v6/latest/${base}`);
  
  if (!upstream.ok) {
    throw new Error("Failed to fetch FX rates");
  }

  const json = (await upstream.json()) as any;
  if (json?.result !== "success" || typeof json?.rates !== "object") {
    throw new Error("Unexpected FX response");
  }

  const allRates = json.rates as Record<string, number>;
  const rates: Record<string, number> = {};
  
  if (symbols.length === 0) {
    // If no symbols were requested, just return an empty rates map.
  } else {
    for (const s of symbols) {
      const v = allRates[s];
      if (typeof v === "number") rates[s] = v;
    }
  }

  return {
    base,
    timestamp: json.time_last_update_unix ?? null,
    rates,
  };
}

export function useFxRates(base: string, symbols: string[]) {
  const baseN = norm(base);
  const symbolsN = Array.from(new Set((symbols ?? []).map(norm).filter(Boolean))).sort();

  return useQuery({
    queryKey: ["fx", baseN, symbolsN],
    enabled: Boolean(baseN) && symbolsN.length > 0,
    queryFn: () => fetchFxRates(baseN, symbolsN),
    staleTime: 60 * 60 * 1000, // Cache for 1 hour
  });
}


