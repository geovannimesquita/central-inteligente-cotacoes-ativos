/**
 * Cliente HTTP compartilhado pelas integracoes externas.
 *
 * Responsabilidades: timeout por tentativa, numero maximo de tentativas,
 * backoff progressivo, tratamento explicito de 429 e traducao de qualquer falha
 * em `AppError`. Nenhuma URL montada aqui aceita host vindo do usuario — os
 * endpoints sao constantes dos modulos de integracao.
 */

import {
  EXTERNAL_REQUEST_BACKOFF_BASE_MS,
  EXTERNAL_REQUEST_MAX_ATTEMPTS,
  EXTERNAL_REQUEST_TIMEOUT_MS,
} from "./config.ts";
import { AppError, appErrorCodeFromHttpStatus } from "./errors.ts";

export interface FetchJsonOptions {
  /** Rotulo da fonte usado em erros e logs (jamais contem credenciais). */
  source: string;
  headers?: Record<string, string>;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  timeoutMs?: number;
  maxAttempts?: number;
  /** Sinal externo para cancelar a chamada (encadeado ao timeout interno). */
  signal?: AbortSignal;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Status que valem uma nova tentativa: instabilidade transitoria ou 429. */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Extrai o codigo curto de erro do corpo de uma resposta com falha.
 *
 * Existe porque APIs reais reaproveitam o mesmo status HTTP para situacoes
 * diferentes — o Airtable, por exemplo, responde 403 tanto para "sem permissao"
 * quanto para "registro inexistente", diferenciando apenas no corpo.
 *
 * Somente o identificador curto e aproveitado (letras maiusculas, digitos e
 * sublinhado); mensagens livres da API sao descartadas para nao carregarem
 * conteudo inesperado para dentro da aplicacao.
 */
function extractUpstreamCode(rawBody: string): string | undefined {
  if (!rawBody || rawBody.length > 4096) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    return undefined;
  }

  if (typeof parsed !== "object" || parsed === null) return undefined;
  const error = (parsed as { error?: unknown }).error;

  const candidate =
    typeof error === "string"
      ? error
      : typeof error === "object" && error !== null
        ? (error as { type?: unknown }).type
        : undefined;

  if (typeof candidate !== "string") return undefined;
  return /^[A-Z0-9_]{1,64}$/.test(candidate) ? candidate : undefined;
}

/**
 * Le o `Retry-After` (segundos) quando presente, limitado a 5s para nao
 * bloquear a requisicao do usuario por tempo indeterminado.
 */
function parseRetryAfterMs(headerValue: string | null): number | null {
  if (!headerValue) return null;
  const seconds = Number(headerValue);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.min(seconds * 1000, 5000);
}

/**
 * Executa uma requisicao JSON com retentativas e devolve o corpo desserializado.
 * O tipo de retorno e `unknown` de proposito: a validacao de forma acontece nos
 * modulos de normalizacao, nunca por asercao cega de tipo.
 */
export async function fetchJson(url: string, options: FetchJsonOptions): Promise<unknown> {
  const {
    source,
    headers = {},
    method = "GET",
    body,
    timeoutMs = EXTERNAL_REQUEST_TIMEOUT_MS,
    maxAttempts = EXTERNAL_REQUEST_MAX_ATTEMPTS,
    signal,
  } = options;

  let lastError: AppError = new AppError("UPSTREAM_UNAVAILABLE", { source });

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
    const onExternalAbort = () => timeoutController.abort();
    signal?.addEventListener("abort", onExternalAbort);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: timeoutController.signal,
        // O cache proprio da aplicacao (lib/cache.ts) e a unica camada de cache;
        // desabilitamos o cache do fetch do Next para nao ter duas verdades.
        cache: "no-store",
      });

      if (!response.ok) {
        const code = appErrorCodeFromHttpStatus(response.status);
        const upstreamCode = extractUpstreamCode(await response.text());
        lastError = new AppError(code, {
          source,
          ...(upstreamCode ? { upstreamCode } : {}),
        });

        if (isRetryableStatus(response.status) && attempt < maxAttempts) {
          const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
          await delay(retryAfterMs ?? EXTERNAL_REQUEST_BACKOFF_BASE_MS * 2 ** (attempt - 1));
          continue;
        }
        throw lastError;
      }

      const text = await response.text();
      try {
        return JSON.parse(text) as unknown;
      } catch (parseError) {
        throw new AppError("UPSTREAM_INVALID_JSON", { source, cause: parseError });
      }
    } catch (error) {
      if (error instanceof AppError) {
        lastError = error;
        // Erros nao retentaveis (401/403/404/JSON invalido) param imediatamente.
        if (error.code === "UPSTREAM_INVALID_JSON" || !isRetryable(error)) throw error;
      } else if (isAbortError(error)) {
        // Cancelamento do consumidor nao deve virar retentativa.
        if (signal?.aborted) {
          throw new AppError("UPSTREAM_UNAVAILABLE", { source, cause: error });
        }
        lastError = new AppError("UPSTREAM_TIMEOUT", { source, cause: error });
      } else {
        lastError = new AppError("UPSTREAM_UNAVAILABLE", { source, cause: error });
      }

      if (attempt >= maxAttempts) throw lastError;
      await delay(EXTERNAL_REQUEST_BACKOFF_BASE_MS * 2 ** (attempt - 1));
    } finally {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onExternalAbort);
    }
  }

  throw lastError;
}

function isRetryable(error: AppError): boolean {
  return error.code === "UPSTREAM_RATE_LIMITED" || error.code === "UPSTREAM_UNAVAILABLE";
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}
