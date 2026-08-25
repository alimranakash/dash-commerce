export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type FakeOrderFilter = "all" | "high" | "medium" | "low" | "verified";

/**
 * The verification lifecycle. `QUEUED` is the legacy enum value that no code
 * path ever wrote; it is accepted on read and normalized to `PENDING_REVIEW`.
 */
export type VerificationStatus =
  | "NORMAL"
  | "PENDING_REVIEW"
  | "VERIFIED"
  | "FAKE"
  | "BLOCKED";

export type StoredVerificationStatus = VerificationStatus | "QUEUED";

export type CustomerFlagStatus = "NORMAL" | "WATCHLIST" | "BLOCKED";

/** Statuses that mean "waiting for a seller decision". */
export const PENDING_REVIEW_STATUSES = ["PENDING_REVIEW", "QUEUED"] as const;

export function toVerificationStatus(value: string): VerificationStatus {
  return value === "QUEUED" ? "PENDING_REVIEW" : (value as VerificationStatus);
}

export type RiskFactor = {
  label: string;
  points: number;
};

export type RiskAssessment = {
  factors: RiskFactor[];
  level: RiskLevel;
  score: number;
};

/**
 * Everything the scoring rules need about one order, gathered by a targeted
 * query rather than by scanning the store's order history in memory.
 */
export type RiskSignals = {
  cancelledOrderCount: number;
  courierSuccessRatio: number | null;
  courierTotalParcels: number;
  customerFlagStatus: CustomerFlagStatus | null;
  /** Same-phone orders already rejected (FAKE or BLOCKED), including this one. */
  fakeOrderCount: number;
  hasCustomerName: boolean;
  hasCustomerPhone: boolean;
  hasShippingAddress: boolean;
  isCashOnDelivery: boolean;
  /**
   * Live same-phone orders for the same amount within ±6 hours, **excluding**
   * this one — so one is enough to mean "there is a twin". Cancelled siblings
   * do not count: the seller has already dealt with that one.
   */
  duplicateOrderCount: number;
  /** Same-phone orders within ±1 hour of this one, including this one. */
  recentOrderCount: number;
  /** Same-phone orders in the store, including this one. */
  samePhoneOrderCount: number;
  totalAmount: number;
};
