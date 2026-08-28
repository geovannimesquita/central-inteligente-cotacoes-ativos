/**
 * Catalogo de ativos acompanhados — tambem funciona como lista de permissao.
 *
 * Nenhuma rota aceita identificador de ativo fora deste catalogo, e nenhum
 * trecho de URL externa vem do usuario: o backend so conhece `sourceKey` daqui.
 */

import type { AssetCategory, AssetDefinition } from "../types/index.ts";

export const ASSET_CATALOG: readonly AssetDefinition[] = [
  {
    id: "usd-brl",
    name: "Dolar Americano",
    symbol: "USD",
    category: "currency",
    source: "AwesomeAPI",
    sourceKey: "USD-BRL",
    active: true,
  },
  {
    id: "eur-brl",
    name: "Euro",
    symbol: "EUR",
    category: "currency",
    source: "AwesomeAPI",
    sourceKey: "EUR-BRL",
    active: true,
  },
  {
    id: "gbp-brl",
    name: "Libra Esterlina",
    symbol: "GBP",
    category: "currency",
    source: "AwesomeAPI",
    sourceKey: "GBP-BRL",
    active: true,
  },
  {
    id: "bitcoin",
    name: "Bitcoin",
    symbol: "BTC",
    category: "crypto",
    source: "CoinGecko",
    sourceKey: "bitcoin",
    active: true,
  },
  {
    id: "ethereum",
    name: "Ethereum",
    symbol: "ETH",
    category: "crypto",
    source: "CoinGecko",
    sourceKey: "ethereum",
    active: true,
  },
  {
    id: "solana",
    name: "Solana",
    symbol: "SOL",
    category: "crypto",
    source: "CoinGecko",
    sourceKey: "solana",
    active: true,
  },
] as const;

const BY_ID = new Map(ASSET_CATALOG.map((asset) => [asset.id, asset]));

/** Chave da AwesomeAPI ("USDBRL") -> definicao do ativo. */
const BY_AWESOME_KEY = new Map(
  ASSET_CATALOG.filter((asset) => asset.source === "AwesomeAPI").map((asset) => [
    asset.sourceKey.replace("-", ""),
    asset,
  ]),
);

/** Id da CoinGecko ("bitcoin") -> definicao do ativo. */
const BY_COINGECKO_ID = new Map(
  ASSET_CATALOG.filter((asset) => asset.source === "CoinGecko").map((asset) => [
    asset.sourceKey,
    asset,
  ]),
);

export function getAssetById(id: string): AssetDefinition | undefined {
  return BY_ID.get(id);
}

export function getAssetByAwesomeKey(key: string): AssetDefinition | undefined {
  return BY_AWESOME_KEY.get(key.toUpperCase());
}

export function getAssetByCoinGeckoId(id: string): AssetDefinition | undefined {
  return BY_COINGECKO_ID.get(id.toLowerCase());
}

export function isKnownAssetId(id: string): boolean {
  return BY_ID.has(id);
}

export function getAssetsByCategory(category: AssetCategory): AssetDefinition[] {
  return ASSET_CATALOG.filter((asset) => asset.category === category && asset.active);
}

/** Pares consultados na AwesomeAPI, no formato "USD-BRL,EUR-BRL,GBP-BRL". */
export function getAwesomeApiPairs(): string {
  return getAssetsByCategory("currency")
    .map((asset) => asset.sourceKey)
    .join(",");
}

/** Ids consultados na CoinGecko, no formato "bitcoin,ethereum,solana". */
export function getCoinGeckoIds(): string {
  return getAssetsByCategory("crypto")
    .map((asset) => asset.sourceKey)
    .join(",");
}
