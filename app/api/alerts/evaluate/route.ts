/**
 * POST /api/alerts/evaluate
 *
 * Automacao central do projeto:
 *   1. obtem as cotacoes normalizadas (com cache);
 *   2. recupera as regras ativas;
 *   3. compara cada regra com a cotacao correspondente;
 *   4. monta o plano de alertas (funcao pura, em `lib/alert-rules.ts`);
 *   5. descarta duplicados dentro da janela configurada;
 *   6. persiste os alertas no repositorio ativo;
 *   7. devolve um resumo da avaliacao.
 */

import { handleRoute, jsonOk, AppError } from "@/lib/api-response";
import { buildEvaluationPlan } from "@/lib/alert-rules";
import { getAlertDedupMinutes } from "@/lib/config";
import { toAppError } from "@/lib/errors";
import { getCombinedQuotes, isTotalFailure } from "@/lib/quotes";
import { getRepository } from "@/lib/repositories";
import type { EvaluationSummary } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Quantidade de alertas recentes carregados para a checagem anti-duplicidade.
 * Suficiente para cobrir a janela de deduplicacao sem paginar o Airtable.
 */
const RECENT_ALERTS_WINDOW_SIZE = 100;

export async function POST(request: Request): Promise<Response> {
  return handleRoute(async () => {
    const repository = getRepository();

    const [quotesResponse, rules, recentAlerts] = await Promise.all([
      getCombinedQuotes({ signal: request.signal }),
      repository.listRules(),
      repository.listAlerts(RECENT_ALERTS_WINDOW_SIZE),
    ]);

    if (isTotalFailure(quotesResponse)) {
      throw new AppError("UPSTREAM_UNAVAILABLE", {
        message:
          "Nao foi possivel avaliar as regras: nenhuma fonte de cotacao respondeu.",
      });
    }

    const now = Date.now();
    const plan = buildEvaluationPlan({
      rules,
      quotes: quotesResponse.data,
      recentAlerts,
      now,
      dedupMinutes: getAlertDedupMinutes(),
    });

    let createdAlerts: EvaluationSummary["alerts"] = [];
    const warnings = [...quotesResponse.warnings];

    if (plan.pendingAlerts.length > 0) {
      try {
        createdAlerts = await repository.createAlerts(plan.pendingAlerts);
      } catch (error) {
        // Falha de gravacao nao pode ser silenciosa nem parecer sucesso.
        const appError = toAppError(error);
        throw new AppError("PERSISTENCE_FAILURE", {
          source: repository.mode === "airtable" ? "Airtable" : "Memoria",
          message: `${appError.message} Os alertas identificados nao foram salvos.`,
          cause: error,
        });
      }
    }

    const summary: EvaluationSummary = {
      evaluatedRules: plan.evaluatedRules,
      matchedRules: plan.matchedRules,
      createdAlerts: createdAlerts.length,
      skippedDuplicates: plan.skippedDuplicates,
      skippedMissingQuote: plan.skippedMissingQuote,
      skippedMissingChange: plan.skippedMissingChange,
      persistence: repository.mode,
      evaluatedAt: new Date(now).toISOString(),
      alerts: createdAlerts,
      warnings,
    };

    return jsonOk({ data: summary });
  });
}
