/**
 * Utilitarios de coercao usados pelos dois normalizadores.
 *
 * As duas APIs entregam numeros de formas diferentes: a AwesomeAPI manda tudo
 * como string ("5.4321") e a CoinGecko manda `number`. Aqui tudo vira `number`
 * finito ou `null`, sem `NaN` vazando para a interface.
 */

import { getStaleThresholdSeconds } from "../config.ts";

/** Converte texto ou numero em `number` finito; devolve `null` caso contrario. */
export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Igual a `toFiniteNumber`, mas exige valor estritamente positivo. */
export function toPositiveNumber(value: unknown): number | null {
  const parsed = toFiniteNumber(value);
  if (parsed === null || parsed <= 0) return null;
  return parsed;
}

/**
 * Converte um timestamp em segundos (numero ou string) para ISO 8601 UTC.
 * Retorna `null` quando o valor e ausente ou implausivel.
 */
export function unixSecondsToIso(value: unknown): string | null {
  const seconds = toFiniteNumber(value);
  if (seconds === null || seconds <= 0) return null;
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/** Verifica se um valor desconhecido e um objeto simples navegavel por chave. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Decide se uma cotacao esta desatualizada comparando `updatedAt` ao limite
 * configurado. Cotacoes de moedas ficam naturalmente "stale" em fins de semana
 * e feriados — o indicador existe justamente para tornar isso visivel.
 */
export function isStale(
  updatedAtIso: string,
  now: number = Date.now(),
  thresholdSeconds: number = getStaleThresholdSeconds(),
): boolean {
  const updatedAtMs = Date.parse(updatedAtIso);
  if (Number.isNaN(updatedAtMs)) return true;
  return now - updatedAtMs > thresholdSeconds * 1000;
}
