/**
 * Integracao somente leitura com a AwesomeAPI (moedas tradicionais).
 *
 * Funciona no acesso publico, que a AwesomeAPI limita por IP. Se
 * `AWESOMEAPI_TOKEN` estiver definido, o token e enviado no cabecalho
 * `x-api-key` e a cota passa a ser da conta — necessario em hospedagem
 * serverless, onde o IP de saida e compartilhado e a cota por IP ja chega
 * esgotada. O token e lido apenas aqui, no servidor, e nunca vai para o
 * navegador, para a URL ou para logs.
 *
 * O host e o caminho sao constantes deste modulo: nenhuma parte da URL vem de
 * entrada do usuario.
 */

import { getAwesomeApiPairs } from "../assets.ts";
import { getAwesomeApiToken } from "../config.ts";
import { fetchJson } from "../http.ts";
import { normalizeAwesomeApiResponse } from "../normalize/awesome.ts";
import type { NormalizedQuote } from "../../types/index.ts";

const AWESOME_API_BASE = "https://economia.awesomeapi.com.br/json/last";

export const AWESOME_API_SOURCE_LABEL = "AwesomeAPI";

/**
 * Cabecalho de autenticacao.
 *
 * A AwesomeAPI aceita o token por query string (`?token=`) ou por cabecalho
 * (`x-api-key`). Usamos o cabecalho de proposito: assim o segredo nao aparece em
 * URL, que costuma ser registrada em log de proxy e de servidor.
 */
function buildHeaders(): Record<string, string> {
  const token = getAwesomeApiToken();
  return token ? { "x-api-key": token } : {};
}

/** Busca e normaliza as cotacoes das moedas do catalogo. */
export async function fetchCurrencyQuotes(signal?: AbortSignal): Promise<NormalizedQuote[]> {
  const pairs = getAwesomeApiPairs();
  const url = `${AWESOME_API_BASE}/${encodeURIComponent(pairs)}`;

  const payload = await fetchJson(url, {
    source: AWESOME_API_SOURCE_LABEL,
    headers: buildHeaders(),
    ...(signal ? { signal } : {}),
  });

  return normalizeAwesomeApiResponse(payload);
}

/** Consulta leve usada pelo endpoint de saude. */
export async function probeAwesomeApi(signal?: AbortSignal): Promise<void> {
  await fetchJson(`${AWESOME_API_BASE}/USD-BRL`, {
    source: AWESOME_API_SOURCE_LABEL,
    headers: buildHeaders(),
    timeoutMs: 4000,
    maxAttempts: 1,
    ...(signal ? { signal } : {}),
  });
}

/** Indica se o token opcional esta presente (sem revelar o valor). */
export function hasAwesomeApiToken(): boolean {
  return getAwesomeApiToken() !== undefined;
}
