/**
 * Leitura centralizada de configuracao de ambiente.
 *
 * Regra de ouro: nada aqui pode ser importado por um Client Component. Todos os
 * consumidores sao Route Handlers ou modulos executados no servidor. Nenhuma
 * variavel usa o prefixo `NEXT_PUBLIC_`, entao nenhum segredo chega ao browser.
 */

function readNumber(value: string | undefined, fallback: number, min: number, max: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function readString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Tempo de vida padrao do cache de cotacoes, em segundos. */
export function getCacheTtlSeconds(): number {
  return readNumber(process.env.CACHE_TTL_SECONDS, 300, 30, 3600);
}

/**
 * Janela, em minutos, dentro da qual um alerta identico nao e recriado.
 * Constante central da regra anti-duplicidade (secao 9 do escopo).
 */
export const DEFAULT_ALERT_DEDUP_MINUTES = 30;

export function getAlertDedupMinutes(): number {
  return readNumber(process.env.ALERT_DEDUP_MINUTES, DEFAULT_ALERT_DEDUP_MINUTES, 1, 1440);
}

/** Idade maxima, em segundos, antes de uma cotacao ser marcada como desatualizada. */
export const DEFAULT_STALE_THRESHOLD_SECONDS = 900;

export function getStaleThresholdSeconds(): number {
  return readNumber(
    process.env.QUOTE_STALE_THRESHOLD_SECONDS,
    DEFAULT_STALE_THRESHOLD_SECONDS,
    60,
    86_400,
  );
}

/** Intervalo minimo entre duas atualizacoes forcadas do cache, em segundos. */
export function getForcedRefreshCooldownSeconds(): number {
  return readNumber(process.env.FORCED_REFRESH_COOLDOWN_SECONDS, 20, 5, 600);
}

/** Numero maximo de regras aceitas pelo repositorio. */
export const MAX_RULES = 50;

/** Numero maximo de alertas retornados por consulta. */
export const MAX_ALERTS_PAGE_SIZE = 100;

/** Chave Demo opcional da CoinGecko. Permanece exclusivamente no servidor. */
export function getCoinGeckoApiKey(): string | undefined {
  return readString(process.env.COINGECKO_API_KEY);
}

export interface AirtableConfig {
  token: string;
  baseId: string;
  tables: {
    assets: string;
    rules: string;
    alerts: string;
  };
}

/**
 * Retorna a configuracao do Airtable ou `null` quando o ambiente nao esta
 * configurado. `null` e um estado esperado: a aplicacao roda em modo memoria.
 */
export function getAirtableConfig(): AirtableConfig | null {
  const token = readString(process.env.AIRTABLE_TOKEN);
  const baseId = readString(process.env.AIRTABLE_BASE_ID);
  if (!token || !baseId) return null;

  return {
    token,
    baseId,
    tables: {
      assets: readString(process.env.AIRTABLE_TABLE_ASSETS) ?? "Ativos",
      rules: readString(process.env.AIRTABLE_TABLE_RULES) ?? "Regras",
      alerts: readString(process.env.AIRTABLE_TABLE_ALERTS) ?? "Alertas",
    },
  };
}

export function isAirtableConfigured(): boolean {
  return getAirtableConfig() !== null;
}

/** Timeout aplicado a cada chamada HTTP externa, em milissegundos. */
export const EXTERNAL_REQUEST_TIMEOUT_MS = 8000;

/** Numero maximo de tentativas por chamada externa (1 inicial + retentativas). */
export const EXTERNAL_REQUEST_MAX_ATTEMPTS = 3;

/** Espera base do backoff progressivo entre tentativas, em milissegundos. */
export const EXTERNAL_REQUEST_BACKOFF_BASE_MS = 400;
