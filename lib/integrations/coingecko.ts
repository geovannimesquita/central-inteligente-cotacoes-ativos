/**
 * Integracao somente leitura com a CoinGecko (criptoativos).
 *
 * Funciona no acesso publico. Se `COINGECKO_API_KEY` estiver definida, a chave
 * Demo e enviada no cabecalho `x-cg-demo-api-key`. A chave e lida apenas aqui,
 * no servidor, e nunca aparece em resposta, log ou HTML.
 */

import { getCoinGeckoIds } from "../assets.ts";
import { getCoinGeckoApiKey } from "../config.ts";
import { fetchJson } from "../http.ts";
import { normalizeCoinGeckoResponse } from "../normalize/coingecko.ts";
import type { NormalizedQuote } from "../../types/index.ts";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export const COINGECKO_SOURCE_LABEL = "CoinGecko";

function buildHeaders(): Record<string, string> {
  const apiKey = getCoinGeckoApiKey();
  return apiKey ? { "x-cg-demo-api-key": apiKey } : {};
}

function buildSimplePriceUrl(): string {
  const params = new URLSearchParams({
    ids: getCoinGeckoIds(),
    vs_currencies: "brl",
    include_24hr_change: "true",
    include_last_updated_at: "true",
  });
  return `${COINGECKO_BASE}/simple/price?${params.toString()}`;
}

/** Busca e normaliza as cotacoes dos criptoativos do catalogo. */
export async function fetchCryptoQuotes(signal?: AbortSignal): Promise<NormalizedQuote[]> {
  const payload = await fetchJson(buildSimplePriceUrl(), {
    source: COINGECKO_SOURCE_LABEL,
    headers: buildHeaders(),
    ...(signal ? { signal } : {}),
  });

  return normalizeCoinGeckoResponse(payload);
}

/** Consulta leve usada pelo endpoint de saude. */
export async function probeCoinGecko(signal?: AbortSignal): Promise<void> {
  await fetchJson(`${COINGECKO_BASE}/ping`, {
    source: COINGECKO_SOURCE_LABEL,
    headers: buildHeaders(),
    timeoutMs: 4000,
    maxAttempts: 1,
    ...(signal ? { signal } : {}),
  });
}

/** Indica se a chave Demo opcional esta presente (sem revelar o valor). */
export function hasCoinGeckoApiKey(): boolean {
  return getCoinGeckoApiKey() !== undefined;
}
