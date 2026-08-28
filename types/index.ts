/**
 * Modelo de dominio normalizado da Central Inteligente de Cotacoes e Ativos.
 *
 * Este arquivo e a unica fonte de verdade dos contratos compartilhados entre
 * integracoes, regras de negocio, Route Handlers e interface.
 */

/** Categoria de um ativo acompanhado pelo painel. */
export type AssetCategory = "currency" | "crypto";

/** Fonte externa de dados de onde a cotacao foi obtida. */
export type QuoteSource = "AwesomeAPI" | "CoinGecko";

/** Moeda de referencia unica desta versao do projeto. */
export type ReferenceCurrency = "BRL";

/** Cotacao ja normalizada, independente da API de origem. */
export interface NormalizedQuote {
  id: string;
  name: string;
  symbol: string;
  category: AssetCategory;
  price: number;
  referenceCurrency: ReferenceCurrency;
  /** Variacao percentual no periodo divulgado pela fonte; `null` quando ausente. */
  changePercentage: number | null;
  high: number | null;
  low: number | null;
  source: QuoteSource;
  /** Instante da cotacao informado pela fonte, em ISO 8601 (UTC). */
  updatedAt: string;
  /** `true` quando `updatedAt` esta alem do limite de frescor configurado. */
  stale: boolean;
}

/** Condicoes suportadas pelo motor de regras. */
export type AlertCondition =
  | "greater_than"
  | "less_than"
  | "change_greater_than"
  | "change_less_than";

/** Regra cadastrada pelo usuario para observacao de um ativo. */
export interface AlertRule {
  id: string;
  assetId: string;
  condition: AlertCondition;
  referenceValue: number;
  active: boolean;
  createdAt: string;
}

/** Alerta gerado quando uma regra ativa e satisfeita por uma cotacao. */
export interface GeneratedAlert {
  id: string;
  ruleId: string;
  assetId: string;
  observedValue: number;
  referenceValue: number;
  message: string;
  source: string;
  createdAt: string;
  viewed: boolean;
}

/** Estado divulgado de uma integracao externa. */
export type IntegrationStatus =
  | "available"
  | "degraded"
  | "unavailable"
  | "not_configured";

/** Aviso nao fatal anexado a uma resposta parcial. */
export interface ApiWarning {
  code: string;
  message: string;
}

/** Envelope padrao de resposta das rotas de leitura. */
export interface QuotesResponse {
  data: NormalizedQuote[];
  meta: {
    sources: {
      awesomeApi: IntegrationStatus;
      coinGecko: IntegrationStatus;
    };
    cached: boolean;
    updatedAt: string;
  };
  warnings: ApiWarning[];
}

/** Descricao de um ativo permitido (lista de permissao do backend). */
export interface AssetDefinition {
  id: string;
  name: string;
  symbol: string;
  category: AssetCategory;
  source: QuoteSource;
  /** Chave usada na requisicao a API de origem (par ou id do ativo). */
  sourceKey: string;
  active: boolean;
}

/** Modo de persistencia efetivamente em uso pelo backend. */
export type PersistenceMode = "airtable" | "memory";

/**
 * Situacao das credenciais de uma integracao.
 * `not_required` distingue "API publica" de "credencial faltando".
 */
export type CredentialState = "not_required" | "configured" | "missing";

/** Linha do painel de transparencia de integracoes. */
export interface IntegrationReport {
  name: string;
  status: IntegrationStatus;
  purpose: string;
  authentication: string;
  credentials: CredentialState;
  /** Motivo legivel quando o estado nao e `available`; nunca contem credencial. */
  detail: string | null;
}

/** Corpo devolvido por `GET /api/health`. */
export interface HealthPayload {
  status: "ok" | "degraded";
  persistence: {
    mode: PersistenceMode;
    airtableConfigured: boolean;
    notice: string;
  };
  integrations: IntegrationReport[];
  checkedAt: string;
}

/** Resumo devolvido pela automacao de avaliacao de regras. */
export interface EvaluationSummary {
  evaluatedRules: number;
  matchedRules: number;
  createdAlerts: number;
  skippedDuplicates: number;
  skippedMissingQuote: number;
  skippedMissingChange: number;
  persistence: PersistenceMode;
  evaluatedAt: string;
  alerts: GeneratedAlert[];
  warnings: ApiWarning[];
}
