/**
 * PATCH  /api/rules/[id] -> ativa/desativa a regra ou altera o valor de referencia
 * DELETE /api/rules/[id] -> exclui a regra
 */

import { handleRoute, jsonOk, AppError } from "@/lib/api-response";
import { getRepository } from "@/lib/repositories";
import { parseRecordId, parseUpdateRuleInput, readJsonBody } from "@/lib/validation";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  return handleRoute(async () => {
    const { id: rawId } = await context.params;
    const id = parseRecordId(rawId);

    const repository = getRepository();
    const existing = await repository.getRule(id);
    if (!existing) {
      throw new AppError("NOT_FOUND", { message: "Regra nao encontrada." });
    }

    const body = await readJsonBody(request);
    // A regra atual e passada inteira porque a validacao do valor depende da
    // condicao efetiva apos a atualizacao (preco exige positivo; variacao aceita
    // negativo), e a condicao pode estar sendo trocada nesta mesma requisicao.
    const input = parseUpdateRuleInput(body, existing);

    const rule = await repository.updateRule(id, input);
    return jsonOk({ data: rule, meta: { persistence: repository.mode } });
  });
}

export async function DELETE(_request: Request, context: RouteContext): Promise<Response> {
  return handleRoute(async () => {
    const { id: rawId } = await context.params;
    const id = parseRecordId(rawId);

    const repository = getRepository();
    const existing = await repository.getRule(id);
    if (!existing) {
      throw new AppError("NOT_FOUND", { message: "Regra nao encontrada." });
    }

    await repository.deleteRule(id);
    return jsonOk({ data: { id }, meta: { persistence: repository.mode } });
  });
}
