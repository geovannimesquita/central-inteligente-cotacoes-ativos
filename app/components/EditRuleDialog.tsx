"use client";

/**
 * Dialogo de edicao de uma regra: ativo, condicao e valor de referencia.
 *
 * Acessibilidade: `role="dialog" aria-modal`, foco inicial no primeiro campo,
 * `Escape` e clique no fundo cancelam, o foco fica preso no dialogo enquanto ele
 * esta aberto e volta para o botao de origem ao fechar. Erros de campo sao
 * anunciados por `role="alert"` e ligados ao controle por `aria-describedby`.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ASSET_CATALOG } from "@/lib/assets";
import { CONDITION_LABELS, CONDITION_UNITS } from "@/lib/labels";
import {
  formatReferenceValueForInput,
  parseReferenceValueInput,
  referenceValueHelp,
} from "./rule-form";
import type { AlertCondition, AlertRule } from "@/types";

const CONDITION_OPTIONS = Object.keys(CONDITION_LABELS) as AlertCondition[];

export interface EditRuleValues {
  assetId: string;
  condition: AlertCondition;
  referenceValue: number;
}

interface EditRuleDialogProps {
  rule: AlertRule;
  busy: boolean;
  /** Erro vindo do backend, exibido dentro do dialogo. */
  serverError: string | null;
  onCancel: () => void;
  /** Deve resolver `true` quando a gravacao foi concluida. */
  onSave: (values: EditRuleValues) => Promise<boolean>;
}

export default function EditRuleDialog({
  rule,
  busy,
  serverError,
  onCancel,
  onSave,
}: EditRuleDialogProps) {
  const [assetId, setAssetId] = useState(rule.assetId);
  const [condition, setCondition] = useState<AlertCondition>(rule.condition);
  const [referenceValue, setReferenceValue] = useState(
    formatReferenceValueForInput(rule.referenceValue),
  );
  const [fieldError, setFieldError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLSelectElement>(null);

  const titleId = useId();
  const assetFieldId = useId();
  const conditionFieldId = useId();
  const valueFieldId = useId();
  const errorId = useId();
  const serverErrorId = useId();

  const isPercentCondition = CONDITION_UNITS[condition] === "percent";

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  /** Escape cancela; Tab circula entre os elementos focaveis do dialogo. */
  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select, input, [href], [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onCancel],
  );

  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = parseReferenceValueInput(referenceValue, condition);
    if (!parsed.ok) {
      setFieldError(parsed.error);
      return;
    }

    setFieldError(null);
    await onSave({ assetId, condition, referenceValue: parsed.value });
  }

  const unchanged =
    assetId === rule.assetId &&
    condition === rule.condition &&
    parseReferenceValueInput(referenceValue, condition).ok &&
    Number(referenceValue.trim().replace(",", ".")) === rule.referenceValue;

  return (
    <div
      className="dialog-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
      >
        <h2 className="dialog__title" id={titleId}>
          Editar regra
        </h2>

        <form className="stack" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label className="field__label" htmlFor={assetFieldId}>
              Ativo
            </label>
            <select
              id={assetFieldId}
              className="field__control"
              value={assetId}
              ref={firstFieldRef}
              disabled={busy}
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
              disabled={busy}
              onChange={(event) => {
                setCondition(event.target.value as AlertCondition);
                // A faixa aceita muda junto com a unidade; revalida na hora.
                setFieldError(null);
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
              value={referenceValue}
              disabled={busy}
              onChange={(event) => setReferenceValue(event.target.value)}
              aria-invalid={fieldError !== null}
              aria-describedby={fieldError ? errorId : undefined}
            />
            {fieldError ? (
              <p className="field__error" id={errorId} role="alert">
                <span aria-hidden="true">!</span> {fieldError}
              </p>
            ) : (
              <p className="field__help">{referenceValueHelp(condition)}</p>
            )}
          </div>

          {serverError ? (
            <p className="field__error" id={serverErrorId} role="alert">
              <span aria-hidden="true">!</span> {serverError}
            </p>
          ) : null}

          <div className="dialog__actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onCancel}
              disabled={busy}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary" disabled={busy || unchanged}>
              {busy ? <span className="spinner" aria-hidden="true" /> : null}
              {busy ? "Salvando" : "Salvar alteracoes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
