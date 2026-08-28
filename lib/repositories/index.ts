/**
 * Seletor de repositorio.
 *
 * Airtable configurado -> repositorio Airtable.
 * Airtable ausente      -> repositorio em memoria, com o modo explicitamente
 *                          reportado para que a interface avise o usuario.
 *
 * A escolha e avaliada a cada chamada porque as variaveis de ambiente podem
 * mudar entre reinicios do servidor de desenvolvimento.
 */

import { isAirtableConfigured } from "../config.ts";
import { describeForLog } from "../errors.ts";
import type { PersistenceMode } from "../../types/index.ts";
import { createAirtableRepository } from "./airtable.ts";
import { createMemoryRepository } from "./memory.ts";
import type { DataRepository } from "./types.ts";

export type { DataRepository } from "./types.ts";

export function getRepository(): DataRepository {
  if (isAirtableConfigured()) {
    try {
      return createAirtableRepository();
    } catch (error) {
      // Configuracao presente porem invalida: nao ficamos sem aplicacao, mas o
      // modo de memoria fica visivel na interface (nunca finge persistencia).
      console.warn(`[repository] Airtable indisponivel -> ${describeForLog(error)}`);
      return createMemoryRepository();
    }
  }
  return createMemoryRepository();
}

export function getPersistenceMode(): PersistenceMode {
  return isAirtableConfigured() ? "airtable" : "memory";
}
