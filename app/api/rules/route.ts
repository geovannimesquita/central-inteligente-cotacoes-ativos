/**
 * GET  /api/rules -> lista as regras armazenadas
 * POST /api/rules -> cadastra uma regra
 *
 * A validacao completa (ativo permitido, condicao suportada, valor finito,
 * positivo quando aplicavel, tamanho de campo e limite de quantidade) acontece
 * no backend, em `lib/validation.ts` e no repositorio.
 */

import { handleRoute, jsonOk } from "@/lib/api-response";
import { getRepository } from "@/lib/repositories";
import { parseCreateRuleInput, readJsonBody } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return handleRoute(async () => {
    const repository = getRepository();
    const rules = await repository.listRules();
    return jsonOk({ data: rules, meta: { persistence: repository.mode } });
  });
}

export async function POST(request: Request): Promise<Response> {
  return handleRoute(async () => {
    const body = await readJsonBody(request);
    const input = parseCreateRuleInput(body);

    const repository = getRepository();
    const rule = await repository.createRule(input);

    return jsonOk({ data: rule, meta: { persistence: repository.mode } }, { status: 201 });
  });
}
