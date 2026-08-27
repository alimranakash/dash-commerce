import type { NextRequest } from "next/server";
import { getAiMetrics } from "../../../../../modules/ai/ai-analytics.service";
import { withAiApiRoute } from "../../../../../modules/ai/ai-route";

/**
 * `GET /api/ai/v1/metrics` — the dashboard's own summary.
 *
 * Order and product counts, today's and this month's revenue, the recent orders
 * strip, best sellers, and what is running low. Every number is computed by
 * `analytics.service.ts`, which is what the seller's home page reads, so the AI
 * and the dashboard cannot disagree about the same day's takings.
 *
 * No parameters: the underlying service takes none. A date range on these
 * figures would mean new arithmetic, and the place to ask for a windowed number
 * is `/api/ai/v1/reports/*`, which already has one.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return withAiApiRoute(request, { scope: "read:analytics" }, async (identity) =>
    getAiMetrics(identity.storeId)
  );
}
