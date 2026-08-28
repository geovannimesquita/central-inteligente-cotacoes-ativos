/**
 * GET /api/alerts?limit=50 -> lista os alertas mais recentes
 */

import { handleRoute, jsonOk } from "@/lib/api-response";
import { MAX_ALERTS_PAGE_SIZE } from "@/lib/config";
import { getRepository } from "@/lib/repositories";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 25;

function parseLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_ALERTS_PAGE_SIZE);
}

export async function GET(request: Request): Promise<Response> {
  return handleRoute(async () => {
    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams.get("limit"));

    const repository = getRepository();
    const alerts = await repository.listAlerts(limit);

    return jsonOk({ data: alerts, meta: { persistence: repository.mode, limit } });
  });
}
