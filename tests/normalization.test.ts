/**
 * Testes de normalizacao.
 *
 * Executados pelo runner nativo do Node (`node --test`), que interpreta
 * TypeScript diretamente no Node 24 — por isso nao ha transpilador nas
 * dependencias do projeto.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { normalizeAwesomeApiResponse } from "../lib/normalize/awesome.ts";
import { normalizeCoinGeckoResponse } from "../lib/normalize/coingecko.ts";
import {
  isStale,
  toFiniteNumber,
  toPositiveNumber,
  unixSecondsToIso,
} from "../lib/normalize/shared.ts";
import { AppError } from "../lib/errors.ts";

/** 2024-06-01T12:00:00Z — instante fixo para tornar os testes deterministicos. */
const NOW = Date.UTC(2024, 5, 1, 12, 0, 0);
/** Timestamp (epoch em segundos) cinco minutos antes de NOW. */
const RECENT_TS = String(Math.floor(NOW / 1000) - 300);

describe("coercao de valores", () => {
  it("converte numeros recebidos como texto", () => {
    assert.equal(toFiniteNumber("5.4321"), 5.4321);
    assert.equal(toFiniteNumber("  -2.5 "), -2.5);
    assert.equal(toFiniteNumber(7), 7);
  });

  it("rejeita texto nao numerico, vazio, nulo e infinito", () => {
    assert.equal(toFiniteNumber("abc"), null);
    assert.equal(toFiniteNumber(""), null);
    assert.equal(toFiniteNumber("   "), null);
    assert.equal(toFiniteNumber(null), null);
    assert.equal(toFiniteNumber(undefined), null);
    assert.equal(toFiniteNumber(Number.POSITIVE_INFINITY), null);
    assert.equal(toFiniteNumber(Number.NaN), null);
  });

  it("exige valor estritamente positivo em toPositiveNumber", () => {
    assert.equal(toPositiveNumber("0"), null);
    assert.equal(toPositiveNumber("-1"), null);
    assert.equal(toPositiveNumber("0.0001"), 0.0001);
  });

  it("converte timestamp unix em ISO 8601", () => {
    assert.equal(unixSecondsToIso("1717243200"), "2024-06-01T12:00:00.000Z");
    assert.equal(unixSecondsToIso(1717243200), "2024-06-01T12:00:00.000Z");
  });

  it("devolve null para timestamp ausente ou invalido", () => {
    assert.equal(unixSecondsToIso(undefined), null);
    assert.equal(unixSecondsToIso("0"), null);
    assert.equal(unixSecondsToIso("nao-e-numero"), null);
  });

  it("marca como desatualizado apenas alem do limite", () => {
    const recente = new Date(NOW - 60_000).toISOString();
    const antigo = new Date(NOW - 3_600_000).toISOString();
    assert.equal(isStale(recente, NOW, 900), false);
    assert.equal(isStale(antigo, NOW, 900), true);
    assert.equal(isStale("data-invalida", NOW, 900), true);
  });
});

describe("normalizacao da AwesomeAPI", () => {
  const payload = {
    USDBRL: {
      code: "USD",
      codein: "BRL",
      name: "Dolar Americano/Real Brasileiro",
      high: "5.2225",
      low: "5.2220",
      varBid: "-0.0012",
      pctChange: "-0.02",
      bid: "5.2221",
      ask: "5.2231",
      timestamp: RECENT_TS,
      create_date: "2024-06-01 08:55:00",
    },
  };

  it("converte campos numericos recebidos como texto", () => {
    const [quote] = normalizeAwesomeApiResponse(payload, { now: NOW });
    assert.ok(quote);
    assert.equal(typeof quote.price, "number");
    assert.equal(quote.price, 5.2221);
    assert.equal(quote.high, 5.2225);
    assert.equal(quote.low, 5.222);
    assert.equal(quote.changePercentage, -0.02);
  });

  it("preenche os metadados do catalogo e a moeda de referencia", () => {
    const [quote] = normalizeAwesomeApiResponse(payload, { now: NOW });
    assert.ok(quote);
    assert.equal(quote.id, "usd-brl");
    assert.equal(quote.symbol, "USD");
    assert.equal(quote.category, "currency");
    assert.equal(quote.source, "AwesomeAPI");
    assert.equal(quote.referenceCurrency, "BRL");
  });

  it("usa o timestamp da fonte como horario de atualizacao", () => {
    const [quote] = normalizeAwesomeApiResponse(payload, { now: NOW });
    assert.ok(quote);
    assert.equal(quote.updatedAt, new Date(Number(RECENT_TS) * 1000).toISOString());
    assert.equal(quote.stale, false);
  });

  it("marca como desatualizada uma cotacao antiga", () => {
    const antigo = {
      USDBRL: { ...payload.USDBRL, timestamp: String(Math.floor(NOW / 1000) - 7200) },
    };
    const [quote] = normalizeAwesomeApiResponse(antigo, { now: NOW, staleThresholdSeconds: 900 });
    assert.ok(quote);
    assert.equal(quote.stale, true);
  });

  it("tolera campos ausentes preenchendo com null", () => {
    const parcial = {
      EURBRL: { bid: "6.1000", timestamp: RECENT_TS },
    };
    const [quote] = normalizeAwesomeApiResponse(parcial, { now: NOW });
    assert.ok(quote);
    assert.equal(quote.price, 6.1);
    assert.equal(quote.high, null);
    assert.equal(quote.low, null);
    assert.equal(quote.changePercentage, null);
  });

  it("cai para o horario atual quando o timestamp esta ausente", () => {
    const semTimestamp = { GBPBRL: { bid: "7.5" } };
    const [quote] = normalizeAwesomeApiResponse(semTimestamp, { now: NOW });
    assert.ok(quote);
    assert.equal(quote.updatedAt, new Date(NOW).toISOString());
  });

  it("descarta entradas sem preco utilizavel", () => {
    const invalido = {
      USDBRL: { ...payload.USDBRL, bid: "nao-e-numero" },
      EURBRL: { ...payload.USDBRL, bid: "0" },
    };
    assert.deepEqual(normalizeAwesomeApiResponse(invalido, { now: NOW }), []);
  });

  it("ignora pares fora do catalogo de ativos permitidos", () => {
    const foraDoCatalogo = { JPYBRL: { bid: "0.033", timestamp: RECENT_TS } };
    assert.deepEqual(normalizeAwesomeApiResponse(foraDoCatalogo, { now: NOW }), []);
  });

  it("lanca AppError para resposta que nao e objeto", () => {
    assert.throws(() => normalizeAwesomeApiResponse("resposta invalida"), AppError);
    assert.throws(() => normalizeAwesomeApiResponse(null), AppError);
    assert.throws(() => normalizeAwesomeApiResponse([1, 2, 3]), AppError);
  });
});

describe("normalizacao da CoinGecko", () => {
  const payload = {
    bitcoin: {
      brl: 329103,
      brl_24h_change: -0.1214,
      last_updated_at: Math.floor(NOW / 1000) - 120,
    },
    ethereum: {
      brl: 9828.03,
      brl_24h_change: 0.138,
      last_updated_at: Math.floor(NOW / 1000) - 120,
    },
  };

  it("normaliza preco, variacao e horario", () => {
    const quotes = normalizeCoinGeckoResponse(payload, { now: NOW });
    assert.equal(quotes.length, 2);

    const bitcoin = quotes.find((quote) => quote.id === "bitcoin");
    assert.ok(bitcoin);
    assert.equal(bitcoin.price, 329103);
    assert.equal(bitcoin.symbol, "BTC");
    assert.equal(bitcoin.category, "crypto");
    assert.equal(bitcoin.source, "CoinGecko");
    assert.equal(bitcoin.changePercentage, -0.1214);
    assert.equal(bitcoin.stale, false);
  });

  it("mantem maxima e minima nulas, pois o endpoint nao as fornece", () => {
    const [quote] = normalizeCoinGeckoResponse(payload, { now: NOW });
    assert.ok(quote);
    assert.equal(quote.high, null);
    assert.equal(quote.low, null);
  });

  it("trata variacao ausente como null, nunca como zero", () => {
    const semVariacao = {
      solana: { brl: 394.15, last_updated_at: Math.floor(NOW / 1000) },
    };
    const [quote] = normalizeCoinGeckoResponse(semVariacao, { now: NOW });
    assert.ok(quote);
    assert.equal(quote.changePercentage, null);
  });

  it("aceita preco recebido como texto", () => {
    const comTexto = { solana: { brl: "394.15", brl_24h_change: "1.5" } };
    const [quote] = normalizeCoinGeckoResponse(comTexto, { now: NOW });
    assert.ok(quote);
    assert.equal(quote.price, 394.15);
    assert.equal(quote.changePercentage, 1.5);
  });

  it("descarta entradas sem preco e ids desconhecidos", () => {
    const invalido = {
      bitcoin: { brl: null },
      dogecoin: { brl: 1.23 },
    };
    assert.deepEqual(normalizeCoinGeckoResponse(invalido, { now: NOW }), []);
  });

  it("lanca AppError para resposta invalida", () => {
    assert.throws(() => normalizeCoinGeckoResponse("erro"), AppError);
    assert.throws(() => normalizeCoinGeckoResponse(undefined), AppError);
  });
});
