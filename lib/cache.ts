/**
 * Cache em memoria com TTL, no processo do servidor.
 *
 * Escolha consciente: o escopo academico do projeto nao justifica Redis ou
 * outro servico externo. O cache vive no processo Node do Next, e chaveado por
 * tipo de consulta e registra o instante de atualizacao de cada entrada.
 *
 * Em desenvolvimento o Next recria modulos a cada hot reload; por isso a
 * instancia e guardada em `globalThis`, garantindo uma unica tabela por
 * processo.
 */

import { getForcedRefreshCooldownSeconds } from "./config.ts";

export interface CacheEntry<T> {
  value: T;
  /** Instante em que a entrada foi gravada (epoch ms). */
  storedAt: number;
  /** Instante em que a entrada expira (epoch ms). */
  expiresAt: number;
}

interface CacheStore {
  entries: Map<string, CacheEntry<unknown>>;
  /** Ultimo instante em que uma atualizacao forcada foi aceita, por chave. */
  lastForcedRefreshAt: Map<string, number>;
}

const CACHE_GLOBAL_KEY = Symbol.for("cica.server-cache");

type GlobalWithCache = typeof globalThis & { [CACHE_GLOBAL_KEY]?: CacheStore };

function getStore(): CacheStore {
  const globalRef = globalThis as GlobalWithCache;
  if (!globalRef[CACHE_GLOBAL_KEY]) {
    globalRef[CACHE_GLOBAL_KEY] = {
      entries: new Map(),
      lastForcedRefreshAt: new Map(),
    };
  }
  return globalRef[CACHE_GLOBAL_KEY];
}

/** Le uma entrada valida do cache, ou `null` se ausente/expirada. */
export function readCache<T>(key: string, now: number = Date.now()): CacheEntry<T> | null {
  const entry = getStore().entries.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    getStore().entries.delete(key);
    return null;
  }
  return entry as CacheEntry<T>;
}

/** Grava uma entrada com TTL em segundos. */
export function writeCache<T>(key: string, value: T, ttlSeconds: number, now: number = Date.now()) {
  getStore().entries.set(key, {
    value,
    storedAt: now,
    expiresAt: now + ttlSeconds * 1000,
  });
}

/** Remove uma entrada especifica (usado pela atualizacao forcada). */
export function invalidateCache(key: string): void {
  getStore().entries.delete(key);
}

/** Limpa todo o cache. Usado apenas por testes. */
export function clearCache(): void {
  const store = getStore();
  store.entries.clear();
  store.lastForcedRefreshAt.clear();
}

export interface ForcedRefreshDecision {
  allowed: boolean;
  /** Segundos restantes ate a proxima atualizacao forcada permitida. */
  retryAfterSeconds: number;
}

/**
 * Limita a frequencia de atualizacoes manuais.
 *
 * O botao "Atualizar" da interface chama `/api/quotes?refresh=1`; sem esse
 * controle um clique repetido furaria o cache e poderia levar a AwesomeAPI ou a
 * CoinGecko a responder 429.
 */
export function registerForcedRefresh(
  key: string,
  now: number = Date.now(),
): ForcedRefreshDecision {
  const store = getStore();
  const cooldownMs = getForcedRefreshCooldownSeconds() * 1000;
  const lastAt = store.lastForcedRefreshAt.get(key);

  if (lastAt !== undefined && now - lastAt < cooldownMs) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((cooldownMs - (now - lastAt)) / 1000),
    };
  }

  store.lastForcedRefreshAt.set(key, now);
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Chaves de cache da aplicacao, centralizadas para evitar colisao. */
export const CACHE_KEYS = {
  currencyQuotes: "quotes:awesome-api:v1",
  cryptoQuotes: "quotes:coingecko:v1",
  healthProbe: "health:probe:v1",
} as const;
