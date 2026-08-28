/**
 * Orquestracao das cotacoes: cache, chamada paralela as duas APIs, combinacao
 * dos resultados e tolerancia a falha parcial.
 *
 * Cada fonte tem a propria chave de cache e o proprio TTL. Se a AwesomeAPI cair
 * mas a CoinGecko responder, a rota devolve os criptoativos com um aviso — e o
 * inverso tambem vale. So quando as duas falham a requisicao vira erro.
 */

import { ASSET_CATALOG } from "./assets.ts";
import { CACHE_KEYS, readCache, writeCache } from "./cache.ts";
import { getCacheTtlSeconds } from "./config.ts";
import { describeForLog, toAppError } from "./errors.ts";
import { fetchCurrencyQuotes } from "./integrations/awesome-api.ts";
import { fetchCryptoQuotes } from "./integrations/coingecko.ts";
import { isStale } from "./normalize/shared.ts";
import type {
  ApiWarning,
  IntegrationStatus,
  NormalizedQuote,
  QuotesResponse,
} from "../types/index.ts";

/** Ordem de exibicao estavel: a do catalogo, nao a de chegada das APIs. */
const CATALOG_ORDER = new Map(ASSET_CATALOG.map((asset, index) => [asset.id, index]));

function sortByCatalogOrder(quotes: NormalizedQuote[]): NormalizedQuote[] {
  return [...quotes].sort(
    (a, b) => (CATALOG_ORDER.get(a.id) ?? 999) - (CATALOG_ORDER.get(b.id) ?? 999),
  );
}

interface SourceResult {
  quotes: NormalizedQuote[];
  status: IntegrationStatus;
  cached: boolean;
  warning: ApiWarning | null;
}

/**
 * Resolve uma fonte usando cache quando possivel.
 *
 * Em caso de falha, um cache expirado ainda e preferivel a nenhum dado: os
 * itens sao devolvidos marcados como `stale` e a fonte e reportada como
 * `degraded`, deixando claro na interface que aquilo nao e dado fresco.
 */
async function resolveSource(
  cacheKey: string,
  label: string,
  loader: (signal?: AbortSignal) => Promise<NormalizedQuote[]>,
  forceRefresh: boolean,
  signal?: AbortSignal,
): Promise<SourceResult> {
  const ttl = getCacheTtlSeconds();

  if (!forceRefresh) {
    const cached = readCache<NormalizedQuote[]>(cacheKey);
    if (cached) {
      return { quotes: cached.value, status: "available", cached: true, warning: null };
    }
  }

  try {
    const quotes = await loader(signal);
    writeCache(cacheKey, quotes, ttl);
    return { quotes, status: "available", cached: false, warning: null };
  } catch (error) {
    const appError = toAppError(error);
    // Log de servidor sem stack trace, sem token e sem URL com segredo.
    console.warn(`[quotes] falha ao consultar ${label} -> ${describeForLog(appError)}`);

    const staleEntry = readStaleEntry(cacheKey);
    if (staleEntry) {
      return {
        quotes: staleEntry.map((quote) => ({ ...quote, stale: true })),
        status: "degraded",
        cached: true,
        warning: {
          code: appError.code,
          message: `${label}: ${appError.message} Exibindo o ultimo dado conhecido.`,
        },
      };
    }

    return {
      quotes: [],
      status: "unavailable",
      cached: false,
      warning: { code: appError.code, message: `${label}: ${appError.message}` },
    };
  }
}

/**
 * Le uma entrada mesmo expirada. Usado somente no caminho de degradacao, quando
 * a API de origem falhou e dado antigo rotulado e melhor que tela vazia.
 */
function readStaleEntry(cacheKey: string): NormalizedQuote[] | null {
  const fresh = readCache<NormalizedQuote[]>(cacheKey);
  if (fresh) return fresh.value;

  const fallback = staleFallback.get(cacheKey);
  return fallback ?? null;
}

/** Ultimo resultado bem-sucedido por fonte, preservado alem do TTL. */
const staleFallback = new Map<string, NormalizedQuote[]>();

export interface GetQuotesOptions {
  forceRefresh?: boolean;
  signal?: AbortSignal;
}

/** Ponto de entrada usado por `/api/quotes` e pela automacao de alertas. */
export async function getCombinedQuotes(
  options: GetQuotesOptions = {},
): Promise<QuotesResponse> {
  const { forceRefresh = false, signal } = options;

  const [currencyResult, cryptoResult] = await Promise.all([
    resolveSource(CACHE_KEYS.currencyQuotes, "AwesomeAPI", fetchCurrencyQuotes, forceRefresh, signal),
    resolveSource(CACHE_KEYS.cryptoQuotes, "CoinGecko", fetchCryptoQuotes, forceRefresh, signal),
  ]);

  if (currencyResult.status === "available" && !currencyResult.cached) {
    staleFallback.set(CACHE_KEYS.currencyQuotes, currencyResult.quotes);
  }
  if (cryptoResult.status === "available" && !cryptoResult.cached) {
    staleFallback.set(CACHE_KEYS.cryptoQuotes, cryptoResult.quotes);
  }

  const now = Date.now();
  // Reavalia o frescor na leitura: um item servido do cache pode ter envelhecido
  // desde a gravacao.
  const data = sortByCatalogOrder([...currencyResult.quotes, ...cryptoResult.quotes]).map(
    (quote) => ({ ...quote, stale: quote.stale || isStale(quote.updatedAt, now) }),
  );

  const warnings: ApiWarning[] = [];
  if (currencyResult.warning) warnings.push(currencyResult.warning);
  if (cryptoResult.warning) warnings.push(cryptoResult.warning);

  return {
    data,
    meta: {
      sources: {
        awesomeApi: currencyResult.status,
        coinGecko: cryptoResult.status,
      },
      cached: currencyResult.cached && cryptoResult.cached,
      updatedAt: new Date(now).toISOString(),
    },
    warnings,
  };
}

/** `true` quando nenhuma das duas fontes entregou dado algum. */
export function isTotalFailure(response: QuotesResponse): boolean {
  return (
    response.data.length === 0 &&
    response.meta.sources.awesomeApi !== "available" &&
    response.meta.sources.coinGecko !== "available"
  );
}
