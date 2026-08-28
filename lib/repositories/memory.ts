/**
 * Repositorio temporario em memoria (modo desenvolvimento sem Airtable).
 *
 * Este repositorio existe para que a aplicacao seja demonstravel antes de haver
 * credenciais. Ele NAO finge persistencia: o modo e `memory`, a interface avisa
 * o usuario e todo o conteudo desaparece ao reiniciar o servidor.
 *
 * Nao ha fallback silencioso para `localStorage` no cliente — o dado vive no
 * processo do servidor, exatamente como viveria no Airtable.
 */

import { randomUUID } from "node:crypto";
import { MAX_RULES } from "../config.ts";
import { AppError } from "../errors.ts";
import type { AlertRule, GeneratedAlert } from "../../types/index.ts";
import type { CreateRuleData, DataRepository, UpdateRuleData } from "./types.ts";

interface MemoryStore {
  rules: AlertRule[];
  alerts: GeneratedAlert[];
}

// Guardado em `globalThis` porque o hot reload do Next recria modulos.
const STORE_KEY = Symbol.for("cica.memory-store");
type GlobalWithStore = typeof globalThis & { [STORE_KEY]?: MemoryStore };

function getStore(): MemoryStore {
  const globalRef = globalThis as GlobalWithStore;
  if (!globalRef[STORE_KEY]) {
    globalRef[STORE_KEY] = { rules: [], alerts: [] };
  }
  return globalRef[STORE_KEY];
}

/** Limpa o repositorio. Usado por testes. */
export function resetMemoryStore(): void {
  const store = getStore();
  store.rules = [];
  store.alerts = [];
}

export function createMemoryRepository(): DataRepository {
  return {
    mode: "memory",

    async listRules() {
      return [...getStore().rules].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async getRule(id) {
      return getStore().rules.find((rule) => rule.id === id) ?? null;
    },

    async createRule(data: CreateRuleData) {
      const store = getStore();
      if (store.rules.length >= MAX_RULES) {
        throw new AppError("LIMIT_EXCEEDED", {
          message: `O limite de ${MAX_RULES} regras foi atingido. Exclua uma regra antes de criar outra.`,
        });
      }

      const rule: AlertRule = {
        id: randomUUID(),
        assetId: data.assetId,
        condition: data.condition,
        referenceValue: data.referenceValue,
        active: true,
        createdAt: new Date().toISOString(),
      };
      store.rules.push(rule);
      return rule;
    },

    async updateRule(id, data: UpdateRuleData) {
      const store = getStore();
      const index = store.rules.findIndex((rule) => rule.id === id);
      const current = store.rules[index];
      if (index === -1 || !current) {
        throw new AppError("NOT_FOUND", { message: "Regra nao encontrada." });
      }

      const updated: AlertRule = {
        ...current,
        ...(data.assetId !== undefined ? { assetId: data.assetId } : {}),
        ...(data.condition !== undefined ? { condition: data.condition } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
        ...(data.referenceValue !== undefined ? { referenceValue: data.referenceValue } : {}),
      };
      store.rules[index] = updated;
      return updated;
    },

    async deleteRule(id) {
      const store = getStore();
      const index = store.rules.findIndex((rule) => rule.id === id);
      if (index === -1) {
        throw new AppError("NOT_FOUND", { message: "Regra nao encontrada." });
      }
      store.rules.splice(index, 1);
      // Alertas orfaos nao tem valor informativo depois que a regra some.
      store.alerts = store.alerts.filter((alert) => alert.ruleId !== id);
    },

    async listAlerts(limit) {
      return [...getStore().alerts]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    },

    async createAlerts(alerts) {
      const store = getStore();
      const created = alerts.map((alert) => ({ ...alert, id: randomUUID() }));
      store.alerts.push(...created);
      // Mantem o repositorio de demonstracao limitado para nao crescer sem fim.
      if (store.alerts.length > 500) {
        store.alerts = store.alerts.slice(-500);
      }
      return created;
    },
  };
}
