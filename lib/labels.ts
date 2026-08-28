/**
 * Rotulos em portugues compartilhados por backend e interface.
 *
 * Modulo deliberadamente sem dependencia de ambiente ou de I/O: pode ser
 * importado por um Client Component sem arrastar configuracao de servidor para
 * o bundle do browser.
 */

import type {
  AlertCondition,
  AssetCategory,
  CredentialState,
  IntegrationStatus,
} from "../types/index.ts";

/** Condicao em linguagem legivel, usada no formulario e na lista de regras. */
export const CONDITION_LABELS: Record<AlertCondition, string> = {
  greater_than: "Preco acima de",
  less_than: "Preco abaixo de",
  change_greater_than: "Variacao em 24h acima de",
  change_less_than: "Variacao em 24h abaixo de",
};

/** Unidade do valor de referencia de cada condicao. */
export const CONDITION_UNITS: Record<AlertCondition, "BRL" | "percent"> = {
  greater_than: "BRL",
  less_than: "BRL",
  change_greater_than: "percent",
  change_less_than: "percent",
};

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  currency: "Moeda",
  crypto: "Criptoativo",
};

export const STATUS_LABELS: Record<IntegrationStatus, string> = {
  available: "Disponivel",
  degraded: "Instavel",
  unavailable: "Indisponivel",
  not_configured: "Nao configurado",
};

export const CREDENTIAL_LABELS: Record<CredentialState, string> = {
  not_required: "Nao requer credencial",
  configured: "Configuradas no servidor",
  missing: "Nao configuradas",
};

/** Aviso obrigatorio de carater informativo (secao de LGPD e etica). */
export const DISCLAIMER_TEXT =
  "As informacoes apresentadas possuem carater informativo e educacional. A aplicacao nao realiza recomendacoes de investimento. As cotacoes podem apresentar atraso ou diferencas em relacao a outras fontes.";
