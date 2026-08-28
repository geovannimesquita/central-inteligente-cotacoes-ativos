/**
 * Camada fina de acesso as rotas internas da aplicacao.
 *
 * O browser fala apenas com `/api/*`. Nenhuma chamada direta a AwesomeAPI,
 * CoinGecko ou Airtable sai do cliente, e nenhuma credencial trafega aqui.
 */

const GENERIC_ERROR =
  "Nao foi possivel concluir a operacao. Verifique sua conexao e tente novamente.";

interface ErrorEnvelope {
  error?: { code?: string; message?: string };
}

/**
 * Executa a requisicao e devolve o corpo tipado, ou lanca `Error` com a
 * mensagem publica devolvida pelo backend (ja segura para exibicao).
 */
export async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error("Falha de rede ao contatar o servidor da aplicacao.");
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      throw new Error("O servidor devolveu uma resposta em formato inesperado.");
    }
  }

  if (!response.ok) {
    const envelope = payload as ErrorEnvelope | null;
    throw new Error(envelope?.error?.message ?? GENERIC_ERROR);
  }

  return payload as T;
}
