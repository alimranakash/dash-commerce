import type { NextRequest } from "next/server";
import { authRoute } from "../_nextauth";

export function GET(request: NextRequest) {
  return authRoute(request, ["providers"]);
}

export function POST(request: NextRequest) {
  return authRoute(request, ["providers"]);
}
