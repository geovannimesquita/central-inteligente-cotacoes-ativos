/**
 * Normalizacao das respostas da CoinGecko (criptoativos).
 *
 * O endpoint `simple/price` devolve um objeto chaveado pelo id da moeda com os
 * campos `brl`, `brl_24h_change` e `last_updated_at`. Nao ha maximo nem minimo
 * do dia nesse endpoint — os campos ficam `null`, e a interface trata a
 * ausencia sem inventar valores.
 */

import { getAssetByCoinGeckoId } from "../assets.ts";
import { AppError } from "../errors.ts";
import type { NormalizedQuote } from "../../types/index.ts";
import { isRecord, isStale, toFiniteNumber, toPositiveNumber, unixSecondsToIso } from "./shared.ts";
import type { NormalizeOptions } from "./awesome.ts";

export function normalizeCoinGeckoResponse(
  payload: unknown,
  options: NormalizeOptions = {},
): NormalizedQuote[] {
  if (!isRecord(payload)) {
    throw new AppError("UPSTREAM_INVALID_JSON", { source: "CoinGecko" });
  }

  const now = options.now ?? Date.now();
  const quotes: NormalizedQuote[] = [];

  for (const [coinId, rawEntry] of Object.entries(payload)) {
    if (!isRecord(rawEntry)) continue;

    const asset = getAssetByCoinGeckoId(coinId);
    if (!asset) continue;

    const price = toPositiveNumber(rawEntry.brl);
    if (price === null) continue;

    const updatedAt = unixSecondsToIso(rawEntry.last_updated_at) ?? new Date(now).toISOString();

    quotes.push({
      id: asset.id,
      name: asset.name,
      symbol: asset.symbol,
      category: asset.category,
      price,
      referenceCurrency: "BRL",
      changePercentage: toFiniteNumber(rawEntry.brl_24h_change),
      // O endpoint simple/price nao expoe maxima/minima do periodo.
      high: null,
      low: null,
      source: "CoinGecko",
      updatedAt,
      stale: isStale(updatedAt, now, options.staleThresholdSeconds),
    });
  }

  return quotes;
}
