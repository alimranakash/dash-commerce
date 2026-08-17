import type { RiskAssessment, RiskFactor, RiskLevel, RiskSignals } from "./fake-order.types";

/**
 * The rule-based risk engine. Deliberately pure and synchronous: it takes the
 * gathered signals and returns a score, so it can run at write time without a
 * database round trip of its own.
 *
 * The labels, the point values and the order they are emitted in are unchanged
 * from the in-memory version this replaced — a stored score must equal the score
 * the dashboard used to compute on the fly.
 */
export function scoreRisk(signals: RiskSignals): RiskAssessment {
  const factors: RiskFactor[] = [];

  if (signals.samePhoneOrderCount > 1) {
    factors.push({ label: "Duplicate phone number across orders", points: 18 });
  }

  if (signals.cancelledOrderCount >= 2) {
    factors.push({ label: "Multiple cancelled orders", points: 24 });
  }

  if (signals.fakeOrderCount > 0) {
    factors.push({ label: "Previous fake order history", points: 30 });
  }

  if (signals.totalAmount >= 10000 && signals.isCashOnDelivery) {
    factors.push({ label: "Very high cash-on-delivery amount", points: 18 });
  }

  if (signals.recentOrderCount >= 3) {
    factors.push({ label: "Multiple orders within a short time", points: 16 });
  }

  if (!signals.hasCustomerName || !signals.hasCustomerPhone || !signals.hasShippingAddress) {
    factors.push({ label: "Missing customer or delivery information", points: 14 });
  }

  if (signals.customerFlagStatus === "WATCHLIST") {
    factors.push({ label: "Customer is on watchlist", points: 20 });
  }

  if (signals.customerFlagStatus === "BLOCKED") {
    factors.push({ label: "Customer is blocked", points: 40 });
  }

  if (signals.courierSuccessRatio !== null) {
    if (signals.courierSuccessRatio < 40 && signals.courierTotalParcels >= 5) {
      factors.push({ label: "Poor courier delivery history", points: 20 });
    } else if (signals.courierSuccessRatio < 60 && signals.courierTotalParcels >= 10) {
      factors.push({ label: "Weak courier delivery history", points: 12 });
    }
  }

  const score = Math.min(100, factors.reduce((total, factor) => total + factor.points, 0));

  return {
    factors,
    level: riskLevelFromScore(score),
    score
  };
}

export function riskLevelFromScore(score: number): RiskLevel {
  if (score > 70) return "HIGH";
  if (score > 30) return "MEDIUM";

  return "LOW";
}

/** Digits-only, matching the SQL `regexp_replace(phone, '\D', '', 'g')`. */
export function normalizePhoneKey(phone: string) {
  return phone.replace(/\D/g, "");
}

export function parseRiskFactors(value: unknown): RiskFactor[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is RiskFactor => {
    if (typeof entry !== "object" || entry === null) {
      return false;
    }

    const factor = entry as Partial<RiskFactor>;

    return typeof factor.label === "string" && typeof factor.points === "number";
  });
}
