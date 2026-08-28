"use client";

/**
 * Orquestrador da interface.
 *
 * Mantem o estado das quatro consultas (`/api/quotes`, `/api/health`,
 * `/api/rules`, `/api/alerts`), coordena a automacao de alertas e concentra a
 * regiao `aria-live` onde as mensagens importantes sao anunciadas.
 */

import { useCallback, useEffect, useState } from "react";
import { DISCLAIMER_TEXT } from "@/lib/labels";
import type {
  AlertCondition,
  AlertRule,
  EvaluationSummary,
  GeneratedAlert,
  HealthPayload,
  IntegrationStatus,
  NormalizedQuote,
  PersistenceMode,
  QuotesResponse,
} from "@/types";
import AlertsPanel from "./AlertsPanel";
import AssetList from "./AssetList";
import Banner from "./Banner";
import Converter from "./Converter";
import Header from "./Header";
import IntegrationsPanel from "./IntegrationsPanel";
import RulesPanel, { type RuleFeedback, type RuleMutationResult } from "./RulesPanel";
import SummaryPanel from "./SummaryPanel";
import type { EditRuleValues } from "./EditRuleDialog";
import { requestJson } from "./api-client";

interface Envelope<T> {
  data: T;
  meta?: { persistence?: PersistenceMode };
}

const INITIAL_SOURCES = {
  awesomeApi: "not_configured" as IntegrationStatus,
  coinGecko: "not_configured" as IntegrationStatus,
};

export default function Dashboard() {
  const [quotes, setQuotes] = useState<NormalizedQuote[]>([]);
  const [quotesMeta, setQuotesMeta] = useState<QuotesResponse["meta"] | null>(null);
  const [quotesWarnings, setQuotesWarnings] = useState<QuotesResponse["warnings"]>([]);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [loadingQuotes, setLoadingQuotes] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);

  const [rules, setRules] = useState<AlertRule[]>([]);
  /** Falha ao carregar a lista de regras. */
  const [rulesError, setRulesError] = useState<string | null>(null);
  /** Retorno da ultima operacao de escrita sobre regras. */
  const [rulesFeedback, setRulesFeedback] = useState<RuleFeedback | null>(null);
  const [loadingRules, setLoadingRules] = useState(true);
  const [rulesBusy, setRulesBusy] = useState(false);

  const [alerts, setAlerts] = useState<GeneratedAlert[]>([]);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [lastSummary, setLastSummary] = useState<EvaluationSummary | null>(null);

  const [persistence, setPersistence] = useState<PersistenceMode>("memory");
  /** Mensagem anunciada por leitores de tela em `aria-live`. */
  const [liveMessage, setLiveMessage] = useState("");

  const announce = useCallback((message: string) => setLiveMessage(message), []);

  const loadQuotes = useCallback(
    async (forceRefresh = false) => {
      if (forceRefresh) setRefreshing(true);
      else setLoadingQuotes(true);

      try {
        const response = await requestJson<QuotesResponse>(
          forceRefresh ? "/api/quotes?refresh=1" : "/api/quotes",
        );
        setQuotes(response.data);
        setQuotesMeta(response.meta);
        setQuotesWarnings(response.warnings);
        setQuotesError(null);
        if (forceRefresh) announce(`Cotacoes atualizadas. ${response.data.length} ativos.`);
      } catch (error) {
        setQuotesError(error instanceof Error ? error.message : "Erro desconhecido.");
        if (forceRefresh) announce("Nao foi possivel atualizar as cotacoes.");
      } finally {
        setLoadingQuotes(false);
        setRefreshing(false);
      }
    },
    [announce],
  );

  const loadHealth = useCallback(async () => {
    setLoadingHealth(true);
    try {
      const response = await requestJson<HealthPayload>("/api/health");
      setHealth(response);
      setPersistence(response.persistence.mode);
      setHealthError(null);
    } catch (error) {
      setHealthError(error instanceof Error ? error.message : "Erro desconhecido.");
    } finally {
      setLoadingHealth(false);
    }
  }, []);

  const loadRules = useCallback(async () => {
    setLoadingRules(true);
    try {
      const response = await requestJson<Envelope<AlertRule[]>>("/api/rules");
      setRules(response.data);
      if (response.meta?.persistence) setPersistence(response.meta.persistence);
      setRulesError(null);
    } catch (error) {
      setRulesError(error instanceof Error ? error.message : "Erro desconhecido.");
    } finally {
      setLoadingRules(false);
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    setLoadingAlerts(true);
    try {
      const response = await requestJson<Envelope<GeneratedAlert[]>>("/api/alerts?limit=25");
      setAlerts(response.data);
      setAlertsError(null);
    } catch (error) {
      setAlertsError(error instanceof Error ? error.message : "Erro desconhecido.");
    } finally {
      setLoadingAlerts(false);
    }
  }, []);

  useEffect(() => {
    void loadQuotes();
    void loadHealth();
    void loadRules();
    void loadAlerts();
  }, [loadQuotes, loadHealth, loadRules, loadAlerts]);

  const handleCreateRule = useCallback(
    async (input: { assetId: string; condition: AlertCondition; referenceValue: number }) => {
      setRulesBusy(true);
      try {
        const response = await requestJson<Envelope<AlertRule>>("/api/rules", {
          method: "POST",
          body: JSON.stringify(input),
        });
        setRules((current) => [response.data, ...current]);
        setRulesFeedback({ tone: "info", message: "Regra cadastrada com sucesso." });
        announce("Regra cadastrada com sucesso.");
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro desconhecido.";
        setRulesFeedback({ tone: "error", message: `Falha ao cadastrar a regra. ${message}` });
        announce(`Falha ao cadastrar a regra: ${message}`);
        return false;
      } finally {
        setRulesBusy(false);
      }
    },
    [announce],
  );

  /**
   * Edicao de uma regra existente via `PATCH /api/rules/[id]`.
   *
   * Devolve a mensagem publica do backend em caso de falha para que o dialogo a
   * exiba junto ao formulario, sem fechar e sem perder o que foi digitado.
   * A listagem e atualizada em memoria com o registro devolvido pela rota — nao
   * ha recarga da pagina nem nova consulta a lista inteira.
   */
  const handleUpdateRule = useCallback(
    async (rule: AlertRule, values: EditRuleValues): Promise<RuleMutationResult> => {
      setRulesBusy(true);
      try {
        const response = await requestJson<Envelope<AlertRule>>(`/api/rules/${rule.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            assetId: values.assetId,
            condition: values.condition,
            referenceValue: values.referenceValue,
          }),
        });
        setRules((current) =>
          current.map((item) => (item.id === rule.id ? response.data : item)),
        );
        setRulesFeedback({ tone: "info", message: "Regra atualizada com sucesso." });
        announce("Regra atualizada com sucesso.");
        return { ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro desconhecido.";
        announce(`Falha ao atualizar a regra: ${message}`);
        return { ok: false, error: message };
      } finally {
        setRulesBusy(false);
      }
    },
    [announce],
  );

  const handleToggleRule = useCallback(
    async (rule: AlertRule) => {
      setRulesBusy(true);
      try {
        const response = await requestJson<Envelope<AlertRule>>(`/api/rules/${rule.id}`, {
          method: "PATCH",
          body: JSON.stringify({ active: !rule.active }),
        });
        setRules((current) =>
          current.map((item) => (item.id === rule.id ? response.data : item)),
        );
        const label = response.data.active ? "Regra ativada." : "Regra desativada.";
        setRulesFeedback({ tone: "info", message: label });
        announce(label);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro desconhecido.";
        setRulesFeedback({ tone: "error", message: `Falha ao atualizar a regra. ${message}` });
        announce(`Falha ao atualizar a regra: ${message}`);
      } finally {
        setRulesBusy(false);
      }
    },
    [announce],
  );

  const handleDeleteRule = useCallback(
    async (rule: AlertRule) => {
      setRulesBusy(true);
      try {
        await requestJson(`/api/rules/${rule.id}`, { method: "DELETE" });
        setRules((current) => current.filter((item) => item.id !== rule.id));
        setRulesFeedback({ tone: "info", message: "Regra excluida." });
        announce("Regra excluida.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro desconhecido.";
        setRulesFeedback({ tone: "error", message: `Falha ao excluir a regra. ${message}` });
        announce(`Falha ao excluir a regra: ${message}`);
      } finally {
        setRulesBusy(false);
      }
    },
    [announce],
  );

  const handleEvaluate = useCallback(async () => {
    setEvaluating(true);
    try {
      const response = await requestJson<Envelope<EvaluationSummary>>("/api/alerts/evaluate", {
        method: "POST",
      });
      setLastSummary(response.data);
      setAlertsError(null);
      await loadAlerts();
      announce(
        `Avaliacao concluida. ${response.data.evaluatedRules} regra(s) avaliada(s), ` +
          `${response.data.createdAlerts} alerta(s) criado(s), ` +
          `${response.data.skippedDuplicates} duplicado(s) ignorado(s).`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido.";
      setAlertsError(message);
      announce(`Falha ao avaliar as regras: ${message}`);
    } finally {
      setEvaluating(false);
    }
  }, [announce, loadAlerts]);

  const activeRules = rules.filter((rule) => rule.active).length;
  const sources = quotesMeta?.sources ?? INITIAL_SOURCES;
  const airtableStatus: IntegrationStatus =
    health?.integrations.find((item) => item.name === "Airtable")?.status ??
    (persistence === "airtable" ? "available" : "not_configured");
  const staleQuotes = quotes.filter((quote) => quote.stale);

  return (
    <>
      <Header
        sources={sources}
        airtableStatus={airtableStatus}
        updatedAt={quotesMeta?.updatedAt ?? null}
        refreshing={refreshing}
        onRefresh={() => void loadQuotes(true)}
      />

      {/* Regiao unica de anuncio para leitores de tela. */}
      <div aria-live="polite" role="status" className="visually-hidden">
        {liveMessage}
      </div>

      <main id="conteudo" className="shell">
        <div className="hero">
          <div>
            <span className="hero__eyebrow">Projeto academico · integracao de APIs</span>
            <h1 className="hero__title">
              Cotacoes de moedas e criptoativos em <em>um unico painel</em>
            </h1>
            <p className="hero__lead">
              Dados publicos da AwesomeAPI e da CoinGecko sao normalizados em um modelo comum,
              combinados e comparados com regras que voce mesmo define. Toda informacao vem
              acompanhada da fonte e do horario de atualizacao.
            </p>
          </div>

          <div className="banner-stack">
            {persistence === "memory" ? (
              <Banner tone="warning" title="Airtable nao configurado">
                Regras e alertas estao em um repositorio temporario em memoria, apenas para
                demonstracao. Os dados <strong>nao foram persistidos</strong> e serao perdidos ao
                reiniciar o servidor. Configure <code>AIRTABLE_TOKEN</code> e{" "}
                <code>AIRTABLE_BASE_ID</code> para gravar de verdade.
              </Banner>
            ) : (
              <Banner tone="info" title="Airtable configurado">
                Regras e alertas sao gravados nas tabelas do Airtable definidas no ambiente.
              </Banner>
            )}
          </div>
        </div>

        <section className="section" id="painel" aria-labelledby="painel-titulo">
          <div className="section__head">
            <div>
              <span className="section__index">01 — Visao geral</span>
              <h2 className="section__title" id="painel-titulo">
                Painel de ativos
              </h2>
            </div>
            <p className="section__hint">
              Precos em reais, com variacao, maxima e minima quando a fonte disponibiliza.
            </p>
          </div>

          <div className="stack">
            <SummaryPanel
              quotes={quotes}
              activeRules={activeRules}
              recentAlerts={alerts.length}
              updatedAt={quotesMeta?.updatedAt ?? null}
              loading={loadingQuotes}
            />

            {quotesWarnings.length > 0 ? (
              <div className="banner-stack">
                {quotesWarnings.map((warning, index) => (
                  <Banner key={`${warning.code}-${index}`} tone="warning" title="Resposta parcial">
                    {warning.message}
                  </Banner>
                ))}
              </div>
            ) : null}

            {staleQuotes.length > 0 ? (
              <Banner tone="warning" title="Dados desatualizados">
                {staleQuotes.length} cotacao(oes) estao alem do prazo de frescor configurado. Isso e
                esperado para moedas fora do horario de negociacao.
              </Banner>
            ) : null}

            <AssetList
              quotes={quotes}
              loading={loadingQuotes}
              error={quotesError}
              onRetry={() => void loadQuotes(true)}
            />
          </div>
        </section>

        <section className="section" id="conversor" aria-labelledby="conversor-titulo">
          <div className="section__head">
            <div>
              <span className="section__index">02 — Calculo</span>
              <h2 className="section__title" id="conversor-titulo">
                Conversor
              </h2>
            </div>
            <p className="section__hint">
              Converte uma quantidade de qualquer ativo para reais, e o inverso.
            </p>
          </div>
          <Converter quotes={quotes} />
        </section>

        <section className="section" id="regras" aria-labelledby="regras-titulo">
          <div className="section__head">
            <div>
              <span className="section__index">03 — Automacao</span>
              <h2 className="section__title" id="regras-titulo">
                Regras de observacao
              </h2>
            </div>
            <p className="section__hint">
              Defina condicoes de preco ou de variacao. Elas sao comparadas com as cotacoes na
              avaliacao.
            </p>
          </div>
          <RulesPanel
            rules={rules}
            loading={loadingRules}
            error={rulesError}
            feedback={rulesFeedback}
            busy={rulesBusy}
            onCreate={handleCreateRule}
            onUpdate={handleUpdateRule}
            onToggle={handleToggleRule}
            onDelete={handleDeleteRule}
          />
        </section>

        <section className="section" id="alertas" aria-labelledby="alertas-titulo">
          <div className="section__head">
            <div>
              <span className="section__index">04 — Resultado</span>
              <h2 className="section__title" id="alertas-titulo">
                Alertas gerados
              </h2>
            </div>
            <p className="section__hint">
              Registro descritivo do que foi observado. Nao constitui recomendacao.
            </p>
          </div>
          <AlertsPanel
            alerts={alerts}
            rules={rules}
            loading={loadingAlerts}
            error={alertsError}
            evaluating={evaluating}
            lastSummary={lastSummary}
            onEvaluate={() => void handleEvaluate()}
          />
        </section>

        <section className="section" id="integracoes" aria-labelledby="integracoes-titulo">
          <div className="section__head">
            <div>
              <span className="section__index">05 — Transparencia</span>
              <h2 className="section__title" id="integracoes-titulo">
                Integracoes
              </h2>
            </div>
            <p className="section__hint">
              Estado, finalidade e tipo de autenticacao de cada servico externo utilizado.
            </p>
          </div>
          <IntegrationsPanel health={health} loading={loadingHealth} error={healthError} />
        </section>

        <footer className="footer">
          <div className="disclaimer">
            <span aria-hidden="true" style={{ fontWeight: 800 }}>
              i
            </span>
            <p>{DISCLAIMER_TEXT}</p>
          </div>
          <p>
            Projeto academico de integracao de APIs. Nao realiza compra, venda ou movimentacao de
            ativos e nao solicita dados pessoais.
          </p>
        </footer>
      </main>
    </>
  );
}
