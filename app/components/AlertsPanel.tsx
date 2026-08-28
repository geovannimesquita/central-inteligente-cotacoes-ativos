"use client";

/**
 * Lista dos alertas gerados pela automacao e o gatilho de avaliacao manual.
 *
 * Os textos sao descritivos: informam o que aconteceu com a cotacao, sem
 * qualquer sugestao de compra, venda ou expectativa de resultado.
 */

import { ASSET_CATALOG } from "@/lib/assets";
import { CONDITION_UNITS } from "@/lib/labels";
import { formatBRL, formatDateTime, formatPercent } from "./format";
import type { AlertRule, EvaluationSummary, GeneratedAlert } from "@/types";

interface AlertsPanelProps {
  alerts: GeneratedAlert[];
  /** Usadas para descobrir a unidade (R$ ou %) do valor de cada alerta. */
  rules: AlertRule[];
  loading: boolean;
  error: string | null;
  evaluating: boolean;
  lastSummary: EvaluationSummary | null;
  onEvaluate: () => void;
}

function assetNameOf(assetId: string): string {
  const asset = ASSET_CATALOG.find((item) => item.id === assetId);
  return asset ? `${asset.name} (${asset.symbol})` : assetId;
}

/**
 * A unidade do valor vem da condicao da regra de origem. Se a regra ja foi
 * excluida, recorremos ao texto da mensagem, que e gerado pela aplicacao e
 * sempre menciona "variacao de" nas condicoes percentuais.
 */
function isPercentAlert(alert: GeneratedAlert, rules: AlertRule[]): boolean {
  const rule = rules.find((item) => item.id === alert.ruleId);
  if (rule) return CONDITION_UNITS[rule.condition] === "percent";
  return alert.message.includes("variacao de");
}

export default function AlertsPanel({
  alerts,
  rules,
  loading,
  error,
  evaluating,
  lastSummary,
  onEvaluate,
}: AlertsPanelProps) {
  return (
    <div className="stack">
      <div className="card row" style={{ justifyContent: "space-between" }}>
        <div>
          <p style={{ fontWeight: 620 }}>Avaliacao das regras</p>
          <p className="field__help">
            Compara cada regra ativa com a cotacao correspondente e registra os alertas
            correspondentes, sem repetir alertas recentes da mesma regra.
          </p>
        </div>
        <button type="button" className="btn" onClick={onEvaluate} disabled={evaluating}>
          {evaluating ? <span className="spinner" aria-hidden="true" /> : null}
          {evaluating ? "Avaliando" : "Executar avaliacao"}
        </button>
      </div>

      {lastSummary ? (
        <div className="card">
          <p className="field__label" style={{ marginBottom: 10 }}>
            Resumo da ultima avaliacao — {formatDateTime(lastSummary.evaluatedAt)}
          </p>
          <div className="row">
            <span className="chip">Regras avaliadas: {lastSummary.evaluatedRules}</span>
            <span className="chip">Condicoes atendidas: {lastSummary.matchedRules}</span>
            <span className="chip chip--positive">
              <span className="chip__glyph" aria-hidden="true">
                +
              </span>
              Alertas criados: {lastSummary.createdAlerts}
            </span>
            <span className="chip chip--neutral">
              Duplicados ignorados: {lastSummary.skippedDuplicates}
            </span>
            {lastSummary.skippedMissingChange > 0 ? (
              <span className="chip chip--warning">
                <span className="chip__glyph" aria-hidden="true">
                  !
                </span>
                Sem dado de variacao: {lastSummary.skippedMissingChange}
              </span>
            ) : null}
            {lastSummary.skippedMissingQuote > 0 ? (
              <span className="chip chip--warning">
                <span className="chip__glyph" aria-hidden="true">
                  !
                </span>
                Sem cotacao: {lastSummary.skippedMissingQuote}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="state state--error" role="alert">
          <p className="state__title">Nao foi possivel carregar os alertas</p>
          <p className="state__text">{error}</p>
        </div>
      ) : null}

      {loading && alerts.length === 0 ? (
        <div className="skeleton" style={{ height: 120 }} aria-hidden="true" />
      ) : null}

      {!loading && !error && alerts.length === 0 ? (
        <div className="state">
          <p className="state__title">Nenhum alerta registrado</p>
          <p className="state__text">
            Cadastre regras e execute a avaliacao. Os alertas aparecem aqui quando alguma
            condicao for atendida pelas cotacoes.
          </p>
        </div>
      ) : null}

      {alerts.length > 0 ? (
        <ul className="alerts">
          {alerts.map((alert) => {
            const asPercent = isPercentAlert(alert, rules);
            const render = (value: number) =>
              asPercent ? formatPercent(value) : formatBRL(value);

            return (
            <li key={alert.id} className="alert-item">
              <p className="alert-item__message">{alert.message}</p>
              <dl className="alert-item__facts">
                <div>
                  <dt>Ativo</dt>
                  <dd>{assetNameOf(alert.assetId)}</dd>
                </div>
                <div>
                  <dt>Observado</dt>
                  <dd>{render(alert.observedValue)}</dd>
                </div>
                <div>
                  <dt>Configurado</dt>
                  <dd>{render(alert.referenceValue)}</dd>
                </div>
                <div>
                  <dt>Fonte</dt>
                  <dd>{alert.source}</dd>
                </div>
                <div>
                  <dt>Data</dt>
                  <dd>{formatDateTime(alert.createdAt)}</dd>
                </div>
              </dl>
              <div className="row">
                <span className={`chip ${alert.viewed ? "chip--neutral" : "chip--info"}`}>
                  <span className="chip__glyph" aria-hidden="true">
                    {alert.viewed ? "✓" : "•"}
                  </span>
                  {alert.viewed ? "Visualizado" : "Nao visualizado"}
                </span>
              </div>
            </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
