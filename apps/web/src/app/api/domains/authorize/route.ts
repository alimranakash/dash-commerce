import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isPlatformFixedHostname, normalizeHostname } from "../../../../lib/host-routing";
import { resolveCustomDomainRoute } from "../../../../modules/domains/domain-routing";
import { findServablePlatformDomain } from "../../../../modules/domains/domains.repository";

/**
 * Certificate authorisation for Caddy's on-demand TLS (`ask`).
 *
 * Caddy calls this during a TLS handshake for a hostname it has no certificate
 * for, with `?domain=<sni>`. A 2xx means "go get a certificate"; anything else
 * means "drop the handshake". Without it, anyone could point DNS at this server —
 * or simply send an invented SNI — and make us open an ACME order per name, which
 * is how a platform burns its Let's Encrypt rate limits.
 *
 * Three things may have a certificate, and nothing else:
 *   1. the platform's fixed hostnames (root, www, app)
 *   2. a tenant subdomain that exists in the database
 *   3. a CUSTOM domain that is verified, on a live store — the same query request
 *      routing uses, so a name can never get a certificate it cannot be served on
 *
 * Fails closed everywhere: a bad token, an unknown name, or a database outage all
 * return non-2xx, which means no issuance rather than uncontrolled issuance.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const expectedToken = process.env.DOMAIN_AUTHORIZE_TOKEN?.trim();

  // Optional but recommended: this route is reachable on every hostname the app
  // serves, and a token keeps the outside world from probing which domains exist.
  if (expectedToken && !matchesToken(request.nextUrl.searchParams.get("token"), expectedToken)) {
    return deny(403, "forbidden");
  }

  const domain = normalizeHostname(request.nextUrl.searchParams.get("domain") ?? "");

  if (!domain) {
    return deny(400, "missing domain");
  }

  try {
    if (isPlatformFixedHostname(domain)) {
      return allow(domain);
    }

    if (await resolveCustomDomainRoute(domain)) {
      return allow(domain);
    }

    if (await findServablePlatformDomain(domain)) {
      return allow(domain);
    }

    return deny(403, "domain not authorized");
  } catch {
    // Never let an infrastructure failure become permission to issue.
    return deny(503, "authorization unavailable");
  }
}

function allow(domain: string) {
  return new NextResponse(`ok ${domain}`, {
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8"
    },
    status: 200
  });
}

function deny(status: number, message: string) {
  return new NextResponse(message, {
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8"
    },
    status
  });
}

function matchesToken(provided: string | null, expected: string) {
  if (!provided) {
    return false;
  }

  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);

  return (
    providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes)
  );
}
