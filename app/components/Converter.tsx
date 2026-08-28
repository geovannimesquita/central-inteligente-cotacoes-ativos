"use client";

/**
 * Conversor entre um ativo e o real.
 *
 * Duas direcoes: ativo -> BRL e BRL -> ativo. A inversao so e oferecida quando
 * ha preco valido (> 0), condicao para a divisao ser tecnicamente aplicavel.
 * A validacao acontece no proprio componente porque nao ha requisicao envolvida.
 */

import { useEffect, useId, useMemo, useState } from "react";
import { CATEGORY_LABELS } from "@/lib/labels";
import { formatAssetAmount, formatBRL, formatDateTime } from "./format";
import type { NormalizedQuote } from "@/types";

type Direction = "assetToBrl" | "brlToAsset";

interface ConverterProps {
  quotes: NormalizedQuote[];
}

/** Aceita "1234,56" e "1234.56" — o usuario brasileiro digita dos dois jeitos. */
function parseAmount(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (normalized === "") return null;
  if (!/^\d*\.?\d*$/.test(normalized)) return Number.NaN;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export default function Converter({ quotes }: ConverterProps) {
  const [assetId, setAssetId] = useState<string>("");
  const [amount, setAmount] = useState<string>("1");
  const [direction, setDirection] = useState<Direction>("assetToBrl");

  const assetFieldId = useId();
  const amountFieldId = useId();
  const errorId = useId();

  // Seleciona o primeiro ativo assim que as cotacoes chegam, sem sobrescrever
  // uma escolha ja feita pelo usuario.
  useEffect(() => {
    if (assetId === "" && quotes.length > 0 && quotes[0]) {
      setAssetId(quotes[0].id);
    }
  }, [quotes, assetId]);

  const selected = useMemo(
    () => quotes.find((quote) => quote.id === assetId) ?? null,
    [quotes, assetId],
  );

  const parsedAmount = parseAmount(amount);
  const canInvert = selected !== null && selected.price > 0;

  let errorMessage: string | null = null;
  if (amount.trim() === "") {
    errorMessage = "Informe uma quantidade.";
  } else if (parsedAmount === null || Number.isNaN(parsedAmount)) {
    errorMessage = "Use apenas numeros, com virgula ou ponto decimal.";
  } else if (parsedAmount <= 0) {
    errorMessage = "A quantidade deve ser maior que zero.";
  } else if (parsedAmount > 1_000_000_000) {
    errorMessage = "A quantidade informada e alta demais.";
  }

  const canCompute = selected !== null && errorMessage === null && parsedAmount !== null;

  let resultLabel = "Resultado";
  let resultValue = "--";
  let resultDetail = "Selecione um ativo e informe uma quantidade.";

  if (canCompute && selected && parsedAmount !== null) {
    if (direction === "assetToBrl") {
      resultLabel = `Equivalente em reais`;
      resultValue = formatBRL(parsedAmount * selected.price);
      resultDetail = `${formatAssetAmount(parsedAmount)} ${selected.symbol} × ${formatBRL(
        selected.price,
        selected.category,
      )}`;
    } else if (canInvert) {
      resultLabel = `Equivalente em ${selected.symbol}`;
      resultValue = `${formatAssetAmount(parsedAmount / selected.price)} ${selected.symbol}`;
      resultDetail = `${formatBRL(parsedAmount)} ÷ ${formatBRL(
        selected.price,
        selected.category,
      )}`;
    }
  }

  const unitLabel =
    direction === "assetToBrl" ? (selected ? selected.symbol : "unidades") : "BRL";

  return (
    <div className="converter">
      <div className="card stack">
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
              disabled={quotes.length === 0}
            >
              {quotes.length === 0 ? <option value="">Nenhum ativo disponivel</option> : null}
              {quotes.map((quote) => (
                <option key={quote.id} value={quote.id}>
                  {quote.name} ({quote.symbol}) — {CATEGORY_LABELS[quote.category]}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="field__label" htmlFor={amountFieldId}>
              Quantidade em {unitLabel}
            </label>
            <input
              id={amountFieldId}
              className="field__control"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              aria-invalid={errorMessage !== null}
              aria-describedby={errorMessage ? errorId : undefined}
            />
            {errorMessage ? (
              <p className="field__error" id={errorId} role="alert">
                <span aria-hidden="true">!</span> {errorMessage}
              </p>
            ) : (
              <p className="field__help">Aceita casas decimais com virgula ou ponto.</p>
            )}
          </div>
        </div>

        <div className="converter__swap">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() =>
              setDirection((current) =>
                current === "assetToBrl" ? "brlToAsset" : "assetToBrl",
              )
            }
            disabled={!canInvert}
          >
            <span aria-hidden="true">⇄</span> Inverter conversao
          </button>
          <p className="field__help">
            {direction === "assetToBrl"
              ? `De ${selected ? selected.symbol : "ativo"} para BRL`
              : `De BRL para ${selected ? selected.symbol : "ativo"}`}
            {canInvert ? "" : " — inversao indisponivel sem preco valido."}
          </p>
        </div>
      </div>

      <div className="converter__result">
        <span className="converter__result-label">{resultLabel}</span>
        <output className="converter__result-value" aria-live="polite">
          {resultValue}
        </output>
        <span className="converter__result-detail">{resultDetail}</span>
        {selected ? (
          <span className="field__help">
            Fonte: {selected.source} · Cotacao de {formatDateTime(selected.updatedAt)}
            {selected.stale ? " · dado desatualizado" : ""}
          </span>
        ) : null}
      </div>
    </div>
  );
}
