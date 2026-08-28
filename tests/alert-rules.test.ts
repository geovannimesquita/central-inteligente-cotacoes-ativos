/**
 * Testes do motor de regras e da prevencao de duplicidade.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildEvaluationPlan,
  evaluateRule,
  hasRecentAlert,
  isAlertCondition,
  isChangeCondition,
} from "../lib/alert-rules.ts";
import {
  parseCreateRuleInput,
  parseReferenceValue,
  parseUpdateRuleInput,
} from "../lib/validation.ts";
import { AppError } from "../lib/errors.ts";
import type { AlertCondition, AlertRule, GeneratedAlert, NormalizedQuote } from "../types/index.ts";

const NOW = Date.UTC(2024, 5, 1, 12, 0, 0);

function makeQuote(overrides: Partial<NormalizedQuote> = {}): NormalizedQuote {
  return {
    id: "usd-brl",
    name: "Dolar Americano",
    symbol: "USD",
    category: "currency",
    price: 5.2,
    referenceCurrency: "BRL",
    changePercentage: 1.5,
    high: 5.25,
    low: 5.18,
    source: "AwesomeAPI",
    updatedAt: new Date(NOW).toISOString(),
    stale: false,
    ...overrides,
  };
}

function makeRule(overrides: Partial<AlertRule> = {}): AlertRule {
  return {
    id: "rule-1",
    assetId: "usd-brl",
    condition: "greater_than",
    referenceValue: 5,
    active: true,
    createdAt: new Date(NOW - 86_400_000).toISOString(),
    ...overrides,
  };
}

function quoteMap(quotes: NormalizedQuote[]): Map<string, NormalizedQuote> {
  return new Map(quotes.map((quote) => [quote.id, quote]));
}

describe("condicoes suportadas", () => {
  it("reconhece as quatro condicoes e recusa as demais", () => {
    for (const condition of [
      "greater_than",
      "less_than",
      "change_greater_than",
      "change_less_than",
    ]) {
      assert.equal(isAlertCondition(condition), true);
    }
    assert.equal(isAlertCondition("equals"), false);
    assert.equal(isAlertCondition(42), false);
    assert.equal(isAlertCondition(undefined), false);
  });

  it("classifica corretamente as condicoes de variacao", () => {
    assert.equal(isChangeCondition("change_greater_than"), true);
    assert.equal(isChangeCondition("change_less_than"), true);
    assert.equal(isChangeCondition("greater_than"), false);
  });
});

describe("evaluateRule", () => {
  it("greater_than dispara quando o preco supera a referencia", () => {
    const quotes = quoteMap([makeQuote({ price: 5.5 })]);
    const result = evaluateRule(makeRule({ condition: "greater_than", referenceValue: 5 }), quotes);
    assert.equal(result.matched, true);
    assert.equal(result.observedValue, 5.5);
  });

  it("greater_than nao dispara quando o preco e igual a referencia", () => {
    const quotes = quoteMap([makeQuote({ price: 5 })]);
    const result = evaluateRule(makeRule({ condition: "greater_than", referenceValue: 5 }), quotes);
    assert.equal(result.matched, false);
    assert.equal(result.skipReason, "condition_not_met");
  });

  it("less_than dispara quando o preco fica abaixo da referencia", () => {
    const quotes = quoteMap([makeQuote({ price: 4.8 })]);
    const result = evaluateRule(makeRule({ condition: "less_than", referenceValue: 5 }), quotes);
    assert.equal(result.matched, true);
    assert.equal(result.observedValue, 4.8);
  });

  it("change_greater_than compara a variacao percentual, nao o preco", () => {
    const quotes = quoteMap([makeQuote({ price: 5.2, changePercentage: 4.2 })]);
    const result = evaluateRule(
      makeRule({ condition: "change_greater_than", referenceValue: 3 }),
      quotes,
    );
    assert.equal(result.matched, true);
    assert.equal(result.observedValue, 4.2);
  });

  it("change_less_than dispara com variacao negativa", () => {
    const quotes = quoteMap([makeQuote({ changePercentage: -5.1 })]);
    const result = evaluateRule(
      makeRule({ condition: "change_less_than", referenceValue: -3 }),
      quotes,
    );
    assert.equal(result.matched, true);
    assert.equal(result.observedValue, -5.1);
  });

  it("ignora regra inativa", () => {
    const quotes = quoteMap([makeQuote({ price: 99 })]);
    const result = evaluateRule(makeRule({ active: false }), quotes);
    assert.equal(result.matched, false);
    assert.equal(result.skipReason, "inactive_rule");
  });

  it("ignora regra de ativo inexistente no catalogo", () => {
    const quotes = quoteMap([makeQuote()]);
    const result = evaluateRule(makeRule({ assetId: "ativo-inexistente" }), quotes);
    assert.equal(result.matched, false);
    assert.equal(result.skipReason, "unknown_asset");
  });

  it("ignora regra sem cotacao correspondente", () => {
    const quotes = quoteMap([makeQuote({ id: "bitcoin", category: "crypto" })]);
    const result = evaluateRule(makeRule({ assetId: "eur-brl" }), quotes);
    assert.equal(result.matched, false);
    assert.equal(result.skipReason, "missing_quote");
  });

  it("nao avalia regra de variacao quando a fonte nao fornece o dado", () => {
    const quotes = quoteMap([makeQuote({ changePercentage: null })]);
    const result = evaluateRule(
      makeRule({ condition: "change_greater_than", referenceValue: -100 }),
      quotes,
    );
    assert.equal(result.matched, false);
    assert.equal(result.skipReason, "missing_change");
  });
});

describe("prevencao de duplicidade", () => {
  function makeAlert(overrides: Partial<GeneratedAlert> = {}): GeneratedAlert {
    return {
      id: "alert-1",
      ruleId: "rule-1",
      assetId: "usd-brl",
      observedValue: 5.5,
      referenceValue: 5,
      message: "mensagem",
      source: "AwesomeAPI",
      createdAt: new Date(NOW - 10 * 60 * 1000).toISOString(),
      viewed: false,
      ...overrides,
    };
  }

  it("detecta alerta recente da mesma regra dentro da janela", () => {
    assert.equal(hasRecentAlert("rule-1", [makeAlert()], NOW, 30), true);
  });

  it("permite novo alerta quando a janela ja passou", () => {
    const antigo = makeAlert({ createdAt: new Date(NOW - 45 * 60 * 1000).toISOString() });
    assert.equal(hasRecentAlert("rule-1", [antigo], NOW, 30), false);
  });

  it("nao confunde alertas de regras diferentes", () => {
    assert.equal(hasRecentAlert("rule-2", [makeAlert()], NOW, 30), false);
  });

  it("ignora alertas com data invalida", () => {
    assert.equal(hasRecentAlert("rule-1", [makeAlert({ createdAt: "invalido" })], NOW, 30), false);
  });

  it("buildEvaluationPlan nao recria alerta ja existente na janela", () => {
    const plan = buildEvaluationPlan({
      rules: [makeRule({ referenceValue: 5 })],
      quotes: [makeQuote({ price: 5.5 })],
      recentAlerts: [makeAlert()],
      now: NOW,
      dedupMinutes: 30,
    });

    assert.equal(plan.matchedRules, 1);
    assert.equal(plan.skippedDuplicates, 1);
    assert.equal(plan.pendingAlerts.length, 0);
  });

  it("buildEvaluationPlan deduplica a mesma regra repetida na entrada", () => {
    const rule = makeRule({ referenceValue: 5 });
    const plan = buildEvaluationPlan({
      rules: [rule, rule],
      quotes: [makeQuote({ price: 5.5 })],
      recentAlerts: [],
      now: NOW,
      dedupMinutes: 30,
    });

    assert.equal(plan.pendingAlerts.length, 1);
    assert.equal(plan.skippedDuplicates, 1);
  });
});

describe("buildEvaluationPlan", () => {
  it("gera alerta descritivo, sem linguagem de recomendacao", () => {
    const plan = buildEvaluationPlan({
      rules: [makeRule({ referenceValue: 5 })],
      quotes: [makeQuote({ price: 5.5 })],
      recentAlerts: [],
      now: NOW,
    });

    const [alert] = plan.pendingAlerts;
    assert.ok(alert);
    assert.equal(alert.ruleId, "rule-1");
    assert.equal(alert.assetId, "usd-brl");
    assert.equal(alert.observedValue, 5.5);
    assert.equal(alert.referenceValue, 5);
    assert.equal(alert.source, "AwesomeAPI");
    assert.equal(alert.viewed, false);
    assert.equal(alert.createdAt, new Date(NOW).toISOString());

    for (const proibido of ["compre", "venda", "lucro garantido", "melhor investimento"]) {
      assert.equal(alert.message.toLowerCase().includes(proibido), false);
    }
  });

  it("contabiliza regras sem cotacao e sem dado de variacao", () => {
    const plan = buildEvaluationPlan({
      rules: [
        makeRule({ id: "r1", assetId: "eur-brl" }),
        makeRule({ id: "r2", condition: "change_greater_than", referenceValue: -100 }),
        makeRule({ id: "r3", active: false }),
      ],
      quotes: [makeQuote({ changePercentage: null })],
      recentAlerts: [],
      now: NOW,
    });

    assert.equal(plan.evaluatedRules, 2, "regra inativa nao entra na contagem");
    assert.equal(plan.skippedMissingQuote, 1);
    assert.equal(plan.skippedMissingChange, 1);
    assert.equal(plan.pendingAlerts.length, 0);
  });

  it("avalia varias regras e ativos em uma unica passagem", () => {
    const plan = buildEvaluationPlan({
      rules: [
        makeRule({ id: "r1", assetId: "usd-brl", condition: "greater_than", referenceValue: 5 }),
        makeRule({ id: "r2", assetId: "bitcoin", condition: "less_than", referenceValue: 400_000 }),
      ],
      quotes: [
        makeQuote({ price: 5.5 }),
        makeQuote({
          id: "bitcoin",
          name: "Bitcoin",
          symbol: "BTC",
          category: "crypto",
          price: 329_103,
          source: "CoinGecko",
        }),
      ],
      recentAlerts: [],
      now: NOW,
    });

    assert.equal(plan.matchedRules, 2);
    assert.equal(plan.pendingAlerts.length, 2);
  });
});

describe("validacao de entrada", () => {
  it("aceita um payload valido", () => {
    const input = parseCreateRuleInput({
      assetId: "bitcoin",
      condition: "greater_than",
      referenceValue: "350000",
    });
    assert.deepEqual(input, {
      assetId: "bitcoin",
      condition: "greater_than",
      referenceValue: 350_000,
    });
  });

  it("recusa ativo fora da lista permitida", () => {
    assert.throws(
      () =>
        parseCreateRuleInput({
          assetId: "dogecoin",
          condition: "greater_than",
          referenceValue: 1,
        }),
      (error: unknown) => error instanceof AppError && error.code === "ASSET_NOT_FOUND",
    );
  });

  it("recusa condicao nao suportada", () => {
    assert.throws(
      () =>
        parseCreateRuleInput({ assetId: "bitcoin", condition: "equals", referenceValue: 1 }),
      AppError,
    );
  });

  it("recusa valores nao finitos e nao positivos em condicoes de preco", () => {
    for (const valor of ["nao-e-numero", Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
      assert.throws(() => parseReferenceValue(valor, "greater_than"), AppError);
    }
  });

  it("aceita variacao negativa nas condicoes percentuais", () => {
    assert.equal(parseReferenceValue(-4.5, "change_less_than"), -4.5);
    assert.throws(() => parseReferenceValue(-101, "change_less_than"), AppError);
    assert.throws(() => parseReferenceValue(1001, "change_greater_than"), AppError);
  });

  it("recusa campos obrigatorios ausentes ou longos demais", () => {
    assert.throws(
      () => parseCreateRuleInput({ condition: "greater_than", referenceValue: 1 }),
      AppError,
    );
    assert.throws(
      () =>
        parseCreateRuleInput({
          assetId: "x".repeat(200),
          condition: "greater_than" as AlertCondition,
          referenceValue: 1,
        }),
      AppError,
    );
    assert.throws(() => parseCreateRuleInput("nao e objeto"), AppError);
  });
});

describe("edicao de regra (PATCH)", () => {
  it("aceita alterar ativo, condicao e valor de uma vez", () => {
    const input = parseUpdateRuleInput(
      { assetId: "bitcoin", condition: "change_less_than", referenceValue: -5 },
      makeRule(),
    );
    assert.deepEqual(input, {
      assetId: "bitcoin",
      condition: "change_less_than",
      referenceValue: -5,
    });
  });

  it("aceita alteracao parcial de um unico campo", () => {
    assert.deepEqual(parseUpdateRuleInput({ assetId: "ethereum" }, makeRule()), {
      assetId: "ethereum",
    });
    assert.deepEqual(parseUpdateRuleInput({ active: false }, makeRule()), { active: false });
    assert.deepEqual(parseUpdateRuleInput({ referenceValue: 7 }, makeRule()), {
      referenceValue: 7,
    });
  });

  it("valida o valor contra a condicao NOVA, nao contra a antiga", () => {
    // Regra atual e de preco (exige positivo); a nova condicao e de variacao,
    // que aceita negativo. Validar contra a condicao antiga barraria o -5.
    const input = parseUpdateRuleInput(
      { condition: "change_less_than", referenceValue: -5 },
      makeRule({ condition: "greater_than", referenceValue: 5 }),
    );
    assert.equal(input.referenceValue, -5);

    // O inverso: virar condicao de preco com valor negativo deve ser recusado.
    assert.throws(
      () =>
        parseUpdateRuleInput(
          { condition: "greater_than", referenceValue: -5 },
          makeRule({ condition: "change_less_than", referenceValue: -5 }),
        ),
      AppError,
    );
  });

  it("recusa troca de condicao que deixaria o valor atual incoerente", () => {
    // 350000 e um preco valido, mas nao uma variacao percentual plausivel.
    assert.throws(
      () =>
        parseUpdateRuleInput(
          { condition: "change_greater_than" },
          makeRule({ condition: "greater_than", referenceValue: 350_000 }),
        ),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === "INVALID_PARAM" &&
        error.message.includes("nao e compativel"),
    );
  });

  it("aceita troca de condicao quando o valor atual continua valido", () => {
    const input = parseUpdateRuleInput(
      { condition: "change_greater_than" },
      makeRule({ condition: "greater_than", referenceValue: 5 }),
    );
    assert.deepEqual(input, { condition: "change_greater_than" });
  });

  it("recusa ativo fora da lista permitida", () => {
    assert.throws(
      () => parseUpdateRuleInput({ assetId: "dogecoin" }, makeRule()),
      (error: unknown) => error instanceof AppError && error.code === "ASSET_NOT_FOUND",
    );
  });

  it("recusa condicao nao suportada e 'ativa' nao booleana", () => {
    assert.throws(() => parseUpdateRuleInput({ condition: "equals" }, makeRule()), AppError);
    assert.throws(() => parseUpdateRuleInput({ active: "sim" }, makeRule()), AppError);
  });

  it("recusa corpo vazio ou que nao e objeto", () => {
    assert.throws(() => parseUpdateRuleInput({}, makeRule()), AppError);
    assert.throws(() => parseUpdateRuleInput("nao e objeto", makeRule()), AppError);
  });
});
