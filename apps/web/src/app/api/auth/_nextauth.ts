import * as NextAuthModule from "next-auth/next";
import type { NextRequest } from "next/server";
import { authOptions } from "../../../lib/auth";

const NextAuth = resolveNextAuthExport(NextAuthModule);

export function authRoute(request: NextRequest, nextauth: string[]) {
  return NextAuth(
    request,
    {
      params: {
        nextauth
      }
    },
    authOptions
  );
}

function resolveNextAuthExport(module: typeof NextAuthModule) {
  const defaultExport = module.default as unknown;

  if (typeof defaultExport === "function") {
    return defaultExport;
  }

  if (defaultExport && typeof defaultExport === "object" && "default" in defaultExport) {
    const nestedDefault = (defaultExport as { default: unknown }).default;

    if (typeof nestedDefault === "function") {
      return nestedDefault;
    }
  }

  throw new TypeError("Unable to resolve NextAuth handler export.");
}
