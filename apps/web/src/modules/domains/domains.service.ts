import { createSystemLog } from "../../lib/system-log";
import { canUseCustomDomain } from "../billing/subscription-limits";
import { invalidateCustomDomainRoute } from "./domain-routing";
import {
  buildDnsInstructions,
  checkDomainDns,
  isPlatformDnsConfigured,
  type DomainCheckResult
} from "./domain-verification";
import {
  countCustomDomains,
  createCustomDomains,
  deleteStoreDomain,
  findDomainOwner,
  findPlatformStoreDomain,
  findStoreDomainById,
  listStoreDomains,
  recordStoreDomainCheck,
  setPrimaryStoreDomain,
  setStoreDomainVerification,
  type StoreDomainRecord
} from "./domains.repository";
import {
  MAX_CUSTOM_DOMAINS_PER_STORE,
  addCustomDomainSchema,
  getDomainSibling,
  storeDomainRefSchema,
  validateDomainHostname,
  type AddCustomDomainFormInput,
  type StoreDomainView,
  type StoreDomainsView
} from "./domains.schema";

export class DomainError extends Error {
  fieldErrors: Record<string, string>;

  constructor(message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "DomainError";
    this.fieldErrors = fieldErrors;
  }
}

type StoreScope = {
  /** Platform admins manage a store regardless of the store's own plan. */
  bypassPlanGate?: boolean | undefined;
  organizationId?: string | undefined;
  storeId: string;
  userId?: string | undefined;
};

/**
 * Custom domains are a paid feature (`Plan.customDomainEnabled`), and the
 * default Starter plan does not include them. The gate is checked in the service
 * rather than the action so that every write path — and any later API or job —
 * goes through it.
 */
async function assertPlanAllowsCustomDomain(scope: StoreScope) {
  if (scope.bypassPlanGate) {
    return;
  }

  if (!(await canUseCustomDomain(scope.storeId))) {
    throw new DomainError(
      "Custom domains are part of the Growth plan and above. Upgrade from Billing to connect your own domain.",
      { domain: "Your current plan does not include custom domains." }
    );
  }
}

export async function getStoreDomainsView(scope: StoreScope): Promise<StoreDomainsView> {
  const [domains, planAllowsCustomDomain] = await Promise.all([
    listStoreDomains(scope.storeId),
    scope.bypassPlanGate ? Promise.resolve(true) : canUseCustomDomain(scope.storeId)
  ]);
  const customDomainCount = domains.filter((domain) => domain.type === "CUSTOM").length;
  const platformDomain = domains.find((domain) => domain.type === "DASH_SUBDOMAIN");

  return {
    canAddCustomDomain: planAllowsCustomDomain && customDomainCount < MAX_CUSTOM_DOMAINS_PER_STORE,
    customDomainCount,
    domains: domains.map(toDomainView),
    maxCustomDomains: MAX_CUSTOM_DOMAINS_PER_STORE,
    planAllowsCustomDomain,
    platformDnsConfigured: isPlatformDnsConfigured(),
    platformDomain: platformDomain?.domain ?? null
  };
}

export async function addCustomDomain(
  scope: StoreScope,
  input: AddCustomDomainFormInput
): Promise<{ created: string[]; skipped: string[] }> {
  await assertPlanAllowsCustomDomain(scope);

  const parsed = addCustomDomainSchema.safeParse(input);

  if (!parsed.success) {
    throw new DomainError(
      "Please check the domain you entered.",
      toFieldErrors(parsed.error.issues)
    );
  }

  const { addSibling, domain } = parsed.data;
  const existingOwner = await findDomainOwner(domain);

  if (existingOwner) {
    throw new DomainError(
      existingOwner.storeId === scope.storeId
        ? "That domain is already on this store."
        : "That domain is already connected to another store. Remove it there first, or contact support if you own it.",
      { domain: "This domain is already in use." }
    );
  }

  const currentCount = await countCustomDomains(scope.storeId);

  if (currentCount >= MAX_CUSTOM_DOMAINS_PER_STORE) {
    throw new DomainError(
      `A store can have at most ${MAX_CUSTOM_DOMAINS_PER_STORE} custom domains. Remove one before adding another.`,
      { domain: "Domain limit reached." }
    );
  }

  const hostnames = [domain];
  const skipped: string[] = [];
  const sibling = addSibling ? getDomainSibling(domain) : null;

  // The sibling is a convenience, never a blocker: if it is invalid, taken, or
  // would cross the limit, add the domain the seller actually asked for.
  if (sibling) {
    const siblingProblem = validateDomainHostname(sibling);
    const siblingOwner = siblingProblem ? null : await findDomainOwner(sibling);

    if (siblingProblem || siblingOwner || currentCount + 2 > MAX_CUSTOM_DOMAINS_PER_STORE) {
      skipped.push(sibling);
    } else {
      hostnames.push(sibling);
    }
  }

  await createCustomDomains({ hostnames, storeId: scope.storeId });

  // Drops any negative routing cache entry left by an earlier request to this
  // hostname, so the domain starts working the moment it is verified.
  for (const hostname of hostnames) {
    invalidateCustomDomainRoute(hostname);
  }

  await logDomainChange(scope, `Custom domain added (${hostnames.join(", ")})`, {
    action: "add",
    domains: hostnames,
    skipped
  });

  return { created: hostnames, skipped };
}

export async function removeCustomDomain(scope: StoreScope, input: { domainId: string }) {
  await assertPlanAllowsCustomDomain(scope);

  const parsed = storeDomainRefSchema.safeParse(input);

  if (!parsed.success) {
    throw new DomainError("Select a domain to remove.");
  }

  const domain = await findStoreDomainById({
    domainId: parsed.data.domainId,
    storeId: scope.storeId
  });

  if (!domain) {
    throw new DomainError("That domain is not on this store.");
  }

  if (domain.type !== "CUSTOM") {
    throw new DomainError(
      "The built-in store address cannot be removed — it is how the storefront stays reachable."
    );
  }

  await deleteStoreDomain({ domainId: domain.id, storeId: scope.storeId });
  invalidateCustomDomainRoute(domain.domain);

  // A store must always have exactly one primary domain, so removing the primary
  // hands the flag back to the built-in subdomain, which is always reachable.
  if (domain.isPrimary) {
    const platformDomain = await findPlatformStoreDomain(scope.storeId);

    if (platformDomain) {
      await setPrimaryStoreDomain({ domainId: platformDomain.id, storeId: scope.storeId });
    }
  }

  await logDomainChange(scope, `Custom domain removed (${domain.domain})`, {
    action: "remove",
    domains: [domain.domain],
    wasPrimary: domain.isPrimary
  });

  return { removed: domain.domain };
}

export async function setPrimaryDomain(scope: StoreScope, input: { domainId: string }) {
  const parsed = storeDomainRefSchema.safeParse(input);

  if (!parsed.success) {
    throw new DomainError("Select a domain to make primary.");
  }

  const domain = await findStoreDomainById({
    domainId: parsed.data.domainId,
    storeId: scope.storeId
  });

  if (!domain) {
    throw new DomainError("That domain is not on this store.");
  }

  if (domain.type === "CUSTOM") {
    await assertPlanAllowsCustomDomain(scope);

    // The primary domain is the store's canonical public address. Promoting an
    // unverified hostname would point customers at a domain that is not proven
    // to reach us and has no certificate.
    if (!domain.verifiedAt) {
      throw new DomainError("Verify the domain's DNS before making it the primary address.");
    }
  }

  if (domain.isPrimary) {
    return { primary: domain.domain };
  }

  await setPrimaryStoreDomain({ domainId: domain.id, storeId: scope.storeId });

  await logDomainChange(scope, `Primary storefront domain changed to ${domain.domain}`, {
    action: "set-primary",
    domains: [domain.domain]
  });

  return { primary: domain.domain };
}

/**
 * Runs a real DNS lookup for one of the store's domains and records the outcome.
 *
 * Verification is idempotent and re-runnable: a domain that stops pointing at us
 * loses `verifiedAt` on the next check, which immediately makes it unservable
 * again. That is why the failure branch calls `markCustomDomainUnverified` rather
 * than just storing a message.
 */
export async function verifyCustomDomain(
  scope: StoreScope,
  input: { domainId: string }
): Promise<{ check: DomainCheckResult; domain: string }> {
  await assertPlanAllowsCustomDomain(scope);

  const parsed = storeDomainRefSchema.safeParse(input);

  if (!parsed.success) {
    throw new DomainError("Select a domain to verify.");
  }

  const domain = await findStoreDomainById({
    domainId: parsed.data.domainId,
    storeId: scope.storeId
  });

  if (!domain) {
    throw new DomainError("That domain is not on this store.");
  }

  if (domain.type !== "CUSTOM") {
    throw new DomainError("The built-in store address does not need verification.");
  }

  if (!consumeVerificationAttempt(domain.id)) {
    throw new DomainError("Give DNS a moment to settle, then verify again.");
  }

  const check = await checkDomainDns(domain.domain);

  await recordStoreDomainCheck({
    detail: check.detail,
    domainId: domain.id,
    status: check.status,
    storeId: scope.storeId
  });

  // A server that does not know its own address cannot judge anyone's DNS, so
  // that outcome leaves the stored verification exactly as it was.
  if (check.status === "platform-not-configured" || check.status === "lookup-failed") {
    return { check, domain: domain.domain };
  }

  if (check.status === "verified") {
    if (!domain.verifiedAt) {
      await markCustomDomainVerified(scope, domain.id);
    }
  } else if (domain.verifiedAt) {
    await markCustomDomainUnverified(scope, domain.id);
  }

  return { check, domain: domain.domain };
}

/**
 * One check per domain every few seconds. A "Verify" button invites clicking, and
 * each click is a real outbound DNS query.
 */
const verificationAttempts = new Map<string, number>();
const VERIFICATION_INTERVAL_MS = 5000;

function consumeVerificationAttempt(domainId: string) {
  const now = Date.now();
  const previous = verificationAttempts.get(domainId);

  if (previous && now - previous < VERIFICATION_INTERVAL_MS) {
    return false;
  }

  if (verificationAttempts.size > 500) {
    verificationAttempts.clear();
  }

  verificationAttempts.set(domainId, now);

  return true;
}

/**
 * Verification write paths, for the DNS-checking pass. They live here so the
 * "verified means servable" rule has a single owner: nothing else in the app
 * writes `verifiedAt`.
 */
export async function markCustomDomainVerified(scope: StoreScope, domainId: string) {
  const domain = await findStoreDomainById({ domainId, storeId: scope.storeId });

  await setStoreDomainVerification({ domainId, storeId: scope.storeId, verifiedAt: new Date() });

  if (domain) {
    invalidateCustomDomainRoute(domain.domain);
  }

  await logDomainChange(scope, "Custom domain verified", { action: "verify", domainId });
}

export async function markCustomDomainUnverified(scope: StoreScope, domainId: string) {
  const domain = await findStoreDomainById({ domainId, storeId: scope.storeId });

  await setStoreDomainVerification({ domainId, storeId: scope.storeId, verifiedAt: null });

  if (domain) {
    invalidateCustomDomainRoute(domain.domain);
  }

  // Losing verification also loses the right to be the canonical address.
  if (domain?.isPrimary) {
    const platformDomain = await findPlatformStoreDomain(scope.storeId);

    if (platformDomain) {
      await setPrimaryStoreDomain({ domainId: platformDomain.id, storeId: scope.storeId });
    }
  }

  await logDomainChange(scope, "Custom domain verification cleared", {
    action: "unverify",
    domainId
  });
}

function toDomainView(domain: StoreDomainRecord): StoreDomainView {
  const isPlatformDomain = domain.type === "DASH_SUBDOMAIN";

  return {
    canSetPrimary: !domain.isPrimary && (isPlatformDomain || Boolean(domain.verifiedAt)),
    createdAt: domain.createdAt,
    // The platform's own subdomain needs no seller action, so it carries no
    // instructions — only custom rows do.
    dnsInstructions: isPlatformDomain ? [] : buildDnsInstructions(domain.domain),
    domain: domain.domain,
    id: domain.id,
    isPlatformDomain,
    isPrimary: domain.isPrimary,
    isVerified: isPlatformDomain || Boolean(domain.verifiedAt),
    lastCheckDetail: domain.lastCheckDetail,
    lastCheckStatus: domain.lastCheckStatus,
    lastCheckedAt: domain.lastCheckedAt,
    verifiedAt: domain.verifiedAt
  };
}

async function logDomainChange(
  scope: StoreScope,
  message: string,
  metadata: Record<string, boolean | string | string[]>
) {
  await createSystemLog({
    level: "INFO",
    message,
    metadata,
    source: "STORE",
    storeId: scope.storeId,
    ...(scope.organizationId ? { organizationId: scope.organizationId } : {}),
    ...(scope.userId ? { userId: scope.userId } : {})
  });
}

function toFieldErrors(issues: { message: string; path: PropertyKey[] }[]) {
  const fieldErrors: Record<string, string> = {};

  for (const issue of issues) {
    const key = issue.path[0];
    const field = typeof key === "string" ? key : "form";

    fieldErrors[field] ??= issue.message;
  }

  return fieldErrors;
}
