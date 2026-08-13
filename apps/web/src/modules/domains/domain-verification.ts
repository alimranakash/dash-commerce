import { Resolver } from "node:dns/promises";
import "../../lib/env";

/**
 * Real DNS checking for custom domains.
 *
 * We are self-hosted behind Caddy with on-demand TLS, so "pointed at us" means
 * the hostname resolves to this server's address. That is deliberately what we
 * check rather than trusting a token record: Caddy will only ask for a
 * certificate for a hostname we have marked verified, and a certificate is only
 * obtainable for a hostname that actually resolves here — so the check and the
 * cert issuance test the same fact.
 *
 * Targets come from the environment, never hardcoded, because the server address
 * differs per deployment:
 *
 *   PLATFORM_DOMAIN_IPV4   A-record target, e.g. 203.0.113.10 (comma-separated for several)
 *   PLATFORM_DOMAIN_IPV6   optional AAAA target
 *   PLATFORM_DOMAIN_CNAME  optional CNAME target for www/subdomains, e.g. stores.dash.com
 */

const LOOKUP_TIMEOUT_MS = 4000;

export type DomainCheckStatus =
  | "lookup-failed"
  | "misconfigured"
  | "not-pointed"
  | "platform-not-configured"
  | "verified";

export type DomainCheckResult = {
  detail: string;
  found: string[];
  status: DomainCheckStatus;
};

export type DnsInstruction = {
  name: string;
  note: string;
  type: "A" | "AAAA" | "CNAME";
  value: string;
};

export type PlatformDnsTargets = {
  cname: string | null;
  ipv4: string[];
  ipv6: string[];
};

export function getPlatformDnsTargets(): PlatformDnsTargets {
  return {
    cname: readEnvHost("PLATFORM_DOMAIN_CNAME"),
    ipv4: readEnvList("PLATFORM_DOMAIN_IPV4"),
    ipv6: readEnvList("PLATFORM_DOMAIN_IPV6")
  };
}

export function isPlatformDnsConfigured() {
  const targets = getPlatformDnsTargets();

  return targets.ipv4.length > 0 || targets.ipv6.length > 0 || targets.cname !== null;
}

/**
 * The records a seller has to create, for the copy-paste instructions.
 *
 * An apex domain cannot hold a CNAME, so it always gets A/AAAA records. A
 * subdomain gets the CNAME when one is configured — that way the platform can
 * change its IP without every seller having to edit DNS — and falls back to the
 * same A records otherwise.
 */
export function buildDnsInstructions(hostname: string): DnsInstruction[] {
  const targets = getPlatformDnsTargets();
  const labels = hostname.split(".");
  const isApex = labels.length === 2;
  // Registrars ask for the record name relative to the zone, so everything left
  // of the registrable domain: `www.shop.worzen.com` is entered as `www.shop`.
  // Assumes a two-label registrable domain, the same limitation `getDomainSibling`
  // documents — a multi-part suffix like `co.uk` would need a public suffix list.
  const recordName = labels.slice(0, -2).join(".") || "@";

  if (!isApex && targets.cname) {
    return [
      {
        name: recordName,
        note: `Points ${hostname} at the platform.`,
        type: "CNAME",
        value: targets.cname
      }
    ];
  }

  const instructions: DnsInstruction[] = targets.ipv4.map((address) => ({
    name: recordName,
    note: isApex
      ? "Root domains cannot use a CNAME, so this is an A record."
      : `Points ${hostname} at the platform.`,
    type: "A" as const,
    value: address
  }));

  for (const address of targets.ipv6) {
    instructions.push({
      name: recordName,
      note: "Optional, for visitors on IPv6-only networks.",
      type: "AAAA",
      value: address
    });
  }

  // Apex with only a CNAME target configured: a root domain cannot hold a plain
  // CNAME, so the seller needs their registrar's ALIAS/ANAME flavour. Better to
  // say that than to show an empty instruction table.
  if (instructions.length === 0 && targets.cname) {
    return [
      {
        name: recordName,
        note: "A root domain cannot use a plain CNAME — use your registrar's ALIAS or ANAME record type.",
        type: "CNAME",
        value: targets.cname
      }
    ];
  }

  return instructions;
}

/**
 * Resolves the hostname and compares it with where it should point.
 *
 * `resolve4`/`resolve6` follow a CNAME chain, so a correctly CNAMEd subdomain
 * lands on our addresses and passes without a special case. When only a CNAME
 * target is configured, its own addresses are resolved and used as the expected
 * set, so a deployment that never publishes its IP still verifies.
 */
export async function checkDomainDns(hostname: string): Promise<DomainCheckResult> {
  const targets = getPlatformDnsTargets();

  if (!isPlatformDnsConfigured()) {
    return {
      detail:
        "This server does not know its own public address yet. Set PLATFORM_DOMAIN_IPV4 (or PLATFORM_DOMAIN_CNAME) in the root .env, then verify again.",
      found: [],
      status: "platform-not-configured"
    };
  }

  const resolver = new Resolver({ timeout: LOOKUP_TIMEOUT_MS, tries: 2 });
  const expected = new Set([...targets.ipv4, ...targets.ipv6]);

  if (targets.cname) {
    const platformAddresses = await resolveAddresses(resolver, targets.cname);

    for (const address of platformAddresses.addresses) {
      expected.add(address);
    }
  }

  if (expected.size === 0) {
    return {
      detail: `Could not resolve the platform's own target (${targets.cname ?? "unknown"}). Check PLATFORM_DOMAIN_CNAME.`,
      found: [],
      status: "platform-not-configured"
    };
  }

  const cnameChain = await resolveCname(resolver, hostname);

  if (targets.cname && cnameChain.some((name) => name === targets.cname)) {
    return {
      detail: `${hostname} is a CNAME for ${targets.cname}.`,
      found: cnameChain,
      status: "verified"
    };
  }

  const { addresses: found, error } = await resolveAddresses(resolver, hostname);

  if (error) {
    const code = dnsErrorCode(error);

    if (code === "ENOTFOUND" || code === "ENODATA" || code === "NXDOMAIN") {
      return {
        detail: `${hostname} has no DNS records yet. Add the records below — new records can take a few minutes to spread.`,
        found: [],
        status: "not-pointed"
      };
    }

    return {
      detail: `The DNS lookup for ${hostname} failed (${code ?? "unknown error"}). This is usually temporary — try again in a moment.`,
      found: [],
      status: "lookup-failed"
    };
  }

  if (found.length === 0) {
    return {
      detail: `${hostname} has no DNS records yet. Add the records below — new records can take a few minutes to spread.`,
      found: [],
      status: "not-pointed"
    };
  }

  const matches = found.filter((address) => expected.has(address));

  if (matches.length > 0) {
    return {
      detail: `${hostname} points to ${matches.join(", ")}.`,
      found,
      status: "verified"
    };
  }

  return {
    detail: `${hostname} points to ${found.join(", ")}, which is not this platform. Expected ${[...expected].join(", ")}.`,
    found,
    status: "misconfigured"
  };
}

/**
 * Both address families at once. A domain having only A records is normal, so a
 * single failure is not an error — only a failure of *both* is, and that error is
 * handed back so the caller can tell "no such domain" from "wrong target".
 */
async function resolveAddresses(resolver: Resolver, hostname: string) {
  const [ipv4, ipv6] = await Promise.allSettled([
    resolver.resolve4(hostname),
    resolver.resolve6(hostname)
  ]);
  const addresses = [
    ...(ipv4.status === "fulfilled" ? ipv4.value : []),
    ...(ipv6.status === "fulfilled" ? ipv6.value : [])
  ].map(normalizeDnsName);

  return {
    addresses,
    error: ipv4.status === "rejected" && ipv6.status === "rejected" ? ipv4.reason : null
  };
}

async function resolveCname(resolver: Resolver, hostname: string) {
  return resolver
    .resolveCname(hostname)
    .then((names) => names.map(normalizeDnsName))
    .catch(() => [] as string[]);
}

function dnsErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : null;
}

function normalizeDnsName(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

function readEnvList(key: string) {
  return (process.env[key] ?? "")
    .split(",")
    .map(normalizeDnsName)
    .filter((value) => value.length > 0);
}

function readEnvHost(key: string) {
  const value = normalizeDnsName(process.env[key] ?? "");

  return value.length > 0 ? value : null;
}
