/**
 * Indicador do estado de uma integracao.
 *
 * O ponto colorido e acompanhado sempre do rotulo textual ("Disponivel",
 * "Instavel", ...), de modo que o estado seja legivel sem percepcao de cor.
 */

import { STATUS_LABELS } from "@/lib/labels";
import type { IntegrationStatus } from "@/types";

interface StatusPillProps {
  name: string;
  status: IntegrationStatus;
}

export default function StatusPill({ name, status }: StatusPillProps) {
  return (
    <span className="status-pill">
      <span className={`status-dot status-dot--${status}`} aria-hidden="true" />
      <span>
        {name}: {STATUS_LABELS[status]}
      </span>
    </span>
  );
}
