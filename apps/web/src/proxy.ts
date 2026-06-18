import { NextResponse, type NextRequest } from "next/server";
import { resolveStoreFromHost } from "./lib/host-routing";

const PUBLIC_FILE = /\.(.*)$/;
const SELLER_APP_PATHS = ["/dashboard", "/login", "/register"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (shouldSkipProxy(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/s/")) {
    const [, , slug, ...segments] = pathname.split("/");

    if (!slug) {
      return NextResponse.next();
    }

    const url = request.nextUrl.clone();
    url.pathname = `/storefront/${slug}${segments.length ? `/${segments.join("/")}` : ""}`;

    return NextResponse.rewrite(url);
  }

  const hostRoute = resolveStoreFromHost(request.headers.get("host") ?? request.nextUrl.hostname);

  if (hostRoute.type !== "storefront") {
    return NextResponse.next();
  }

  if (SELLER_APP_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/storefront/${hostRoute.slug}${pathname === "/" ? "" : pathname}`;

  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico).*)"]
};

function shouldSkipProxy(pathname: string) {
  return (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    PUBLIC_FILE.test(pathname)
  );
}
