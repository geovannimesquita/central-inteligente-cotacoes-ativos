"use client";

/**
 * Lista de ativos com filtro por categoria.
 *
 * Cada cartao exibe nome, simbolo, categoria, preco em BRL, variacao com
 * indicador textual, maxima/minima quando disponiveis, fonte, horario e o
 * marcador de dado desatualizado.
 */

import { useId, useState } from "react";
import { CATEGORY_LABELS } from "@/lib/labels";
import {
  DIRECTION_PRESENTATION,
  directionOf,
  formatBRL,
  formatDateTime,
  formatPercent,
} from "./format";
import type { AssetCategory, NormalizedQuote } from "@/types";

type Filter = "all" | AssetCategory;

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "currency", label: "Moedas" },
  { value: "crypto", label: "Criptoativos" },
];

interface AssetListProps {
  quotes: NormalizedQuote[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

function AssetCard({ quote }: { quote: NormalizedQuote }) {
  const direction = directionOf(quote.changePercentage);
  const presentation = DIRECTION_PRESENTATION[direction];

  return (
    <li className="asset">
      <div className="asset__top">
        <div className="row" style={{ gap: 12, flexWrap: "nowrap", minWidth: 0 }}>
          <span className="asset__symbol" aria-hidden="true">
            {quote.symbol}
          </span>
          <span style={{ minWidth: 0 }}>
            <span className="asset__name">{quote.name}</span>
            <span className="asset__meta">
              {quote.symbol} · {CATEGORY_LABELS[quote.category]}
            </span>
          </span>
        </div>

        {quote.stale ? (
          <span className="chip chip--warning" title="Cotacao alem do prazo de frescor">
            <span className="chip__glyph" aria-hidden="true">
              !
            </span>
            Desatualizado
          </span>
        ) : null}
      </div>

      <div>
        <span className="asset__price">{formatBRL(quote.price, quote.category)}</span>
        <div className="row" style={{ marginTop: 8 }}>
          {quote.changePercentage === null ? (
            <span className="chip chip--neutral">Variacao nao informada</span>
          ) : (
            <span className={`chip ${presentation.className}`}>
              <span className="chip__glyph" aria-hidden="true">
                {presentation.glyph}
              </span>
              {formatPercent(quote.changePercentage)}
              <span className="visually-hidden"> de {presentation.label}</span>
              <span aria-hidden="true"> {presentation.label}</span>
            </span>
          )}
        </div>
      </div>

      {quote.high !== null || quote.low !== null ? (
        <dl className="asset__range">
          {quote.high !== null ? (
            <div>
              <dt>Maxima</dt>
              <dd>{formatBRL(quote.high, quote.category)}</dd>
            </div>
          ) : null}
          {quote.low !== null ? (
            <div>
              <dt>Minima</dt>
              <dd>{formatBRL(quote.low, quote.category)}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className="asset__range" style={{ color: "var(--text-subtle)" }}>
          Maxima e minima nao fornecidas por esta fonte.
        </p>
      )}

      <div className="asset__foot">
        <span className="chip chip--info">Fonte: {quote.source}</span>
        <span>Atualizado em {formatDateTime(quote.updatedAt)}</span>
      </div>
    </li>
  );
}

export default function AssetList({ quotes, loading, error, onRetry }: AssetListProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const groupId = useId();

  const visible = filter === "all" ? quotes : quotes.filter((q) => q.category === filter);

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
        <div className="filters" role="group" aria-labelledby={groupId}>
          <span id={groupId} className="visually-hidden">
            Filtrar ativos por categoria
          </span>
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              className="filters__btn"
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="field__help" aria-live="polite">
          {loading && quotes.length === 0
            ? "Carregando cotacoes..."
            : `${visible.length} ativo(s) exibido(s)`}
        </p>
      </div>

      {loading && quotes.length === 0 ? (
        <ul className="assets" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <li key={index} className="skeleton skeleton--asset" />
          ))}
        </ul>
      ) : null}

      {!loading && error && quotes.length === 0 ? (
        <div className="state state--error" role="alert">
          <p className="state__title">Nao foi possivel carregar as cotacoes</p>
          <p className="state__text">{error}</p>
          <button type="button" className="btn btn--ghost" onClick={onRetry} style={{ marginTop: 16 }}>
            Tentar novamente
          </button>
        </div>
      ) : null}

      {!error && !loading && quotes.length === 0 ? (
        <div className="state">
          <p className="state__title">Nenhum ativo disponivel</p>
          <p className="state__text">
            Nenhuma cotacao foi retornada pelas fontes configuradas neste momento.
          </p>
        </div>
      ) : null}

      {visible.length > 0 ? (
        <ul className="assets">
          {visible.map((quote) => (
            <AssetCard key={quote.id} quote={quote} />
          ))}
        </ul>
      ) : null}

      {quotes.length > 0 && visible.length === 0 ? (
        <div className="state">
          <p className="state__title">Nenhum ativo nesta categoria</p>
          <p className="state__text">Selecione outro filtro para ver os ativos disponiveis.</p>
        </div>
      ) : null}
    </>
  );
}
