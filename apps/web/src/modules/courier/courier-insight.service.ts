import { toCourierContext } from "./courier-accounts.service";
import { CourierError, courierErrorMessage, toCourierError } from "./courier-errors";
import { normalizeBangladeshPhone } from "./courier-phone";
import { assertCourierRateLimit } from "./courier-rate-limit";
import {
  getCourierAccountForStore,
  getCourierCustomerScoreForStore,
  getCourierCustomerScoresForPhones,
  updateCourierAccountBalanceForStore,
  upsertCourierCustomerScoreForStore
} from "./courier.repository";
import { getCourierProvider, requireCourierProvider } from "./providers/registry";

/**
 * Read-only courier insight: what is in the carrier account, and whether this
 * customer actually accepts parcels.
 *
 * Both features are advisory, so nothing here is allowed to break a page. Every
 * public function returns a result object instead of throwing — a stale number
 * with a timestamp beats an error state, and a missing number beats a crash.
 */

const balanceTtlMs = 15 * 60 * 1000;
const scoreTtlMs = 24 * 60 * 60 * 1000;
/** Below this, a ratio is noise rather than signal. */
const minimumParcelsForConfidence = 5;

export type CourierBalanceView = {
  amount: number | null;
  checkedAt: Date | null;
  currency: string;
  error: string | null;
  provider: string;
  providerLabel: string;
  stale: boolean;
};

export type CourierScoreBand = "CAUTION" | "GOOD" | "LIMITED" | "RISKY" | "UNKNOWN";

export type CourierScoreView = {
  band: CourierScoreBand;
  checkedAt: Date | null;
  error: string | null;
  phone: string;
  provider: string | null;
  providerLabel: string | null;
  successRatio: number | null;
  totalCancelled: number | null;
  totalDelivered: number;
  totalParcels: number;
};

/* -------------------------------------------------------------------------- */
/* Balance                                                                    */
/* -------------------------------------------------------------------------- */

export async function getCourierBalance(
  storeId: string,
  providerKey: string,
  options: { force?: boolean } = {}
): Promise<CourierBalanceView | null> {
  const provider = getCourierProvider(providerKey);

  // Capability-gated: a carrier without a balance endpoint shows no row at all.
  if (!provider?.capabilities.balance || !provider.getBalance) {
    return null;
  }

  const account = await getCourierAccountForStore(storeId, providerKey);

  if (!account?.credentialsCipher) {
    return null;
  }

  const cachedAmount = account.balanceAmount === null ? null : Number(account.balanceAmount);
  const checkedAt = account.balanceCheckedAt;
  const fresh = checkedAt !== null && Date.now() - checkedAt.getTime() < balanceTtlMs;

  if (!options.force && fresh) {
    return {
      amount: cachedAmount,
      checkedAt,
      currency: "BDT",
      error: null,
      provider: providerKey,
      providerLabel: provider.label,
      stale: false
    };
  }

  try {
    assertCourierRateLimit(storeId, providerKey);

    const result = await provider.getBalance(toCourierContext(storeId, account));

    await updateCourierAccountBalanceForStore(storeId, providerKey, result.amount);

    return {
      amount: result.amount,
      checkedAt: new Date(),
      currency: result.currency,
      error: null,
      provider: providerKey,
      providerLabel: provider.label,
      stale: false
    };
  } catch (error) {
    // Never blocking: fall back to whatever we last knew, labelled as stale.
    return {
      amount: cachedAmount,
      checkedAt,
      currency: "BDT",
      error: courierErrorMessage(toCourierError(error)),
      provider: providerKey,
      providerLabel: provider.label,
      stale: true
    };
  }
}

/**
 * Cache-only variant for hot pages such as the orders list, where a stale
 * cache must never turn into a 12-second render stall behind a carrier timeout.
 */
export async function getCachedCourierBalance(
  storeId: string,
  providerKey: string
): Promise<CourierBalanceView | null> {
  const provider = getCourierProvider(providerKey);

  if (!provider?.capabilities.balance) {
    return null;
  }

  const account = await getCourierAccountForStore(storeId, providerKey);

  if (!account?.credentialsCipher || account.balanceCheckedAt === null) {
    return null;
  }

  return {
    amount: account.balanceAmount === null ? null : Number(account.balanceAmount),
    checkedAt: account.balanceCheckedAt,
    currency: "BDT",
    error: null,
    provider: providerKey,
    providerLabel: provider.label,
    stale: Date.now() - account.balanceCheckedAt.getTime() >= balanceTtlMs
  };
}

/* -------------------------------------------------------------------------- */
/* Customer delivery score                                                    */
/* -------------------------------------------------------------------------- */

/**
 * One formula for every carrier. Null when there is no history at all — which
 * renders as "No delivery history" and never as 0%, because a brand-new
 * customer is not a maximally bad one.
 */
export function successRatioFor(totalParcels: number, totalDelivered: number) {
  return totalParcels > 0 ? Math.round((totalDelivered / totalParcels) * 1000) / 10 : null;
}

export function scoreBandFor(successRatio: number | null, totalParcels: number): CourierScoreBand {
  if (successRatio === null || totalParcels === 0) {
    return "UNKNOWN";
  }

  if (totalParcels < minimumParcelsForConfidence) {
    return "LIMITED";
  }

  if (successRatio >= 80) {
    return "GOOD";
  }

  return successRatio >= 50 ? "CAUTION" : "RISKY";
}

export function scoreBandLabel(band: CourierScoreBand) {
  switch (band) {
    case "GOOD":
      return "Reliable";
    case "CAUTION":
      return "Caution";
    case "RISKY":
      return "Risky";
    case "LIMITED":
      return "Limited history";
    default:
      return "No delivery history";
  }
}

/** Cache read only — safe on any render path, never touches the network. */
export async function getCachedCourierScore(
  storeId: string,
  phone: string,
  providerKey?: string
): Promise<CourierScoreView | null> {
  const normalized = normalizeBangladeshPhone(phone);

  if (!normalized) {
    return null;
  }

  const provider = providerKey ?? (await defaultScoreProvider(storeId));

  if (!provider) {
    return null;
  }

  const cached = await getCourierCustomerScoreForStore(storeId, provider, normalized);

  return cached ? toScoreView(cached, provider) : null;
}

export async function checkCourierCustomerScore(
  storeId: string,
  phone: string,
  options: { force?: boolean; provider?: string } = {}
): Promise<CourierScoreView> {
  const normalized = normalizeBangladeshPhone(phone);

  if (!normalized) {
    return emptyScore(phone, "That phone number is not a valid Bangladeshi mobile number.");
  }

  const providerKey = options.provider ?? (await defaultScoreProvider(storeId));

  if (!providerKey) {
    return emptyScore(normalized, "No courier with a delivery-history check is configured.");
  }

  const cached = await getCourierCustomerScoreForStore(storeId, providerKey, normalized);
  const fresh = cached !== null && Date.now() - cached.checkedAt.getTime() < scoreTtlMs;

  if (!options.force && fresh && cached) {
    return toScoreView(cached, providerKey);
  }

  try {
    const provider = requireCourierProvider(providerKey);

    if (!provider.capabilities.customerScore || !provider.checkCustomer) {
      throw new CourierError("VALIDATION", `${provider.label} has no delivery-history check.`);
    }

    const account = await getCourierAccountForStore(storeId, providerKey);

    if (!account?.credentialsCipher) {
      throw new CourierError("VALIDATION", `${provider.label} is not configured for this store.`);
    }

    assertCourierRateLimit(storeId, providerKey);

    const result = await provider.checkCustomer(
      { phone: normalized },
      toCourierContext(storeId, account)
    );
    const successRatio = successRatioFor(result.totalParcels, result.totalDelivered);

    await upsertCourierCustomerScoreForStore({
      phone: normalized,
      provider: providerKey,
      raw: (result.raw ?? {}) as object,
      storeId,
      successRatio,
      totalDelivered: result.totalDelivered,
      totalParcels: result.totalParcels,
      ...(result.totalCancelled !== null ? { totalCancelled: result.totalCancelled } : {})
    });

    return {
      band: scoreBandFor(successRatio, result.totalParcels),
      checkedAt: new Date(),
      error: null,
      phone: normalized,
      provider: providerKey,
      providerLabel: provider.label,
      successRatio,
      totalCancelled: result.totalCancelled,
      totalDelivered: result.totalDelivered,
      totalParcels: result.totalParcels
    };
  } catch (error) {
    const message = courierErrorMessage(toCourierError(error));

    // Graceful degradation: an account without fraud_check access still shows
    // whatever was cached before, just flagged.
    if (cached) {
      return { ...toScoreView(cached, providerKey), error: message };
    }

    return emptyScore(normalized, message);
  }
}

/**
 * The bulk cache read behind the risk factor. Returns a map keyed by the
 * digits-only phone so it can be joined against orders without re-normalizing.
 */
export async function getCachedCourierScoreMap(storeId: string, phones: string[]) {
  const normalized = [...new Set(phones.map((phone) => normalizeBangladeshPhone(phone)))].filter(
    (phone): phone is string => phone !== null
  );

  const rows = await getCourierCustomerScoresForPhones(storeId, normalized);

  return rows.reduce<Map<string, { successRatio: number | null; totalParcels: number }>>(
    (map, row) => {
      map.set(row.phone, {
        successRatio: row.successRatio === null ? null : Number(row.successRatio),
        totalParcels: row.totalParcels
      });

      return map;
    },
    new Map()
  );
}

async function defaultScoreProvider(storeId: string) {
  for (const key of ["steadfast"]) {
    const provider = getCourierProvider(key);

    if (!provider?.capabilities.customerScore) {
      continue;
    }

    const account = await getCourierAccountForStore(storeId, key);

    if (account?.credentialsCipher && account.isEnabled) {
      return key;
    }
  }

  return null;
}

function toScoreView(
  row: {
    checkedAt: Date;
    successRatio: unknown;
    totalCancelled: number;
    totalDelivered: number;
    totalParcels: number;
  },
  providerKey: string
): CourierScoreView {
  const successRatio = row.successRatio === null ? null : Number(row.successRatio);

  return {
    band: scoreBandFor(successRatio, row.totalParcels),
    checkedAt: row.checkedAt,
    error: null,
    phone: "",
    provider: providerKey,
    providerLabel: getCourierProvider(providerKey)?.label ?? providerKey,
    successRatio,
    totalCancelled: row.totalCancelled,
    totalDelivered: row.totalDelivered,
    totalParcels: row.totalParcels
  };
}

function emptyScore(phone: string, error: string): CourierScoreView {
  return {
    band: "UNKNOWN",
    checkedAt: null,
    error,
    phone,
    provider: null,
    providerLabel: null,
    successRatio: null,
    totalCancelled: null,
    totalDelivered: 0,
    totalParcels: 0
  };
}
