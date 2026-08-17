import { getCachedCourierScoreMap } from "../courier/courier-insight.service";
import { normalizeBangladeshPhone } from "../courier/courier-phone";
import {
  getOrderIdsForCustomer,
  getPhoneRiskSignals,
  getRiskOrderInputs,
  getUnassessedOrderIds,
  saveRiskAssessments,
  type RiskAssessmentWrite,
  type RiskOrderInput
} from "./fake-order.repository";
import { normalizePhoneKey, scoreRisk } from "./fake-order.rules";
import type { RiskSignals } from "./fake-order.types";

/**
 * Where risk is calculated: at write time, never on a dashboard read.
 *
 * The engine runs when something that feeds a rule actually changes — a new
 * order, a cancellation, a customer flag, a refreshed courier score — and stores
 * the score, the level and the factor breakdown on the order. The verification
 * pages then read those columns and nothing else.
 *
 * `verificationStatus` is only auto-assigned while `verificationDecidedAt` is
 * null. Once a seller has decided, re-assessment updates the score but leaves the
 * decision alone, which is what stops "Return to Normal Queue" from bouncing the
 * order straight back into the queue on the same signals.
 */

const ASSESSMENT_BATCH_SIZE = 200;

/** Ceiling for a single page load, so a large store's first open cannot stall. */
const BACKFILL_MAX_ORDERS = 1000;

export async function assessOrders(storeId: string, orderIds: string[]) {
  if (orderIds.length === 0) {
    return 0;
  }

  let assessed = 0;

  for (let index = 0; index < orderIds.length; index += ASSESSMENT_BATCH_SIZE) {
    const batch = orderIds.slice(index, index + ASSESSMENT_BATCH_SIZE);

    assessed += await assessBatch(storeId, batch);
  }

  return assessed;
}

export async function assessOrder(storeId: string, orderId: string) {
  return assessOrders(storeId, [orderId]);
}

/**
 * Re-assesses every order belonging to the same customer. This is the blast
 * radius of a flag change or a cancellation: those signals are counted across the
 * customer's whole history, so one write changes several orders' scores.
 */
export async function assessOrdersForCustomer(
  storeId: string,
  input: { customerId?: string | null | undefined; phone: string }
) {
  const key = normalizePhoneKey(input.phone);

  if (!key && !input.customerId) {
    return 0;
  }

  const orderIds = await getOrderIdsForCustomer(storeId, {
    customerId: input.customerId ?? null,
    phone: key
  });

  return assessOrders(storeId, orderIds);
}

/**
 * Brings orders created before the engine existed up to date, in bounded passes.
 *
 * Memoized per store per process so the two dashboard pages do not both start it
 * and so a warm store pays nothing. The memo is only kept once a run has drained
 * the store: a run that stopped at the per-load ceiling, or failed, clears it so
 * the next page load resumes rather than leaving the remainder unassessed
 * forever.
 */
const backfillPromises = new Map<string, Promise<void>>();

export function backfillStoreRiskAssessments(storeId: string) {
  const running = backfillPromises.get(storeId);

  if (running) {
    return running;
  }

  const promise = runBackfill(storeId).then(
    (drained) => {
      if (!drained) {
        backfillPromises.delete(storeId);
      }
    },
    (error: unknown) => {
      backfillPromises.delete(storeId);

      throw error;
    }
  );

  backfillPromises.set(storeId, promise);

  return promise;
}

/** Resolves true when there is nothing left to assess for this store. */
async function runBackfill(storeId: string) {
  let processed = 0;

  while (processed < BACKFILL_MAX_ORDERS) {
    const orderIds = await getUnassessedOrderIds(storeId, ASSESSMENT_BATCH_SIZE);

    if (orderIds.length === 0) {
      return true;
    }

    await assessBatch(storeId, orderIds);
    processed += orderIds.length;
  }

  return false;
}

async function assessBatch(storeId: string, orderIds: string[]) {
  const [orders, signalRows] = await Promise.all([
    getRiskOrderInputs(storeId, orderIds),
    getPhoneRiskSignals(storeId, orderIds)
  ]);

  if (orders.length === 0) {
    return 0;
  }

  const signalsByOrder = new Map(signalRows.map((row) => [row.orderId, row]));
  const courierScores = await loadCourierScores(storeId, orders);

  const writes = orders.map<RiskAssessmentWrite>((order) => {
    const assessment = scoreRisk(buildSignals(order, signalsByOrder.get(order.id), courierScores));

    return {
      factors: assessment.factors,
      level: assessment.level,
      orderId: order.id,
      score: assessment.score,
      // A decided order keeps its status; only its score is refreshed.
      ...(order.verificationDecidedAt
        ? {}
        : { verificationStatus: assessment.level === "LOW" ? ("NORMAL" as const) : ("PENDING_REVIEW" as const) })
    };
  });

  await saveRiskAssessments(storeId, writes);

  return writes.length;
}

function buildSignals(
  order: RiskOrderInput,
  counts: { cancelledOrderCount: number; fakeOrderCount: number; recentOrderCount: number; samePhoneOrderCount: number } | undefined,
  courierScores: CourierScoreLookup
): RiskSignals {
  const courierScore = courierScores.get(normalizeBangladeshPhone(order.customerPhone) ?? "");

  return {
    cancelledOrderCount: counts?.cancelledOrderCount ?? 0,
    courierSuccessRatio: courierScore?.successRatio ?? null,
    courierTotalParcels: courierScore?.totalParcels ?? 0,
    customerFlagStatus: order.customerFlagStatus,
    fakeOrderCount: counts?.fakeOrderCount ?? 0,
    hasCustomerName: Boolean(order.customerName),
    hasCustomerPhone: Boolean(order.customerPhone),
    hasShippingAddress: Boolean(order.shippingAddressId),
    isCashOnDelivery: order.paymentMethodType === "COD",
    // The order itself always counts, exactly as the in-memory version did.
    recentOrderCount: counts?.recentOrderCount ?? 1,
    samePhoneOrderCount: counts?.samePhoneOrderCount ?? 1,
    totalAmount: Number(order.totalAmount)
  };
}

type CourierScoreLookup = Map<string, { successRatio: number | null; totalParcels: number }>;

/**
 * Cache-only, and deliberately failure-tolerant: courier history is advisory, so
 * an unreachable carrier or a database hiccup must degrade the score, never fail
 * the checkout or the action that triggered the assessment.
 */
async function loadCourierScores(storeId: string, orders: Array<{ customerPhone: string }>) {
  try {
    return await getCachedCourierScoreMap(storeId, orders.map((order) => order.customerPhone));
  } catch {
    return new Map() as CourierScoreLookup;
  }
}

/**
 * Assessment is a side effect of a write, not part of its contract — a failure
 * here must never roll back a checkout or a status change. The order is left
 * unassessed and the backfill picks it up on the next dashboard load.
 */
export async function assessOrderSafely(storeId: string, orderId: string) {
  try {
    await assessOrder(storeId, orderId);
  } catch {
    // Intentionally swallowed; see above.
  }
}

export async function assessOrdersForCustomerSafely(
  storeId: string,
  input: { customerId?: string | null | undefined; phone: string }
) {
  try {
    await assessOrdersForCustomer(storeId, input);
  } catch {
    // Intentionally swallowed; see above.
  }
}
