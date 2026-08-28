/**
 * Integracao somente leitura com a AwesomeAPI (moedas tradicionais).
 *
 * Endpoint publico, sem autenticacao. O host e o caminho sao constantes deste
 * modulo: nenhuma parte da URL vem de entrada do usuario.
 */

import { getAwesomeApiPairs } from "../assets.ts";
import { fetchJson } from "../http.ts";
import { normalizeAwesomeApiResponse } from "../normalize/awesome.ts";
import type { NormalizedQuote } from "../../types/index.ts";

const AWESOME_API_BASE = "https://economia.awesomeapi.com.br/json/last";

export const AWESOME_API_SOURCE_LABEL = "AwesomeAPI";

/** Busca e normaliza as cotacoes das moedas do catalogo. */
export async function fetchCurrencyQuotes(signal?: AbortSignal): Promise<NormalizedQuote[]> {
  const pairs = getAwesomeApiPairs();
  const url = `${AWESOME_API_BASE}/${encodeURIComponent(pairs)}`;

  const payload = await fetchJson(url, {
    source: AWESOME_API_SOURCE_LABEL,
    ...(signal ? { signal } : {}),
  });

  return normalizeAwesomeApiResponse(payload);
}

/** Consulta leve usada pelo endpoint de saude. */
export async function probeAwesomeApi(signal?: AbortSignal): Promise<void> {
  await fetchJson(`${AWESOME_API_BASE}/USD-BRL`, {
    source: AWESOME_API_SOURCE_LABEL,
    timeoutMs: 4000,
    maxAttempts: 1,
    ...(signal ? { signal } : {}),
  });
}
