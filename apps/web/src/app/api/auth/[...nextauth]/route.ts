import type { NextRequest } from "next/server";
import { authRoute } from "../_nextauth";

type AuthRouteContext = {
  params: Promise<{
    nextauth: string[];
  }> | {
    nextauth: string[];
  };
};

export async function GET(request: NextRequest, context: AuthRouteContext) {
  const { nextauth } = await context.params;

  return authRoute(request, nextauth);
}

export async function POST(request: NextRequest, context: AuthRouteContext) {
  const { nextauth } = await context.params;

  return authRoute(request, nextauth);
}
