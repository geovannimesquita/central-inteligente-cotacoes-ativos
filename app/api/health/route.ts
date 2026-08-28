/**
 * GET /api/health
 *
 * Informa o estado geral da aplicacao e a disponibilidade das integracoes.
 * Nunca revela token, base id ou qualquer fragmento de credencial — apenas se a
 * configuracao existe (`configured: true/false`).
 *
 * As sondagens sao cacheadas por 60s para que um refresh agressivo da interface
 * nao vire trafego desnecessario contra AwesomeAPI, CoinGecko e Airtable.
 */

import { CACHE_KEYS, readCache, writeCache } from "@/lib/cache";
import { isAirtableConfigured } from "@/lib/config";
import { describeForLog } from "@/lib/errors";
import { probeAwesomeApi } from "@/lib/integrations/awesome-api";
import { hasCoinGeckoApiKey, probeCoinGecko } from "@/lib/integrations/coingecko";
import { probeAirtable } from "@/lib/integrations/airtable";
import { handleRoute, jsonOk } from "@/lib/api-response";
import { getPersistenceMode } from "@/lib/repositories";
import type { HealthPayload, IntegrationReport, IntegrationStatus } from "@/types";

export const dynamic = "force-dynamic";

const PROBE_CACHE_TTL_SECONDS = 60;

async function probe(run: () => Promise<void>): Promise<{ status: IntegrationStatus; detail: string | null }> {
  try {
    await run();
    return { status: "available", detail: null };
  } catch (error) {
    return { status: "unavailable", detail: describeForLog(error) };
  }
}

async function buildHealthPayload(): Promise<HealthPayload> {
  const airtableConfigured = isAirtableConfigured();

  const [awesome, coingecko, airtable] = await Promise.all([
    probe(() => probeAwesomeApi()),
    probe(() => probeCoinGecko()),
    airtableConfigured
      ? probe(() => probeAirtable())
      : Promise.resolve({
          status: "not_configured" as IntegrationStatus,
          detail: "Variaveis AIRTABLE_TOKEN e AIRTABLE_BASE_ID nao definidas.",
        }),
  ]);

  const integrations: IntegrationReport[] = [
    {
      name: "AwesomeAPI",
      status: awesome.status,
      purpose: "Cotacoes de moedas tradicionais em relacao ao real.",
      authentication: "Acesso publico, sem autenticacao.",
      credentials: "not_required",
      detail: awesome.detail,
    },
    {
      name: "CoinGecko",
      status: coingecko.status,
      purpose: "Cotacoes de criptoativos em relacao ao real.",
      authentication: hasCoinGeckoApiKey()
        ? "Chave Demo enviada em cabecalho, apenas no servidor."
        : "Acesso publico, sem autenticacao.",
      // A chave e opcional: sem ela a integracao segue funcionando.
      credentials: hasCoinGeckoApiKey() ? "configured" : "not_required",
      detail: coingecko.detail,
    },
    {
      name: "Airtable",
      status: airtable.status,
      purpose: "Persistencia de regras e alertas em banco no-code.",
      authentication: "Personal Access Token, apenas no servidor.",
      credentials: airtableConfigured ? "configured" : "missing",
      detail: airtable.detail,
    },
  ];

  const quotesAvailable =
    awesome.status === "available" || coingecko.status === "available";

  return {
    status: quotesAvailable ? "ok" : "degraded",
    persistence: {
      mode: getPersistenceMode(),
      airtableConfigured,
      notice: airtableConfigured
        ? "Regras e alertas sao gravados no Airtable."
        : "Airtable nao configurado. Regras e alertas usam armazenamento temporario em memoria e serao perdidos ao reiniciar o servidor.",
    },
    integrations,
    checkedAt: new Date().toISOString(),
  };
}

export async function GET(): Promise<Response> {
  return handleRoute(async () => {
    const cached = readCache<HealthPayload>(CACHE_KEYS.healthProbe);
    if (cached) return jsonOk(cached.value);

    const payload = await buildHealthPayload();
    writeCache(CACHE_KEYS.healthProbe, payload, PROBE_CACHE_TTL_SECONDS);
    return jsonOk(payload);
  });
}
