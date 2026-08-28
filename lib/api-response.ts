/**
 * Utilitarios de resposta dos Route Handlers.
 *
 * Centraliza a conversao de `AppError` em resposta HTTP para garantir que
 * nenhuma rota vaze stack trace, `cause` ou detalhe de credencial.
 */

import { NextResponse } from "next/server";
import { AppError, describeForLog, toAppError } from "./errors.ts";

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, {
    ...init,
    headers: {
      // Respostas de API nunca devem ser cacheadas por intermediarios: o cache
      // da aplicacao e o de `lib/cache.ts`, com TTL controlado no servidor.
      "Cache-Control": "no-store",
      ...(init?.headers ?? {}),
    },
  });
}

export function jsonError(error: unknown): NextResponse {
  const appError = toAppError(error);

  // Log de servidor enxuto. Erros inesperados registram o `cause` porque nao ha
  // como diagnosticar sem ele; o cliente continua recebendo apenas a mensagem.
  if (appError.code === "INTERNAL") {
    console.error(`[api] ${describeForLog(appError)}`, appError.cause ?? "");
  } else {
    console.warn(`[api] ${describeForLog(appError)}`);
  }

  const status = appError.status === 206 ? 200 : appError.status;
  return NextResponse.json(appError.toPublicJSON(), {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/** Envolve um handler capturando qualquer falha e devolvendo resposta segura. */
export async function handleRoute(
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error) {
    return jsonError(error);
  }
}

export { AppError };
