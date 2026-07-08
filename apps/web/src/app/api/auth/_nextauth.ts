import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { authOptions } from "../../../lib/auth";

const nextAuthHandler = NextAuth(authOptions);

export function authRoute(request: NextRequest, nextauth: string[]) {
  return nextAuthHandler(
    request,
    {
      params: {
        nextauth
      }
    }
  );
}
