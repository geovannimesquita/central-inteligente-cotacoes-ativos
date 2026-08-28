"use client";

/**
 * Painel de transparencia das integracoes.
 *
 * Mostra estado, finalidade, tipo de autenticacao e horario da verificacao.
 * Por decisao de seguranca, exibe apenas se a credencial esta configurada —
 * jamais o valor, o prefixo ou o tamanho dela.
 */

import { CREDENTIAL_LABELS, STATUS_LABELS } from "@/lib/labels";
import { formatDateTime } from "./format";
import type { HealthPayload } from "@/types";

interface IntegrationsPanelProps {
  health: HealthPayload | null;
  loading: boolean;
  error: string | null;
}

export default function IntegrationsPanel({ health, loading, error }: IntegrationsPanelProps) {
  if (error) {
    return (
      <div className="state state--error" role="alert">
        <p className="state__title">Nao foi possivel verificar as integracoes</p>
        <p className="state__text">{error}</p>
      </div>
    );
  }

  if (loading && !health) {
    return (
      <ul className="integrations" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <li key={index} className="skeleton" style={{ height: 214 }} />
        ))}
      </ul>
    );
  }

  if (!health) {
    return (
      <div className="state">
        <p className="state__title">Verificacao indisponivel</p>
        <p className="state__text">Ainda nao ha resultado de verificacao das integracoes.</p>
      </div>
    );
  }

  return (
    <ul className="integrations">
      {health.integrations.map((integration) => (
        <li key={integration.name} className="integration">
          <div className="integration__head">
            <span className="integration__name">{integration.name}</span>
            <span className="status-pill">
              <span
                className={`status-dot status-dot--${integration.status}`}
                aria-hidden="true"
              />
              {STATUS_LABELS[integration.status]}
            </span>
          </div>

          <dl className="integration__rows">
            <div>
              <dt>Finalidade</dt>
              <dd>{integration.purpose}</dd>
            </div>
            <div>
              <dt>Autenticacao</dt>
              <dd>{integration.authentication}</dd>
            </div>
            <div>
              <dt>Credenciais</dt>
              <dd>{CREDENTIAL_LABELS[integration.credentials]}</dd>
            </div>
            <div>
              <dt>Ultima verificacao</dt>
              <dd>{formatDateTime(health.checkedAt)}</dd>
            </div>
            {integration.detail ? (
              <div>
                <dt>Observacao</dt>
                <dd>{integration.detail}</dd>
              </div>
            ) : null}
          </dl>
        </li>
      ))}
    </ul>
  );
}
