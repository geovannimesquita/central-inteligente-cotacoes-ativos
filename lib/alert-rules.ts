/**
 * Motor de regras de alerta.
 *
 * Este modulo e deliberadamente puro: recebe regras, cotacoes e alertas
 * recentes e devolve o que deveria ser criado. Nao faz I/O, nao le ambiente e
 * nao conhece Airtable — por isso e testavel isoladamente e serve tanto ao
 * repositorio em memoria quanto ao Airtable.
 */

import { getAssetById } from "./assets.ts";
import { DEFAULT_ALERT_DEDUP_MINUTES } from "./config.ts";
import type {
  AlertCondition,
  AlertRule,
  GeneratedAlert,
  NormalizedQuote,
} from "../types/index.ts";

export const ALERT_CONDITIONS: readonly AlertCondition[] = [
  "greater_than",
  "less_than",
  "change_greater_than",
  "change_less_than",
] as const;

/** Condicoes que comparam a variacao percentual em vez do preco. */
const CHANGE_CONDITIONS = new Set<AlertCondition>(["change_greater_than", "change_less_than"]);

export function isAlertCondition(value: unknown): value is AlertCondition {
  return typeof value === "string" && ALERT_CONDITIONS.includes(value as AlertCondition);
}

export function isChangeCondition(condition: AlertCondition): boolean {
  return CHANGE_CONDITIONS.has(condition);
}

/** Motivo pelo qual uma regra nao gerou alerta — util para o resumo e os testes. */
export type SkipReason =
  | "inactive_rule"
  | "unknown_asset"
  | "missing_quote"
  | "missing_change"
  | "condition_not_met"
  | "duplicate";

export interface RuleEvaluation {
  rule: AlertRule;
  matched: boolean;
  /** Preenchido apenas quando `matched` e `true`. */
  observedValue: number | null;
  skipReason: SkipReason | null;
}

/**
 * Avalia uma unica regra contra o mapa de cotacoes.
 *
 * Regras de variacao sao ignoradas quando a fonte nao forneceu
 * `changePercentage` — nunca tratamos ausencia de dado como zero.
 */
export function evaluateRule(
  rule: AlertRule,
  quotesByAssetId: Map<string, NormalizedQuote>,
): RuleEvaluation {
  if (!rule.active) {
    return { rule, matched: false, observedValue: null, skipReason: "inactive_rule" };
  }

  if (!getAssetById(rule.assetId)) {
    return { rule, matched: false, observedValue: null, skipReason: "unknown_asset" };
  }

  const quote = quotesByAssetId.get(rule.assetId);
  if (!quote) {
    return { rule, matched: false, observedValue: null, skipReason: "missing_quote" };
  }

  if (isChangeCondition(rule.condition)) {
    if (quote.changePercentage === null) {
      return { rule, matched: false, observedValue: null, skipReason: "missing_change" };
    }
    const observed = quote.changePercentage;
    const matched =
      rule.condition === "change_greater_than"
        ? observed > rule.referenceValue
        : observed < rule.referenceValue;
    return {
      rule,
      matched,
      observedValue: matched ? observed : null,
      skipReason: matched ? null : "condition_not_met",
    };
  }

  const observed = quote.price;
  const matched =
    rule.condition === "greater_than"
      ? observed > rule.referenceValue
      : observed < rule.referenceValue;

  return {
    rule,
    matched,
    observedValue: matched ? observed : null,
    skipReason: matched ? null : "condition_not_met",
  };
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Texto informativo do alerta.
 * Linguagem estritamente descritiva: sem recomendacao de compra ou venda.
 */
export function buildAlertMessage(
  rule: AlertRule,
  quote: NormalizedQuote,
  observedValue: number,
): string {
  if (isChangeCondition(rule.condition)) {
    const direction = rule.condition === "change_greater_than" ? "acima" : "abaixo";
    return (
      `${quote.name} (${quote.symbol}) registrou variacao de ` +
      `${percentFormatter.format(observedValue)}%, ${direction} do valor de referencia de ` +
      `${percentFormatter.format(rule.referenceValue)}%.`
    );
  }

  const direction = rule.condition === "greater_than" ? "acima" : "abaixo";
  return (
    `${quote.name} (${quote.symbol}) esta cotado a ${currencyFormatter.format(observedValue)}, ` +
    `${direction} do valor de referencia de ${currencyFormatter.format(rule.referenceValue)}.`
  );
}

/**
 * Verifica se ja existe alerta recente para a mesma regra dentro da janela.
 *
 * A janela e o unico ponto de configuracao da anti-duplicidade; o valor padrao
 * vem de `DEFAULT_ALERT_DEDUP_MINUTES`.
 */
export function hasRecentAlert(
  ruleId: string,
  recentAlerts: readonly GeneratedAlert[],
  now: number,
  dedupMinutes: number = DEFAULT_ALERT_DEDUP_MINUTES,
): boolean {
  const windowMs = dedupMinutes * 60 * 1000;
  return recentAlerts.some((alert) => {
    if (alert.ruleId !== ruleId) return false;
    const createdAtMs = Date.parse(alert.createdAt);
    if (Number.isNaN(createdAtMs)) return false;
    return now - createdAtMs < windowMs;
  });
}

export interface EvaluationPlan {
  /** Alertas que devem ser persistidos, sem id definitivo ainda. */
  pendingAlerts: Array<Omit<GeneratedAlert, "id">>;
  evaluatedRules: number;
  matchedRules: number;
  skippedDuplicates: number;
  skippedMissingQuote: number;
  skippedMissingChange: number;
}

export interface BuildPlanInput {
  rules: readonly AlertRule[];
  quotes: readonly NormalizedQuote[];
  recentAlerts: readonly GeneratedAlert[];
  now?: number;
  dedupMinutes?: number;
}

/**
 * Calcula, sem efeitos colaterais, quais alertas deveriam ser criados.
 * A rota `/api/alerts/evaluate` apenas persiste o resultado deste plano.
 */
export function buildEvaluationPlan(input: BuildPlanInput): EvaluationPlan {
  const {
    rules,
    quotes,
    recentAlerts,
    now = Date.now(),
    dedupMinutes = DEFAULT_ALERT_DEDUP_MINUTES,
  } = input;

  const quotesByAssetId = new Map(quotes.map((quote) => [quote.id, quote]));
  const createdAt = new Date(now).toISOString();

  const plan: EvaluationPlan = {
    pendingAlerts: [],
    evaluatedRules: 0,
    matchedRules: 0,
    skippedDuplicates: 0,
    skippedMissingQuote: 0,
    skippedMissingChange: 0,
  };

  // Alertas ja planejados nesta rodada tambem contam para a deduplicacao,
  // evitando duplicidade quando a mesma regra aparece repetida na entrada.
  const plannedRuleIds = new Set<string>();

  for (const rule of rules) {
    if (!rule.active) continue;
    plan.evaluatedRules += 1;

    const evaluation = evaluateRule(rule, quotesByAssetId);

    if (evaluation.skipReason === "missing_quote") plan.skippedMissingQuote += 1;
    if (evaluation.skipReason === "missing_change") plan.skippedMissingChange += 1;
    if (!evaluation.matched || evaluation.observedValue === null) continue;

    plan.matchedRules += 1;

    if (
      plannedRuleIds.has(rule.id) ||
      hasRecentAlert(rule.id, recentAlerts, now, dedupMinutes)
    ) {
      plan.skippedDuplicates += 1;
      continue;
    }

    const quote = quotesByAssetId.get(rule.assetId);
    if (!quote) continue;

    plannedRuleIds.add(rule.id);
    plan.pendingAlerts.push({
      ruleId: rule.id,
      assetId: rule.assetId,
      observedValue: evaluation.observedValue,
      referenceValue: rule.referenceValue,
      message: buildAlertMessage(rule, quote, evaluation.observedValue),
      source: quote.source,
      createdAt,
      viewed: false,
    });
  }

  return plan;
}
