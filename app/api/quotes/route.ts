/**
 * GET /api/quotes
 * GET /api/quotes?refresh=1  -> atualizacao forcada (com limite de frequencia)
 *
 * Consulta as duas fontes em paralelo, usa cache, normaliza, combina, avalia
 * frescor e devolve resposta padronizada. Falha de uma unica fonte produz
 * resposta parcial com avisos, nunca erro total.
 */

import { handleRoute, jsonOk, AppError } from "@/lib/api-response";
import { CACHE_KEYS, registerForcedRefresh } from "@/lib/cache";
import { getCacheTtlSeconds } from "@/lib/config";
import { getCombinedQuotes, isTotalFailure } from "@/lib/quotes";
import { parseBooleanParam } from "@/lib/validation";
import type { ApiWarning } from "@/types";

export const dynamic = "force-dynamic";

/** Chave unica de throttle das atualizacoes manuais (escopo da aplicacao). */
const REFRESH_THROTTLE_KEY = "quotes";

export async function GET(request: Request): Promise<Response> {
  return handleRoute(async () => {
    const url = new URL(request.url);
    const requestedRefresh = parseBooleanParam(url.searchParams.get("refresh"));

    const extraWarnings: ApiWarning[] = [];
    let forceRefresh = false;

    if (requestedRefresh) {
      const decision = registerForcedRefresh(REFRESH_THROTTLE_KEY);
      if (decision.allowed) {
        forceRefresh = true;
      } else {
        // O pedido nao e recusado com erro: devolvemos o cache com um aviso,
        // que e a experiencia mais util e ainda protege as APIs de origem.
        extraWarnings.push({
          code: "RATE_LIMITED",
          message: `Atualizacao manual disponivel novamente em ${decision.retryAfterSeconds}s. Exibindo os dados em cache.`,
        });
      }
    }

    const response = await getCombinedQuotes({
      forceRefresh,
      signal: request.signal,
    });

    if (isTotalFailure(response)) {
      throw new AppError("UPSTREAM_UNAVAILABLE", {
        message:
          "Nenhuma das fontes de cotacao respondeu. Verifique a conexao e tente novamente em instantes.",
      });
    }

    return jsonOk(
      {
        ...response,
        warnings: [...extraWarnings, ...response.warnings],
      },
      {
        headers: {
          // Documenta o TTL do cache do servidor para quem inspeciona a rota.
          "X-Cache-Ttl-Seconds": String(getCacheTtlSeconds()),
          "X-Cache-Key": CACHE_KEYS.currencyQuotes,
        },
      },
    );
  });
}
