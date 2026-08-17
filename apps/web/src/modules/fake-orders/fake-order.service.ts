import {
  assessOrder,
  assessOrdersForCustomerSafely,
  backfillStoreRiskAssessments
} from "./fake-order.assessment";
import {
  countBlockedCustomers,
  countOrdersByVerificationStatus,
  countOrdersForStore,
  getOrdersBySamePhone,
  getRiskLevelCounts,
  getRiskOrderByIdForStore,
  getRiskOrdersForFilter,
  getVerificationQueueOrders,
  updateCustomerFlagStatus,
  updateOrderVerificationStatus,
  type RiskListOrder
} from "./fake-order.repository";
import { normalizePhoneKey, parseRiskFactors } from "./fake-order.rules";
import { isCourierVerificationRequired } from "./fake-order.verification";
import type { FakeOrderFilter, RiskAssessment, RiskLevel } from "./fake-order.types";

export { getRiskOrderByIdForStore };

/**
 * The read layer for the review dashboards.
 *
 * Every score here comes off the order row — the engine ran when the order was
 * written (modules/fake-orders/fake-order.assessment.ts). These functions issue
 * targeted, indexed queries and never load the store's order history.
 *
 * `backfillStoreRiskAssessments` covers orders created before the engine existed;
 * it is memoized per store per process, so it is a no-op after the first load.
 */

type AssessedOrder = {
  assessment: RiskAssessment;
  order: RiskListOrder;
};

export async function getFakeOrderDashboard(storeId: string, filter: FakeOrderFilter, search = "") {
  await backfillStoreRiskAssessments(storeId);

  const [orders, levelCounts, verifiedOrders, allOrders, blockedCustomers] = await Promise.all([
    getRiskOrdersForFilter(storeId, filterToQuery(filter), search),
    getRiskLevelCounts(storeId),
    countOrdersByVerificationStatus(storeId, ["VERIFIED"]),
    countOrdersForStore(storeId),
    countBlockedCustomers(storeId)
  ]);

  return {
    metrics: {
      allOrders,
      blockedCustomers,
      highRiskOrders: levelCounts.HIGH,
      lowRiskOrders: levelCounts.LOW,
      mediumRiskOrders: levelCounts.MEDIUM,
      verifiedOrders
    },
    orders: orders.map(toAssessedOrder)
  };
}

/**
 * Orders waiting for a seller decision.
 *
 * With the gate off this is exactly the risky, undecided orders. With the gate
 * on, nothing ships until it is verified, so every order that has not reached a
 * terminal decision belongs in the queue.
 */
export async function getVerificationQueue(storeId: string, search = "") {
  await backfillStoreRiskAssessments(storeId);

  const orders = await getVerificationQueueOrders(storeId, search, {
    includeUndecided: await isCourierVerificationRequired(storeId)
  });

  return orders.map(toAssessedOrder);
}

export async function getFakeOrderDetails(storeId: string, orderId: string) {
  let order = await getRiskOrderByIdForStore(storeId, orderId);

  if (!order) return null;

  // An order that predates the engine is assessed on first open rather than
  // shown a zeroed score while the backfill works through the rest of the store.
  if (!order.riskAssessedAt) {
    await assessOrder(storeId, orderId);
    order = (await getRiskOrderByIdForStore(storeId, orderId)) ?? order;
  }

  const relatedOrders = await getOrdersBySamePhone(storeId, normalizePhoneKey(order.customerPhone));

  return {
    assessment: toAssessment(order),
    cancellationHistory: relatedOrders.filter((candidate) => candidate.status === "CANCELLED"),
    order,
    previousOrders: relatedOrders.filter((candidate) => candidate.id !== order.id)
  };
}

/* -------------------------------------------------------------------------- */
/* Verification actions                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Each action records a seller decision, which is what takes the order out of
 * the engine's hands (see `verificationDecidedAt`). Flag changes then re-assess
 * every order for the same customer, because "previous fake order history" and the
 * customer flag are counted across that whole history.
 */

export async function markOrderVerified(storeId: string, orderId: string) {
  const result = await updateOrderVerificationStatus(storeId, orderId, "VERIFIED");

  return result.count > 0;
}

export async function markOrderFake(storeId: string, orderId: string) {
  const order = await getRiskOrderByIdForStore(storeId, orderId);

  if (!order) return false;

  await updateOrderVerificationStatus(storeId, orderId, "FAKE");

  if (order.customerId) {
    await updateCustomerFlagStatus(storeId, order.customerId, "WATCHLIST");
  }

  await assessOrdersForCustomerSafely(storeId, { customerId: order.customerId, phone: order.customerPhone });

  return true;
}

export async function blockOrderCustomer(storeId: string, orderId: string) {
  const order = await getRiskOrderByIdForStore(storeId, orderId);

  if (!order) return false;

  await updateOrderVerificationStatus(storeId, orderId, "BLOCKED");

  if (order.customerId) {
    await updateCustomerFlagStatus(storeId, order.customerId, "BLOCKED");
  }

  await assessOrdersForCustomerSafely(storeId, { customerId: order.customerId, phone: order.customerPhone });

  return true;
}

export async function returnOrderToNormalQueue(storeId: string, orderId: string) {
  const order = await getRiskOrderByIdForStore(storeId, orderId);

  if (!order) return false;

  await updateOrderVerificationStatus(storeId, orderId, "NORMAL");

  if (order.customerId && order.customer?.flagStatus !== "BLOCKED") {
    await updateCustomerFlagStatus(storeId, order.customerId, "NORMAL");
  }

  // The score is refreshed, but `verificationDecidedAt` is now set, so this
  // order stays out of the queue instead of re-entering on the same signals.
  await assessOrdersForCustomerSafely(storeId, { customerId: order.customerId, phone: order.customerPhone });

  return true;
}

/* -------------------------------------------------------------------------- */

function filterToQuery(filter: FakeOrderFilter) {
  if (filter === "verified") return { verified: true };
  if (filter === "all") return {};

  return { level: filter.toUpperCase() as RiskLevel };
}

function toAssessedOrder(order: RiskListOrder): AssessedOrder {
  return { assessment: toAssessment(order), order };
}

function toAssessment(order: { riskFactors?: unknown; riskLevel: string; riskScore: number }): RiskAssessment {
  return {
    factors: parseRiskFactors(order.riskFactors),
    level: order.riskLevel as RiskLevel,
    score: order.riskScore
  };
}
