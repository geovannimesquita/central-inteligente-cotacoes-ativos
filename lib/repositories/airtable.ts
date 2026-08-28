/**
 * Repositorio Airtable — implementa o mesmo contrato do repositorio em memoria.
 *
 * Mapeamento de campos (nomes exatos das colunas nas tabelas do Airtable):
 *   Regras  : Identificador, AtivoId, Condicao, ValorReferencia, Ativa, CriadaEm
 *   Alertas : Identificador, RegraId, AtivoId, ValorObservado, ValorReferencia,
 *             Mensagem, Fonte, CriadoEm, Visualizado
 *
 * `Identificador` guarda o mesmo id de registro do Airtable, permitindo que a
 * tabela seja legivel por humanos sem depender da coluna oculta de record id.
 */

import { randomUUID } from "node:crypto";
import { isAlertCondition } from "../alert-rules.ts";
import { getAirtableConfig, MAX_RULES } from "../config.ts";
import { AppError } from "../errors.ts";
import {
  createRecords,
  deleteRecord,
  getRecord,
  listRecords,
  updateRecord,
  type AirtableRecord,
} from "../integrations/airtable.ts";
import { toFiniteNumber } from "../normalize/shared.ts";
import type { AlertRule, GeneratedAlert } from "../../types/index.ts";
import type { CreateRuleData, DataRepository, UpdateRuleData } from "./types.ts";

export const RULE_FIELDS = {
  identifier: "Identificador",
  assetId: "AtivoId",
  condition: "Condicao",
  referenceValue: "ValorReferencia",
  active: "Ativa",
  createdAt: "CriadaEm",
} as const;

export const ALERT_FIELDS = {
  identifier: "Identificador",
  ruleId: "RegraId",
  assetId: "AtivoId",
  observedValue: "ValorObservado",
  referenceValue: "ValorReferencia",
  message: "Mensagem",
  source: "Fonte",
  createdAt: "CriadoEm",
  viewed: "Visualizado",
} as const;

function readString(fields: Record<string, unknown>, key: string): string {
  const value = fields[key];
  return typeof value === "string" ? value : "";
}

function readBoolean(fields: Record<string, unknown>, key: string): boolean {
  const value = fields[key];
  if (typeof value === "boolean") return value;
  // O Airtable pode devolver checkbox vazio como ausente, ou texto em campos
  // configurados como "Single line text" — ambos os casos sao tratados aqui.
  if (typeof value === "string") return value.toLowerCase() === "true" || value === "1";
  return false;
}

function readIsoDate(fields: Record<string, unknown>, key: string, fallback: string): string {
  const value = fields[key];
  if (typeof value !== "string" || value.trim() === "") return fallback;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? fallback : new Date(parsed).toISOString();
}

/** Converte um registro do Airtable em `AlertRule`, ou `null` se invalido. */
function toAlertRule(record: AirtableRecord): AlertRule | null {
  const condition = readString(record.fields, RULE_FIELDS.condition);
  if (!isAlertCondition(condition)) return null;

  const assetId = readString(record.fields, RULE_FIELDS.assetId);
  if (!assetId) return null;

  const referenceValue = toFiniteNumber(record.fields[RULE_FIELDS.referenceValue]);
  if (referenceValue === null) return null;

  return {
    id: record.id,
    assetId,
    condition,
    referenceValue,
    active: readBoolean(record.fields, RULE_FIELDS.active),
    createdAt: readIsoDate(
      record.fields,
      RULE_FIELDS.createdAt,
      record.createdTime ?? new Date().toISOString(),
    ),
  };
}

function toGeneratedAlert(record: AirtableRecord): GeneratedAlert | null {
  const ruleId = readString(record.fields, ALERT_FIELDS.ruleId);
  const assetId = readString(record.fields, ALERT_FIELDS.assetId);
  if (!ruleId || !assetId) return null;

  return {
    id: record.id,
    ruleId,
    assetId,
    observedValue: toFiniteNumber(record.fields[ALERT_FIELDS.observedValue]) ?? 0,
    referenceValue: toFiniteNumber(record.fields[ALERT_FIELDS.referenceValue]) ?? 0,
    message: readString(record.fields, ALERT_FIELDS.message),
    source: readString(record.fields, ALERT_FIELDS.source),
    createdAt: readIsoDate(
      record.fields,
      ALERT_FIELDS.createdAt,
      record.createdTime ?? new Date().toISOString(),
    ),
    viewed: readBoolean(record.fields, ALERT_FIELDS.viewed),
  };
}

export function createAirtableRepository(): DataRepository {
  const config = getAirtableConfig();
  if (!config) {
    throw new AppError("MISSING_CREDENTIALS", { source: "Airtable" });
  }

  return {
    mode: "airtable",

    async listRules() {
      const records = await listRecords(config.tables.rules, {
        maxRecords: MAX_RULES,
        sortField: RULE_FIELDS.createdAt,
      });
      return records
        .map(toAlertRule)
        .filter((rule): rule is AlertRule => rule !== null);
    },

    async getRule(id) {
      const record = await getRecord(config.tables.rules, id);
      return record ? toAlertRule(record) : null;
    },

    async createRule(data: CreateRuleData) {
      const existing = await listRecords(config.tables.rules, { maxRecords: MAX_RULES });
      if (existing.length >= MAX_RULES) {
        throw new AppError("LIMIT_EXCEEDED", {
          message: `O limite de ${MAX_RULES} regras foi atingido. Exclua uma regra antes de criar outra.`,
        });
      }

      const createdAt = new Date().toISOString();
      const [record] = await createRecords(config.tables.rules, [
        {
          fields: {
            [RULE_FIELDS.identifier]: randomUUID(),
            [RULE_FIELDS.assetId]: data.assetId,
            [RULE_FIELDS.condition]: data.condition,
            [RULE_FIELDS.referenceValue]: data.referenceValue,
            [RULE_FIELDS.active]: true,
            [RULE_FIELDS.createdAt]: createdAt,
          },
        },
      ]);

      const rule = record ? toAlertRule(record) : null;
      if (!rule) {
        throw new AppError("PERSISTENCE_FAILURE", { source: "Airtable" });
      }
      return rule;
    },

    async updateRule(id, data: UpdateRuleData) {
      const fields: Record<string, unknown> = {};
      if (data.assetId !== undefined) fields[RULE_FIELDS.assetId] = data.assetId;
      if (data.condition !== undefined) fields[RULE_FIELDS.condition] = data.condition;
      if (data.active !== undefined) fields[RULE_FIELDS.active] = data.active;
      if (data.referenceValue !== undefined) {
        fields[RULE_FIELDS.referenceValue] = data.referenceValue;
      }

      const record = await updateRecord(config.tables.rules, id, fields);
      const rule = toAlertRule(record);
      if (!rule) {
        throw new AppError("PERSISTENCE_FAILURE", { source: "Airtable" });
      }
      return rule;
    },

    async deleteRule(id) {
      await deleteRecord(config.tables.rules, id);
    },

    async listAlerts(limit) {
      const records = await listRecords(config.tables.alerts, {
        maxRecords: limit,
        sortField: ALERT_FIELDS.createdAt,
      });
      return records
        .map(toGeneratedAlert)
        .filter((alert): alert is GeneratedAlert => alert !== null);
    },

    async createAlerts(alerts) {
      if (alerts.length === 0) return [];

      const records = await createRecords(
        config.tables.alerts,
        alerts.map((alert) => ({
          fields: {
            [ALERT_FIELDS.identifier]: randomUUID(),
            [ALERT_FIELDS.ruleId]: alert.ruleId,
            [ALERT_FIELDS.assetId]: alert.assetId,
            [ALERT_FIELDS.observedValue]: alert.observedValue,
            [ALERT_FIELDS.referenceValue]: alert.referenceValue,
            [ALERT_FIELDS.message]: alert.message,
            [ALERT_FIELDS.source]: alert.source,
            [ALERT_FIELDS.createdAt]: alert.createdAt,
            [ALERT_FIELDS.viewed]: alert.viewed,
          },
        })),
      );

      return records
        .map(toGeneratedAlert)
        .filter((alert): alert is GeneratedAlert => alert !== null);
    },
  };
}
