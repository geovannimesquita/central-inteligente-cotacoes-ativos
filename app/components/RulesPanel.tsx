"use client";

/**
 * Cadastro, edicao e gestao das regras de alerta.
 *
 * Os formularios validam de imediato para dar retorno rapido, mas a decisao
 * final e sempre do backend (`lib/validation.ts`) — o cliente nunca e a unica
 * barreira.
 */

import { useEffect, useId, useRef, useState } from "react";
import { ASSET_CATALOG } from "@/lib/assets";
import { CONDITION_LABELS, CONDITION_UNITS } from "@/lib/labels";
import Banner from "./Banner";
import ConfirmDialog from "./ConfirmDialog";
import EditRuleDialog, { type EditRuleValues } from "./EditRuleDialog";
import { formatBRL, formatDateTime, formatPercent } from "./format";
import { parseReferenceValueInput, referenceValueHelp } from "./rule-form";
import type { AlertCondition, AlertRule } from "@/types";

const CONDITION_OPTIONS = Object.keys(CONDITION_LABELS) as AlertCondition[];

/** Resultado de uma operacao de escrita, com a mensagem publica em caso de erro. */
export type RuleMutationResult = { ok: true } | { ok: false; error: string };

/** Retorno da ultima operacao, exibido como aviso acima da tabela. */
export interface RuleFeedback {
  tone: "info" | "error";
  message: string;
}

interface RulesPanelProps {
  rules: AlertRule[];
  loading: boolean;
  /** Falha ao carregar a lista (distinta do retorno de uma operacao). */
  error: string | null;
  feedback: RuleFeedback | null;
  busy: boolean;
  onCreate: (input: {
    assetId: string;
    condition: AlertCondition;
    referenceValue: number;
  }) => Promise<boolean>;
  onUpdate: (rule: AlertRule, values: EditRuleValues) => Promise<RuleMutationResult>;
  onToggle: (rule: AlertRule) => Promise<void>;
  onDelete: (rule: AlertRule) => Promise<void>;
}

function assetNameOf(assetId: string): string {
  const asset = ASSET_CATALOG.find((item) => item.id === assetId);
  return asset ? `${asset.name} (${asset.symbol})` : assetId;
}

/** Formata o valor de referencia conforme a unidade da condicao. */
export function formatReferenceValue(condition: AlertCondition, value: number): string {
  return CONDITION_UNITS[condition] === "percent" ? formatPercent(value) : formatBRL(value);
}

export default function RulesPanel({
  rules,
  loading,
  error,
  feedback,
  busy,
  onCreate,
  onUpdate,
  onToggle,
  onDelete,
}: RulesPanelProps) {
  const firstAsset = ASSET_CATALOG[0];
  const [assetId, setAssetId] = useState<string>(firstAsset ? firstAsset.id : "");
  const [condition, setCondition] = useState<AlertCondition>("greater_than");
  const [referenceValue, setReferenceValue] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  const [pendingDeletion, setPendingDeletion] = useState<AlertRule | null>(null);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  // Guarda o botao que abriu o dialogo para devolver o foco ao fecha-lo.
  const dialogTriggerRef = useRef<HTMLElement | null>(null);

  const assetFieldId = useId();
  const conditionFieldId = useId();
  const valueFieldId = useId();
  const errorId = useId();

  const isPercentCondition = CONDITION_UNITS[condition] === "percent";

  function rememberTrigger() {
    dialogTriggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }

  /**
   * Devolve o foco ao botao que abriu o dialogo.
   *
   * Precisa acontecer em efeito, e nao dentro do handler: quando o handler roda,
   * o React ainda nao desmontou o dialogo, e o foco aplicado ali seria perdido
   * na remocao.
   *
   * A referencia so e liberada quando o foco chega de fato ao botao. Enquanto a
   * gravacao acontece, `busy` mantem o botao desabilitado, e elemento
   * desabilitado nao recebe foco — por isso `busy` entra nas dependencias, para
   * o efeito tentar de novo assim que a operacao terminar.
   *
   * Se o botao deixou de existir (caso da exclusao, em que a linha inteira sai
   * da tabela), a referencia e apenas descartada.
   */
  useEffect(() => {
    if (editingRule !== null || pendingDeletion !== null) return;

    const trigger = dialogTriggerRef.current;
    if (!trigger) return;

    if (!document.contains(trigger)) {
      dialogTriggerRef.current = null;
      return;
    }

    trigger.focus();
    if (document.activeElement === trigger) dialogTriggerRef.current = null;
  }, [editingRule, pendingDeletion, busy]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = parseReferenceValueInput(referenceValue, condition);
    if (!parsed.ok) {
      setFormError(parsed.error);
      return;
    }

    setFormError(null);
    const created = await onCreate({ assetId, condition, referenceValue: parsed.value });
    if (created) setReferenceValue("");
  }

  return (
    <div className="stack">
      <form className="card stack" onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          <div className="field">
            <label className="field__label" htmlFor={assetFieldId}>
              Ativo
            </label>
            <select
              id={assetFieldId}
              className="field__control"
              value={assetId}
              onChange={(event) => setAssetId(event.target.value)}
            >
              {ASSET_CATALOG.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name} ({asset.symbol})
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="field__label" htmlFor={conditionFieldId}>
              Condicao
            </label>
            <select
              id={conditionFieldId}
              className="field__control"
              value={condition}
              onChange={(event) => {
                setCondition(event.target.value as AlertCondition);
                setFormError(null);
              }}
            >
              {CONDITION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {CONDITION_LABELS[option]}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="field__label" htmlFor={valueFieldId}>
              Valor de referencia {isPercentCondition ? "(%)" : "(R$)"}
            </label>
            <input
              id={valueFieldId}
              className="field__control"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder={isPercentCondition ? "Ex.: 3,5" : "Ex.: 5,50"}
              value={referenceValue}
              onChange={(event) => setReferenceValue(event.target.value)}
              aria-invalid={formError !== null}
              aria-describedby={formError ? errorId : undefined}
            />
            {formError ? (
              <p className="field__error" id={errorId} role="alert">
                <span aria-hidden="true">!</span> {formError}
              </p>
            ) : (
              <p className="field__help">{referenceValueHelp(condition)}</p>
            )}
          </div>

          <div className="field" style={{ justifyContent: "flex-end" }}>
            <span className="field__label" aria-hidden="true">
              &nbsp;
            </span>
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? <span className="spinner" aria-hidden="true" /> : null}
              Cadastrar regra
            </button>
          </div>
        </div>
      </form>

      {/* Retorno visivel da ultima operacao; o anuncio sonoro fica na regiao
          aria-live unica do painel. */}
      {feedback ? (
        <Banner tone={feedback.tone === "error" ? "error" : "info"}>{feedback.message}</Banner>
      ) : null}

      {error ? (
        <div className="state state--error" role="alert">
          <p className="state__title">Nao foi possivel carregar as regras</p>
          <p className="state__text">{error}</p>
        </div>
      ) : null}

      {loading && rules.length === 0 ? (
        <div className="skeleton" style={{ height: 140 }} aria-hidden="true" />
      ) : null}

      {!loading && !error && rules.length === 0 ? (
        <div className="state">
          <p className="state__title">Nenhuma regra cadastrada</p>
          <p className="state__text">
            Cadastre uma regra acima para que a automacao passe a compara-la com as cotacoes.
          </p>
        </div>
      ) : null}

      {rules.length > 0 ? (
        <div className="card card--flush">
          <div className="table-wrap">
            <table className="table">
              <caption className="visually-hidden">
                Regras cadastradas, com ativo, condicao, valor, estado e acoes
              </caption>
              <thead>
                <tr>
                  <th scope="col">Ativo</th>
                  <th scope="col">Condicao</th>
                  <th scope="col">Valor</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Criada em</th>
                  <th scope="col">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td>{assetNameOf(rule.assetId)}</td>
                    <td>{CONDITION_LABELS[rule.condition]}</td>
                    <td className="num">
                      {formatReferenceValue(rule.condition, rule.referenceValue)}
                    </td>
                    <td>
                      <span className={`chip ${rule.active ? "chip--positive" : "chip--neutral"}`}>
                        <span className="chip__glyph" aria-hidden="true">
                          {rule.active ? "●" : "○"}
                        </span>
                        {rule.active ? "Ativa" : "Inativa"}
                      </span>
                    </td>
                    <td className="num">{formatDateTime(rule.createdAt)}</td>
                    <td>
                      <div className="table__actions">
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => {
                            rememberTrigger();
                            setEditError(null);
                            setEditingRule(rule);
                          }}
                          disabled={busy}
                        >
                          Editar
                          <span className="visually-hidden">
                            {" "}
                            a regra de {assetNameOf(rule.assetId)}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => onToggle(rule)}
                          disabled={busy}
                        >
                          {rule.active ? "Desativar" : "Ativar"}
                          <span className="visually-hidden">
                            {" "}
                            a regra de {assetNameOf(rule.assetId)}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="btn btn--danger btn--sm"
                          onClick={() => {
                            rememberTrigger();
                            setPendingDeletion(rule);
                          }}
                          disabled={busy}
                        >
                          Excluir
                          <span className="visually-hidden">
                            {" "}
                            a regra de {assetNameOf(rule.assetId)}
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {editingRule ? (
        <EditRuleDialog
          rule={editingRule}
          busy={busy}
          serverError={editError}
          onCancel={() => {
            setEditingRule(null);
            setEditError(null);
          }}
          onSave={async (values) => {
            const result = await onUpdate(editingRule, values);
            if (result.ok) {
              setEditingRule(null);
              setEditError(null);
              return true;
            }
            setEditError(result.error);
            return false;
          }}
        />
      ) : null}

      {pendingDeletion ? (
        <ConfirmDialog
          title="Excluir regra"
          description={`A regra "${CONDITION_LABELS[pendingDeletion.condition]} ${formatReferenceValue(
            pendingDeletion.condition,
            pendingDeletion.referenceValue,
          )}" de ${assetNameOf(pendingDeletion.assetId)} sera removida. Esta acao nao pode ser desfeita.`}
          confirmLabel="Excluir regra"
          busy={busy}
          onCancel={() => setPendingDeletion(null)}
          onConfirm={async () => {
            const rule = pendingDeletion;
            setPendingDeletion(null);
            await onDelete(rule);
          }}
        />
      ) : null}
    </div>
  );
}
