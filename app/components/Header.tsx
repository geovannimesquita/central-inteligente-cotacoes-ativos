"use client";

/**
 * Cabecalho fixo: identidade, navegacao entre secoes, botao de atualizacao e
 * indicador do estado das APIs.
 *
 * A navegacao usa ancoras reais (`<a href="#secao">`), o que mantem o
 * comportamento nativo do teclado e do historico do navegador.
 */

import StatusPill from "./StatusPill";
import { formatTime } from "./format";
import type { IntegrationStatus } from "@/types";

export const NAV_SECTIONS = [
  { id: "painel", label: "Painel" },
  { id: "conversor", label: "Conversor" },
  { id: "regras", label: "Regras" },
  { id: "alertas", label: "Alertas" },
  { id: "integracoes", label: "Integracoes" },
] as const;

interface HeaderProps {
  sources: { awesomeApi: IntegrationStatus; coinGecko: IntegrationStatus };
  airtableStatus: IntegrationStatus;
  updatedAt: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}

export default function Header({
  sources,
  airtableStatus,
  updatedAt,
  refreshing,
  onRefresh,
}: HeaderProps) {
  return (
    <header className="header">
      <div className="header__inner">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            CI
          </span>
          <span>
            <span className="brand__name">Central Inteligente</span>
            <span className="brand__tag">Cotacoes &amp; Ativos</span>
          </span>
        </div>

        <nav className="header__nav" aria-label="Secoes do painel">
          {NAV_SECTIONS.map((section) => (
            <a key={section.id} href={`#${section.id}`}>
              {section.label}
            </a>
          ))}
        </nav>

        <button
          type="button"
          className="btn btn--primary header__refresh"
          onClick={onRefresh}
          disabled={refreshing}
        >
          {refreshing ? <span className="spinner" aria-hidden="true" /> : null}
          {refreshing ? "Atualizando" : "Atualizar"}
          <span className="visually-hidden">
            {updatedAt ? ` Ultima atualizacao as ${formatTime(updatedAt)}` : ""}
          </span>
        </button>
      </div>

      {/* Faixa propria para o estado das APIs: mantem a linha principal do
          cabecalho legivel em telas estreitas sem esconder a informacao. */}
      <div className="header__status">
        <div className="header__status-inner" role="group" aria-label="Estado das integracoes">
          <StatusPill name="AwesomeAPI" status={sources.awesomeApi} />
          <StatusPill name="CoinGecko" status={sources.coinGecko} />
          <StatusPill name="Airtable" status={airtableStatus} />
        </div>
      </div>
    </header>
  );
}
