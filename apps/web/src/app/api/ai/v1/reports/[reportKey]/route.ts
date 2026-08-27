import type { NextRequest } from "next/server";
import { getAiReport } from "../../../../../../modules/ai/ai-analytics.service";
import { hasAiScope } from "../../../../../../modules/ai/ai-auth";
import {
  AiApiRouteError,
  parseAiQuery,
  withAiApiRoute
} from "../../../../../../modules/ai/ai-route";
import {
  AI_REPORT_EXTRA_SCOPES,
  AI_REPORT_KEYS,
  aiReportKeySchema,
  aiReportQuerySchema
} from "../../../../../../modules/ai/ai.schema";

/**
 * `GET /api/ai/v1/reports/[reportKey]` — one of the dashboard's reports.
 *
 * `reportKey` is a closed enum, one entry per function `report.service.ts`
 * already exposes. An unknown key is a 404 that lists the real ones: this is a
 * transport for eight named reports, not a query language, and there is no path
 * by which the caller's string becomes anything but a lookup in a fixed table.
 *
 * Query: `range` — `30d` (default), `90d`, or `12m`, the same window the
 * dashboard offers.
 *
 * ## Why some reports need a second scope
 *
 * `read:analytics` covers charts and totals. Three of these reports also name
 * individual customers — `overview` and `customers` list top customers,
 * `orders` lists recent orders by customer name — and a revenue chart and a list
 * of a store's best customers are not the same disclosure. Those additionally
 * require `read:customers`, so a key granted only analytics access cannot reach
 * customer names by asking for a different report key.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ reportKey: string }> }
) {
  return withAiApiRoute(request, { scope: "read:analytics" }, async (identity, httpRequest) => {
    // Resolved inside the handler so authentication runs first: an unauthorised
    // caller learns nothing about which report keys exist.
    const { reportKey } = await context.params;
    const parsedKey = aiReportKeySchema.safeParse(reportKey);

    if (!parsedKey.success) {
      throw new AiApiRouteError(
        404,
        "unknown_report",
        `Unknown report. Available reports: ${AI_REPORT_KEYS.join(", ")}.`
      );
    }

    const extraScope = AI_REPORT_EXTRA_SCOPES[parsedKey.data];

    if (extraScope && !hasAiScope(identity, extraScope)) {
      throw new AiApiRouteError(
        403,
        "insufficient_scope",
        `The ${parsedKey.data} report names individual customers and additionally requires the ${extraScope} scope.`
      );
    }

    const { range } = parseAiQuery(httpRequest, aiReportQuerySchema);

    return getAiReport(identity.storeId, parsedKey.data, range);
  });
}
