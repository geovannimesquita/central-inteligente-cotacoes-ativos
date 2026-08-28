/**
 * Erros internos padronizados.
 *
 * Toda falha tratada da aplicacao vira um `AppError`. A mensagem publica e
 * escrita em portugues, sem stack trace, sem token, sem URL com segredo e sem
 * detalhe interno — e ela que chega ao usuario final.
 */

export type AppErrorCode =
  | "INVALID_PARAM"
  | "ASSET_NOT_FOUND"
  | "NOT_FOUND"
  | "LIMIT_EXCEEDED"
  | "RATE_LIMITED"
  | "MISSING_CREDENTIALS"
  | "UPSTREAM_UNAUTHORIZED"
  | "UPSTREAM_FORBIDDEN"
  | "UPSTREAM_NOT_FOUND"
  | "UPSTREAM_RATE_LIMITED"
  | "UPSTREAM_UNAVAILABLE"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_INVALID_JSON"
  | "PARTIAL_FAILURE"
  | "PERSISTENCE_FAILURE"
  | "INTERNAL";

const DEFAULT_STATUS: Record<AppErrorCode, number> = {
  INVALID_PARAM: 400,
  ASSET_NOT_FOUND: 400,
  NOT_FOUND: 404,
  LIMIT_EXCEEDED: 409,
  RATE_LIMITED: 429,
  MISSING_CREDENTIALS: 503,
  UPSTREAM_UNAUTHORIZED: 502,
  UPSTREAM_FORBIDDEN: 502,
  UPSTREAM_NOT_FOUND: 502,
  UPSTREAM_RATE_LIMITED: 503,
  UPSTREAM_UNAVAILABLE: 502,
  UPSTREAM_TIMEOUT: 504,
  UPSTREAM_INVALID_JSON: 502,
  PARTIAL_FAILURE: 206,
  PERSISTENCE_FAILURE: 502,
  INTERNAL: 500,
};

const DEFAULT_MESSAGE: Record<AppErrorCode, string> = {
  INVALID_PARAM: "Os dados enviados sao invalidos. Revise os campos e tente novamente.",
  ASSET_NOT_FOUND: "O ativo informado nao esta na lista de ativos acompanhados.",
  NOT_FOUND: "Registro nao encontrado.",
  LIMIT_EXCEEDED: "O limite de registros permitido foi atingido.",
  RATE_LIMITED: "Muitas atualizacoes em sequencia. Aguarde alguns instantes.",
  MISSING_CREDENTIALS:
    "A integracao nao esta configurada neste ambiente. Defina as variaveis de ambiente necessarias.",
  UPSTREAM_UNAUTHORIZED: "A fonte de dados recusou a autenticacao da aplicacao.",
  UPSTREAM_FORBIDDEN: "A fonte de dados negou o acesso a este recurso.",
  UPSTREAM_NOT_FOUND: "O recurso solicitado nao existe na fonte de dados.",
  UPSTREAM_RATE_LIMITED:
    "A fonte de dados atingiu o limite de requisicoes. Tente novamente em instantes.",
  UPSTREAM_UNAVAILABLE: "A fonte de dados esta indisponivel no momento.",
  UPSTREAM_TIMEOUT: "A fonte de dados demorou demais para responder.",
  UPSTREAM_INVALID_JSON: "A fonte de dados retornou uma resposta em formato inesperado.",
  PARTIAL_FAILURE: "Parte das fontes de dados nao respondeu. Exibindo resultado parcial.",
  PERSISTENCE_FAILURE: "Nao foi possivel gravar os dados no banco. Nenhuma alteracao foi salva.",
  INTERNAL: "Ocorreu um erro inesperado ao processar a solicitacao.",
};

export interface AppErrorOptions {
  /** Mensagem publica alternativa (sempre segura para exibir ao usuario). */
  message?: string;
  /** Status HTTP alternativo. */
  status?: number;
  /** Rotulo da fonte/recurso envolvido, sem credenciais. */
  source?: string;
  /**
   * Codigo curto de erro devolvido pela API externa (ex.: "NOT_FOUND").
   * Uso exclusivamente interno: permite que um conector distinga situacoes que
   * a API expoe com o mesmo status HTTP. Nunca vai para a resposta ao cliente.
   */
  upstreamCode?: string;
  /** Erro original, mantido apenas para log de servidor. */
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly source?: string;
  readonly upstreamCode?: string;

  constructor(code: AppErrorCode, options: AppErrorOptions = {}) {
    super(options.message ?? DEFAULT_MESSAGE[code], { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.status = options.status ?? DEFAULT_STATUS[code];
    this.source = options.source;
    this.upstreamCode = options.upstreamCode;
  }

  /** Representacao segura para envio ao cliente. */
  toPublicJSON(): { error: { code: AppErrorCode; message: string; source?: string } } {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.source ? { source: this.source } : {}),
      },
    };
  }
}

/** Converte o status HTTP de uma API externa no codigo interno correspondente. */
export function appErrorCodeFromHttpStatus(status: number): AppErrorCode {
  if (status === 401) return "UPSTREAM_UNAUTHORIZED";
  if (status === 403) return "UPSTREAM_FORBIDDEN";
  if (status === 404) return "UPSTREAM_NOT_FOUND";
  if (status === 429) return "UPSTREAM_RATE_LIMITED";
  if (status >= 500) return "UPSTREAM_UNAVAILABLE";
  return "UPSTREAM_UNAVAILABLE";
}

/** Normaliza qualquer valor lancado em um `AppError`. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return new AppError("INTERNAL", { cause: error });
}

/**
 * Mensagem curta e segura para log de servidor.
 * Nunca inclui stack trace em producao nem valores de credenciais.
 */
export function describeForLog(error: unknown): string {
  const appError = toAppError(error);
  const suffix = appError.source ? ` [${appError.source}]` : "";
  const upstream = appError.upstreamCode ? ` (upstream: ${appError.upstreamCode})` : "";
  return `${appError.code}${suffix}${upstream}: ${appError.message}`;
}
