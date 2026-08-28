/**
 * Formatadores de exibicao (pt-BR).
 *
 * Ficam isolados aqui para que numero, moeda e data tenham a mesma aparencia em
 * toda a interface, com algarismos tabulares e sem `NaN` visivel.
 */

import type { AssetCategory } from "@/types";

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/**
 * Moedas tradicionais usam 4 casas (5,2225) e criptoativos usam 2 (329.103,00):
 * e como cada mercado divulga o preco.
 */
export function formatBRL(value: number, category?: AssetCategory): string {
  const digits = category === "currency" ? 4 : 2;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Formata quantidade de um ativo com precisao suficiente para fracoes. */
export function formatAssetAmount(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${percentFormatter.format(value)}%`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Horario indisponivel";
  return dateTimeFormatter.format(date);
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--:--:--";
  return timeFormatter.format(date);
}

/** Direcao da variacao. `neutral` cobre zero e ausencia de dado. */
export type Direction = "up" | "down" | "neutral";

export function directionOf(change: number | null): Direction {
  if (change === null || change === 0) return "neutral";
  return change > 0 ? "up" : "down";
}

/**
 * Glifo e texto do indicador de variacao.
 * O texto existe para que a informacao nao dependa apenas da cor.
 */
export const DIRECTION_PRESENTATION: Record<
  Direction,
  { glyph: string; label: string; className: string }
> = {
  up: { glyph: "▲", label: "alta", className: "chip--positive" },
  down: { glyph: "▼", label: "baixa", className: "chip--negative" },
  neutral: { glyph: "–", label: "estavel", className: "chip--neutral" },
};
