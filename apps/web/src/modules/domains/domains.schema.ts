import { z } from "zod";
import { isPlatformHostname } from "../../lib/host-routing";
import type { DnsInstruction } from "./domain-verification";

/**
 * A store gets one `<slug>.storeim.com` row for free; this caps the *custom* rows.
 * Each verified hostname becomes a certificate Caddy has to issue and renew, so
 * the ceiling is a real resource limit, not just tidiness.
 */
export const MAX_CUSTOM_DOMAINS_PER_STORE = 5;

const hostnameLabelPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const tldPattern = /^[a-z]{2,}$/;
const schemePattern = /^[a-z][a-z0-9+.-]*:\/\//;

/**
 * Sellers paste whatever their registrar showed them — `https://Worzen.com/`,
 * `worzen.com:443`, a trailing dot from a DNS export. Normalise to the bare
 * hostname we can compare against the `Host` header, then validate that.
 */
export function normalizeDomainInput(raw: string) {
  let value = raw.trim().toLowerCase().replace(schemePattern, "");
  const pathStart = value.search(/[/?#]/);

  if (pathStart >= 0) {
    value = value.slice(0, pathStart);
  }

  return (value.split(":")[0] ?? "").replace(/\.+$/, "");
}

/**
 * Returns a seller-facing reason the hostname is unusable, or `null` when it is
 * fine. Split out from the Zod schema so the DNS-verification pass in a later
 * phase can re-check a stored row without rebuilding form input.
 */
export function validateDomainHostname(hostname: string): string | null {
  if (!hostname) {
    return "Enter a domain, for example worzen.com.";
  }

  if (hostname.length > 253) {
    return "That domain is longer than a hostname is allowed to be.";
  }

  if (!/^[\x20-\x7e]+$/.test(hostname)) {
    return "Enter the punycode form (starting with xn--) for a non-English domain.";
  }

  const labels = hostname.split(".");

  if (labels.length < 2) {
    return "Include the domain extension, for example worzen.com.";
  }

  for (const label of labels) {
    if (!label) {
      return "That domain has an empty part — check for a double dot.";
    }

    if (label.length > 63) {
      return `"${label}" is too long for one part of a domain name.`;
    }

    if (!hostnameLabelPattern.test(label)) {
      return `"${label}" is not a valid part of a domain name.`;
    }
  }

  // Also rejects bare IP addresses: the last label of an IPv4 is numeric.
  if (!tldPattern.test(labels[labels.length - 1] ?? "")) {
    return "That does not end in a valid domain extension.";
  }

  if (isPlatformHostname(hostname)) {
    return "That hostname belongs to the platform. Use a domain you own.";
  }

  return null;
}

/**
 * The apex/www sibling of a hostname, or `null` when there isn't an obvious one.
 *
 * Visitors type both `worzen.com` and `www.worzen.com`, and under on-demand TLS
 * each is a separate certificate — so each needs its own verified row rather
 * than being aliased at request time. Only unambiguous pairs are derived: a
 * `www.` host yields its parent, and a two-label apex yields its `www.` form.
 * `shop.worzen.com` or `worzen.co.uk` get no sibling, since telling a subdomain
 * from a multi-part public suffix needs a suffix list we do not ship. Sellers can
 * always add the sibling by hand.
 */
export function getDomainSibling(hostname: string): string | null {
  const labels = hostname.split(".");

  if (labels[0] === "www") {
    return labels.length >= 3 ? labels.slice(1).join(".") : null;
  }

  return labels.length === 2 ? `www.${hostname}` : null;
}

const hostnameSchema = z
  .string()
  .max(300, "That domain is longer than a hostname is allowed to be.")
  .transform(normalizeDomainInput)
  .superRefine((value, ctx) => {
    const problem = validateDomainHostname(value);

    if (problem) {
      ctx.addIssue({ code: "custom", message: problem });
    }
  });

export const addCustomDomainSchema = z.object({
  /** Opt out of the auto-added apex/www sibling. */
  addSibling: z.boolean().default(true),
  domain: hostnameSchema
});

export const storeDomainRefSchema = z.object({
  domainId: z.string().trim().min(1, "Select a domain.")
});

export type AddCustomDomainFormInput = z.input<typeof addCustomDomainSchema>;
export type AddCustomDomainInput = z.infer<typeof addCustomDomainSchema>;
export type StoreDomainRefInput = z.infer<typeof storeDomainRefSchema>;

/** What the settings page renders per row. */
export type StoreDomainView = {
  canSetPrimary: boolean;
  createdAt: Date;
  dnsInstructions: DomainDnsInstruction[];
  domain: string;
  id: string;
  isPlatformDomain: boolean;
  isPrimary: boolean;
  isVerified: boolean;
  /** Last DNS check, `null` until the seller has verified once. */
  lastCheckDetail: string | null;
  lastCheckStatus: string | null;
  lastCheckedAt: Date | null;
  verifiedAt: Date | null;
};

/**
 * Re-exported so the settings components can stay on this module's types without
 * importing `domain-verification.ts`, which pulls in `node:dns`.
 */
export type DomainDnsInstruction = DnsInstruction;

export type StoreDomainsView = {
  canAddCustomDomain: boolean;
  customDomainCount: number;
  domains: StoreDomainView[];
  maxCustomDomains: number;
  planAllowsCustomDomain: boolean;
  platformDomain: string | null;
  /** False when the server has no PLATFORM_DOMAIN_* target to hand out. */
  platformDnsConfigured: boolean;
};
