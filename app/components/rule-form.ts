/**
 * Validacao de formulario compartilhada entre o cadastro e a edicao de regras.
 *
 * Espelha as faixas aceitas por `lib/validation.ts` para dar retorno imediato ao
 * usuario. A decisao final continua sendo do backend — este modulo e
 * conveniencia de interface, nunca a unica barreira.
 */

import { CONDITION_UNITS } from "@/lib/labels";
import type { AlertCondition } from "@/types";

/** Mesmo teto aplicado pelo backend em `MAX_REFERENCE_VALUE`. */
const MAX_PRICE_VALUE = 1_000_000_000;

export type ReferenceValueResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

/** Aceita "5,50" e "5.50" — o usuario brasileiro digita das duas formas. */
export function parseReferenceValueInput(
  raw: string,
  condition: AlertCondition,
): ReferenceValueResult {
  const normalized = raw.trim().replace(",", ".");

  if (normalized === "") {
    return { ok: false, error: "Informe um valor de referencia." };
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return { ok: false, error: "Informe um valor de referencia numerico." };
  }

  if (CONDITION_UNITS[condition] === "percent") {
    if (parsed < -100 || parsed > 1000) {
      return { ok: false, error: "A variacao de referencia deve estar entre -100% e 1000%." };
    }
    return { ok: true, value: parsed };
  }

  if (parsed <= 0) {
    return { ok: false, error: "Para condicoes de preco, o valor deve ser maior que zero." };
  }
  if (parsed > MAX_PRICE_VALUE) {
    return { ok: false, error: "O valor de referencia informado e alto demais." };
  }

  return { ok: true, value: parsed };
}

/** Texto de apoio exibido abaixo do campo, conforme a unidade da condicao. */
export function referenceValueHelp(condition: AlertCondition): string {
  return CONDITION_UNITS[condition] === "percent"
    ? "Percentual de variacao em 24h. Aceita valor negativo."
    : "Preco em reais. Deve ser maior que zero.";
}

/** Converte o valor numerico da regra para exibicao no campo de texto. */
export function formatReferenceValueForInput(value: number): string {
  return String(value).replace(".", ",");
}
