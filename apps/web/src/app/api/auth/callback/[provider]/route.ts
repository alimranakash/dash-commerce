import type { NextRequest } from "next/server";
import { authRoute } from "../../_nextauth";

type ProviderRouteContext = {
  params: Promise<{
    provider: string;
  }> | {
    provider: string;
  };
};

export async function GET(request: NextRequest, context: ProviderRouteContext) {
  const { provider } = await context.params;

  return authRoute(request, ["callback", provider]);
}

export async function POST(request: NextRequest, context: ProviderRouteContext) {
  const { provider } = await context.params;

  return authRoute(request, ["callback", provider]);
}
