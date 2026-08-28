"use client";

/**
 * Resumo numerico do painel: contagens de ativos, regras ativas, alertas
 * recentes e horario da ultima atualizacao.
 */

import { formatTime } from "./format";
import type { NormalizedQuote } from "@/types";

interface SummaryPanelProps {
  quotes: NormalizedQuote[];
  activeRules: number;
  recentAlerts: number;
  updatedAt: string | null;
  loading: boolean;
}

interface StatProps {
  label: string;
  value: string;
  note?: string;
  small?: boolean;
}

function Stat({ label, value, note, small }: StatProps) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className={`stat__value${small ? " stat__value--sm" : ""}`}>{value}</span>
      {note ? <span className="stat__note">{note}</span> : null}
    </div>
  );
}

export default function SummaryPanel({
  quotes,
  activeRules,
  recentAlerts,
  updatedAt,
  loading,
}: SummaryPanelProps) {
  const currencies = quotes.filter((quote) => quote.category === "currency").length;
  const cryptos = quotes.filter((quote) => quote.category === "crypto").length;
  const staleCount = quotes.filter((quote) => quote.stale).length;

  const placeholder = loading && quotes.length === 0 ? "--" : String(quotes.length);

  return (
    <div className="summary">
      <Stat label="Ativos monitorados" value={placeholder} />
      <Stat label="Moedas" value={loading && quotes.length === 0 ? "--" : String(currencies)} />
      <Stat label="Criptoativos" value={loading && quotes.length === 0 ? "--" : String(cryptos)} />
      <Stat label="Regras ativas" value={String(activeRules)} />
      <Stat label="Alertas recentes" value={String(recentAlerts)} />
      <Stat
        label="Ultima atualizacao"
        value={updatedAt ? formatTime(updatedAt) : "--:--:--"}
        note={staleCount > 0 ? `${staleCount} cotacao(oes) desatualizada(s)` : "Dados no prazo"}
        small
      />
    </div>
  );
}
