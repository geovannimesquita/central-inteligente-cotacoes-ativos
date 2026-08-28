/**
 * Normalizacao das respostas da AwesomeAPI (moedas tradicionais).
 *
 * A resposta e um objeto chaveado pelo par sem hifen ("USDBRL") e todos os
 * campos numericos chegam como string. O preco exibido usa `bid` (compra), que
 * e a referencia divulgada pela propria AwesomeAPI.
 */

import { getAssetByAwesomeKey } from "../assets.ts";
import { AppError } from "../errors.ts";
import type { NormalizedQuote } from "../../types/index.ts";
import { isRecord, isStale, toFiniteNumber, toPositiveNumber, unixSecondsToIso } from "./shared.ts";

export interface NormalizeOptions {
  now?: number;
  staleThresholdSeconds?: number;
}

/**
 * Converte o payload bruto da AwesomeAPI em cotacoes normalizadas.
 *
 * Entradas desconhecidas (fora do catalogo) ou sem preco utilizavel sao
 * descartadas silenciosamente — uma moeda com defeito nao pode derrubar o
 * painel inteiro. Payload que nao e objeto vira `AppError`.
 */
export function normalizeAwesomeApiResponse(
  payload: unknown,
  options: NormalizeOptions = {},
): NormalizedQuote[] {
  if (!isRecord(payload)) {
    throw new AppError("UPSTREAM_INVALID_JSON", { source: "AwesomeAPI" });
  }

  const now = options.now ?? Date.now();
  const quotes: NormalizedQuote[] = [];

  for (const [key, rawEntry] of Object.entries(payload)) {
    if (!isRecord(rawEntry)) continue;

    const asset = getAssetByAwesomeKey(key);
    if (!asset) continue;

    const price = toPositiveNumber(rawEntry.bid);
    if (price === null) continue;

    // `create_date` vem no fuso de Brasilia sem indicador de offset, entao o
    // `timestamp` (epoch em segundos) e a fonte confiavel de horario.
    const updatedAt = unixSecondsToIso(rawEntry.timestamp) ?? new Date(now).toISOString();

    quotes.push({
      id: asset.id,
      name: asset.name,
      symbol: asset.symbol,
      category: asset.category,
      price,
      referenceCurrency: "BRL",
      changePercentage: toFiniteNumber(rawEntry.pctChange),
      high: toPositiveNumber(rawEntry.high),
      low: toPositiveNumber(rawEntry.low),
      source: "AwesomeAPI",
      updatedAt,
      stale: isStale(updatedAt, now, options.staleThresholdSeconds),
    });
  }

  return quotes;
}
