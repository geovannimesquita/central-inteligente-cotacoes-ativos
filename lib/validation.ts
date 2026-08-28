/**
 * Validacao de entrada do backend.
 *
 * Toda requisicao de escrita passa por aqui antes de tocar em qualquer
 * repositorio. A validacao do formulario no cliente e apenas conveniencia — a
 * decisao vale a que acontece neste modulo.
 */

import { isKnownAssetId } from "./assets.ts";
import { isAlertCondition, isChangeCondition } from "./alert-rules.ts";
import { AppError } from "./errors.ts";
import type { AlertCondition, AlertRule } from "../types/index.ts";
import { isRecord } from "./normalize/shared.ts";

/** Limite superior de campo textual aceito em qualquer payload. */
export const MAX_TEXT_LENGTH = 120;

/** Limite superior absoluto de um valor de referencia. */
export const MAX_REFERENCE_VALUE = 1_000_000_000;

export interface CreateRuleInput {
  assetId: string;
  condition: AlertCondition;
  referenceValue: number;
}

export interface UpdateRuleInput {
  assetId?: string;
  condition?: AlertCondition;
  active?: boolean;
  referenceValue?: number;
}

function assertShortString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new AppError("INVALID_PARAM", { message: `O campo "${field}" deve ser um texto.` });
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new AppError("INVALID_PARAM", { message: `O campo "${field}" e obrigatorio.` });
  }
  if (trimmed.length > MAX_TEXT_LENGTH) {
    throw new AppError("INVALID_PARAM", {
      message: `O campo "${field}" excede ${MAX_TEXT_LENGTH} caracteres.`,
    });
  }
  return trimmed;
}

/**
 * Converte e valida um valor numerico de referencia.
 *
 * Condicoes de preco exigem valor estritamente positivo. Condicoes de variacao
 * aceitam negativo (uma queda de -3% e um alvo legitimo), mas nao aceitam
 * valores fora de uma faixa percentual plausivel.
 */
export function parseReferenceValue(value: unknown, condition: AlertCondition): number {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim());

  if (!Number.isFinite(parsed)) {
    throw new AppError("INVALID_PARAM", {
      message: 'O campo "valor de referencia" deve ser um numero finito.',
    });
  }

  if (isChangeCondition(condition)) {
    if (parsed < -100 || parsed > 1000) {
      throw new AppError("INVALID_PARAM", {
        message: "A variacao de referencia deve estar entre -100% e 1000%.",
      });
    }
    return parsed;
  }

  if (parsed <= 0) {
    throw new AppError("INVALID_PARAM", {
      message: "O valor de referencia de preco deve ser maior que zero.",
    });
  }
  if (parsed > MAX_REFERENCE_VALUE) {
    throw new AppError("INVALID_PARAM", {
      message: "O valor de referencia informado e alto demais.",
    });
  }

  return parsed;
}

/** Valida o corpo de `POST /api/rules`. */
export function parseCreateRuleInput(payload: unknown): CreateRuleInput {
  if (!isRecord(payload)) {
    throw new AppError("INVALID_PARAM", {
      message: "O corpo da requisicao deve ser um objeto JSON.",
    });
  }

  const assetId = assertShortString(payload.assetId, "ativo");
  if (!isKnownAssetId(assetId)) {
    throw new AppError("ASSET_NOT_FOUND");
  }

  const condition = payload.condition;
  if (!isAlertCondition(condition)) {
    throw new AppError("INVALID_PARAM", {
      message: "A condicao informada nao e suportada.",
    });
  }

  const referenceValue = parseReferenceValue(payload.referenceValue, condition);

  return { assetId, condition, referenceValue };
}

/**
 * Valida o corpo de `PATCH /api/rules/[id]`.
 *
 * Aceita atualizacao parcial de ativo, condicao, valor de referencia e estado.
 *
 * Recebe a regra atual porque o valor precisa ser conferido contra a condicao
 * *efetiva* depois da atualizacao: trocar "preco acima de" por "variacao acima
 * de" muda a faixa aceita, e validar contra a condicao antiga deixaria passar
 * (ou barraria) o valor errado.
 */
export function parseUpdateRuleInput(payload: unknown, existing: AlertRule): UpdateRuleInput {
  if (!isRecord(payload)) {
    throw new AppError("INVALID_PARAM", {
      message: "O corpo da requisicao deve ser um objeto JSON.",
    });
  }

  const result: UpdateRuleInput = {};

  if (payload.assetId !== undefined) {
    const assetId = assertShortString(payload.assetId, "ativo");
    if (!isKnownAssetId(assetId)) {
      throw new AppError("ASSET_NOT_FOUND");
    }
    result.assetId = assetId;
  }

  if (payload.condition !== undefined) {
    if (!isAlertCondition(payload.condition)) {
      throw new AppError("INVALID_PARAM", {
        message: "A condicao informada nao e suportada.",
      });
    }
    result.condition = payload.condition;
  }

  if (payload.active !== undefined) {
    if (typeof payload.active !== "boolean") {
      throw new AppError("INVALID_PARAM", {
        message: 'O campo "ativa" deve ser verdadeiro ou falso.',
      });
    }
    result.active = payload.active;
  }

  const effectiveCondition = result.condition ?? existing.condition;

  if (payload.referenceValue !== undefined) {
    result.referenceValue = parseReferenceValue(payload.referenceValue, effectiveCondition);
  } else if (result.condition !== undefined) {
    // Condicao trocada sem novo valor: o valor atual precisa continuar valido na
    // faixa da condicao nova, caso contrario a regra ficaria internamente
    // incoerente (por exemplo, um preco de 350000 virando "variacao de 350000%").
    try {
      parseReferenceValue(existing.referenceValue, effectiveCondition);
    } catch {
      throw new AppError("INVALID_PARAM", {
        message:
          "O valor de referencia atual nao e compativel com a nova condicao. Informe tambem um novo valor.",
      });
    }
  }

  if (Object.keys(result).length === 0) {
    throw new AppError("INVALID_PARAM", {
      message: "Informe ao menos um campo para atualizar.",
    });
  }

  return result;
}

/** Valida um identificador vindo da URL antes de qualquer consulta. */
export function parseRecordId(value: string | undefined): string {
  const id = assertShortString(value, "identificador");
  // Aceita apenas caracteres seguros: ids do Airtable e uuids gerados localmente.
  if (!/^[A-Za-z0-9_-]{1,60}$/.test(id)) {
    throw new AppError("INVALID_PARAM", { message: "O identificador informado e invalido." });
  }
  return id;
}

/** Le e valida o JSON do corpo da requisicao com limite de tamanho. */
export async function readJsonBody(request: Request): Promise<unknown> {
  const raw = await request.text();
  if (raw.length === 0) return {};
  if (raw.length > 4096) {
    throw new AppError("INVALID_PARAM", { message: "O corpo da requisicao e grande demais." });
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new AppError("INVALID_PARAM", { message: "O corpo da requisicao nao e um JSON valido." });
  }
}

/** Le um parametro booleano de query string (`?refresh=1`). */
export function parseBooleanParam(value: string | null): boolean {
  if (value === null) return false;
  return value === "1" || value.toLowerCase() === "true";
}
