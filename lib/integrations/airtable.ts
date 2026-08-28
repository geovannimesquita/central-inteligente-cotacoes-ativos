/**
 * Cliente da Web API do Airtable.
 *
 * O Personal Access Token e lido de `AIRTABLE_TOKEN` e usado exclusivamente
 * aqui, no servidor. Ele nunca aparece em resposta HTTP, em log ou em HTML — os
 * erros que sobem deste modulo carregam apenas o rotulo "Airtable".
 */

import { getAirtableConfig, type AirtableConfig } from "../config.ts";
import { AppError } from "../errors.ts";
import { fetchJson } from "../http.ts";
import { isRecord } from "../normalize/shared.ts";

const AIRTABLE_API_BASE = "https://api.airtable.com/v0";

export const AIRTABLE_SOURCE_LABEL = "Airtable";

export interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime?: string;
}

function requireConfig(): AirtableConfig {
  const config = getAirtableConfig();
  if (!config) {
    throw new AppError("MISSING_CREDENTIALS", {
      source: AIRTABLE_SOURCE_LABEL,
      message:
        "O Airtable nao esta configurado. Defina AIRTABLE_TOKEN e AIRTABLE_BASE_ID no ambiente.",
    });
  }
  return config;
}

function authHeaders(config: AirtableConfig): Record<string, string> {
  return { Authorization: `Bearer ${config.token}` };
}

/**
 * Monta a URL de uma tabela. O nome da tabela vem de variavel de ambiente
 * (nunca do usuario) e e codificado antes de entrar na URL.
 */
function tableUrl(config: AirtableConfig, table: string, suffix = ""): string {
  return `${AIRTABLE_API_BASE}/${encodeURIComponent(config.baseId)}/${encodeURIComponent(table)}${suffix}`;
}

function parseRecords(payload: unknown): AirtableRecord[] {
  if (!isRecord(payload) || !Array.isArray(payload.records)) {
    throw new AppError("UPSTREAM_INVALID_JSON", { source: AIRTABLE_SOURCE_LABEL });
  }
  return payload.records.filter(isAirtableRecord);
}

function isAirtableRecord(value: unknown): value is AirtableRecord {
  return isRecord(value) && typeof value.id === "string" && isRecord(value.fields);
}

function parseSingleRecord(payload: unknown): AirtableRecord {
  if (!isAirtableRecord(payload)) {
    throw new AppError("UPSTREAM_INVALID_JSON", { source: AIRTABLE_SOURCE_LABEL });
  }
  return payload;
}

/** Codigos do Airtable que significam, sem ambiguidade, "registro inexistente". */
const MISSING_RECORD_CODES = new Set(["NOT_FOUND", "MODEL_ID_NOT_FOUND", "ROW_DOES_NOT_EXIST"]);

/**
 * Codigo que o Airtable devolve com status 403 para "sem permissao OU registro
 * inexistente". A ambiguidade e intencional na API: ela evita confirmar a
 * existencia de um registro a quem talvez nao possa ve-lo.
 */
const AMBIGUOUS_FORBIDDEN_CODE = "INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND";

/**
 * Decide se uma falha em operacao por id significa "registro nao existe".
 *
 * O 403 ambiguo e desambiguado por uma consulta de controle: as permissoes de um
 * Personal Access Token sao concedidas por tabela, nunca por registro. Se ainda
 * conseguimos listar a tabela, o acesso esta em ordem e o que falta e o
 * registro. Se a listagem tambem falha, o problema e de permissao e o erro
 * original deve subir.
 */
async function isMissingRecordError(table: string, error: unknown): Promise<boolean> {
  if (!(error instanceof AppError)) return false;
  if (error.code === "UPSTREAM_NOT_FOUND") return true;
  if (error.upstreamCode && MISSING_RECORD_CODES.has(error.upstreamCode)) return true;

  if (error.code !== "UPSTREAM_FORBIDDEN" || error.upstreamCode !== AMBIGUOUS_FORBIDDEN_CODE) {
    return false;
  }

  try {
    await listRecords(table, { maxRecords: 1 });
    return true;
  } catch {
    return false;
  }
}

export interface ListOptions {
  maxRecords?: number;
  /** Campo usado na ordenacao descendente. */
  sortField?: string;
  pageSize?: number;
}

export async function listRecords(
  table: string,
  options: ListOptions = {},
): Promise<AirtableRecord[]> {
  const config = requireConfig();
  const params = new URLSearchParams();
  if (options.maxRecords) params.set("maxRecords", String(options.maxRecords));
  if (options.pageSize) params.set("pageSize", String(options.pageSize));
  if (options.sortField) {
    params.set("sort[0][field]", options.sortField);
    params.set("sort[0][direction]", "desc");
  }

  const query = params.toString();
  const payload = await fetchJson(tableUrl(config, table, query ? `?${query}` : ""), {
    source: AIRTABLE_SOURCE_LABEL,
    headers: authHeaders(config),
  });

  return parseRecords(payload);
}

export async function createRecords(
  table: string,
  records: Array<{ fields: Record<string, unknown> }>,
): Promise<AirtableRecord[]> {
  const config = requireConfig();
  // A API do Airtable aceita no maximo 10 registros por chamada.
  const batches: Array<Array<{ fields: Record<string, unknown> }>> = [];
  for (let i = 0; i < records.length; i += 10) {
    batches.push(records.slice(i, i + 10));
  }

  const created: AirtableRecord[] = [];
  for (const batch of batches) {
    const payload = await fetchJson(tableUrl(config, table), {
      source: AIRTABLE_SOURCE_LABEL,
      method: "POST",
      headers: authHeaders(config),
      body: { records: batch, typecast: true },
    });
    created.push(...parseRecords(payload));
  }
  return created;
}

export async function updateRecord(
  table: string,
  recordId: string,
  fields: Record<string, unknown>,
): Promise<AirtableRecord> {
  const config = requireConfig();
  try {
    const payload = await fetchJson(
      tableUrl(config, table, `/${encodeURIComponent(recordId)}`),
      {
        source: AIRTABLE_SOURCE_LABEL,
        method: "PATCH",
        headers: authHeaders(config),
        body: { fields, typecast: true },
      },
    );
    return parseSingleRecord(payload);
  } catch (error) {
    // Cobre a corrida entre a verificacao de existencia feita pela rota e a
    // gravacao: sem isso, um registro removido nesse intervalo viraria 502.
    if (await isMissingRecordError(table, error)) {
      throw new AppError("NOT_FOUND", { message: "Registro nao encontrado." });
    }
    throw error;
  }
}

export async function getRecord(table: string, recordId: string): Promise<AirtableRecord | null> {
  const config = requireConfig();
  try {
    const payload = await fetchJson(
      tableUrl(config, table, `/${encodeURIComponent(recordId)}`),
      { source: AIRTABLE_SOURCE_LABEL, headers: authHeaders(config) },
    );
    return parseSingleRecord(payload);
  } catch (error) {
    if (await isMissingRecordError(table, error)) return null;
    throw error;
  }
}

export async function deleteRecord(table: string, recordId: string): Promise<void> {
  const config = requireConfig();
  try {
    await fetchJson(tableUrl(config, table, `/${encodeURIComponent(recordId)}`), {
      source: AIRTABLE_SOURCE_LABEL,
      method: "DELETE",
      headers: authHeaders(config),
    });
  } catch (error) {
    if (await isMissingRecordError(table, error)) {
      throw new AppError("NOT_FOUND", { message: "Registro nao encontrado." });
    }
    throw error;
  }
}

/**
 * Verifica a conectividade lendo um unico registro da tabela de Regras.
 * Nao expoe conteudo: devolve apenas sucesso ou lanca `AppError`.
 */
export async function probeAirtable(): Promise<void> {
  const config = requireConfig();
  await fetchJson(tableUrl(config, config.tables.rules, "?maxRecords=1"), {
    source: AIRTABLE_SOURCE_LABEL,
    headers: authHeaders(config),
    timeoutMs: 5000,
    maxAttempts: 1,
  });
}
