/**
 * Contrato unico de persistencia.
 *
 * As regras de negocio (`lib/alert-rules.ts`) e os Route Handlers dependem
 * apenas desta interface. Trocar memoria por Airtable e uma decisao de
 * configuracao, nao uma mudanca de codigo de dominio.
 */

import type { AlertRule, GeneratedAlert, PersistenceMode } from "../../types/index.ts";

export interface CreateRuleData {
  assetId: string;
  condition: AlertRule["condition"];
  referenceValue: number;
}

export interface UpdateRuleData {
  assetId?: string;
  condition?: AlertRule["condition"];
  active?: boolean;
  referenceValue?: number;
}

export interface DataRepository {
  /** Modo efetivo, exposto na interface para o usuario saber onde o dado esta. */
  readonly mode: PersistenceMode;

  listRules(): Promise<AlertRule[]>;
  getRule(id: string): Promise<AlertRule | null>;
  createRule(data: CreateRuleData): Promise<AlertRule>;
  updateRule(id: string, data: UpdateRuleData): Promise<AlertRule>;
  deleteRule(id: string): Promise<void>;

  listAlerts(limit: number): Promise<GeneratedAlert[]>;
  createAlerts(alerts: Array<Omit<GeneratedAlert, "id">>): Promise<GeneratedAlert[]>;
}
