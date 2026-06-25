import {
  getOrdersForRiskReview,
  getRiskOrderByIdForStore,
  updateCustomerFlagStatus,
  updateOrderVerificationStatus
} from "./fake-order.repository";
import type { FakeOrderFilter, RiskAssessment, RiskFactor, RiskLevel } from "./fake-order.types";

export { getRiskOrderByIdForStore };

type RiskOrder = Awaited<ReturnType<typeof getOrdersForRiskReview>>[number];

export async function getFakeOrderDashboard(storeId: string, filter: FakeOrderFilter, search = "") {
  const orders = await getOrdersForRiskReview(storeId);
  const assessed = orders.map((order) => ({
    assessment: assessOrderRisk(order, orders),
    order
  }));
  const visible = assessed.filter(({ assessment, order }) => matchesFilter(assessment.level, order.verificationStatus, filter) && matchesSearch(order, search));

  return {
    metrics: {
      allOrders: assessed.length,
      blockedCustomers: uniqueBlockedCustomers(orders),
      highRiskOrders: assessed.filter(({ assessment }) => assessment.level === "HIGH").length,
      lowRiskOrders: assessed.filter(({ assessment }) => assessment.level === "LOW").length,
      mediumRiskOrders: assessed.filter(({ assessment }) => assessment.level === "MEDIUM").length,
      verifiedOrders: orders.filter((order) => order.verificationStatus === "VERIFIED").length
    },
    orders: visible
  };
}

export async function getVerificationQueue(storeId: string, search = "") {
  const orders = await getOrdersForRiskReview(storeId);
  const queue = orders
    .map((order) => ({
      assessment: assessOrderRisk(order, orders),
      order
    }))
    .filter(({ assessment, order }) => {
      const waiting = order.verificationStatus === "QUEUED" || (order.verificationStatus === "NORMAL" && assessment.level !== "LOW");
      return waiting && matchesSearch(order, search);
    });

  return queue;
}

export async function getFakeOrderDetails(storeId: string, orderId: string) {
  const [order, orders] = await Promise.all([
    getRiskOrderByIdForStore(storeId, orderId),
    getOrdersForRiskReview(storeId)
  ]);

  if (!order) return null;

  const relatedOrders = orders.filter((candidate) => normalizePhone(candidate.customerPhone) === normalizePhone(order.customerPhone));
  const assessment = assessOrderRisk(order, orders);

  return {
    assessment,
    cancellationHistory: relatedOrders.filter((candidate) => candidate.status === "CANCELLED"),
    order,
    previousOrders: relatedOrders.filter((candidate) => candidate.id !== order.id)
  };
}

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

  return true;
}

export async function blockOrderCustomer(storeId: string, orderId: string) {
  const order = await getRiskOrderByIdForStore(storeId, orderId);

  if (!order) return false;

  await updateOrderVerificationStatus(storeId, orderId, "FAKE");

  if (order.customerId) {
    await updateCustomerFlagStatus(storeId, order.customerId, "BLOCKED");
  }

  return true;
}

export async function returnOrderToNormalQueue(storeId: string, orderId: string) {
  const order = await getRiskOrderByIdForStore(storeId, orderId);

  if (!order) return false;

  await updateOrderVerificationStatus(storeId, orderId, "NORMAL");

  if (order.customerId && order.customer?.flagStatus !== "BLOCKED") {
    await updateCustomerFlagStatus(storeId, order.customerId, "NORMAL");
  }

  return true;
}

export function assessOrderRisk(order: RiskOrder, allOrders: RiskOrder[]): RiskAssessment {
  const factors: RiskFactor[] = [];
  const phone = normalizePhone(order.customerPhone);
  const samePhoneOrders = allOrders.filter((candidate) => normalizePhone(candidate.customerPhone) === phone);
  const cancelledOrders = samePhoneOrders.filter((candidate) => candidate.status === "CANCELLED");
  const fakeOrders = samePhoneOrders.filter((candidate) => candidate.verificationStatus === "FAKE");
  const recentOrders = samePhoneOrders.filter((candidate) => Math.abs(candidate.createdAt.getTime() - order.createdAt.getTime()) <= 60 * 60 * 1000);

  if (samePhoneOrders.length > 1) factors.push({ label: "Duplicate phone number across orders", points: 18 });
  if (cancelledOrders.length >= 2) factors.push({ label: "Multiple cancelled orders", points: 24 });
  if (fakeOrders.length > 0) factors.push({ label: "Previous fake order history", points: 30 });
  if (Number(order.totalAmount) >= 10000 && isCod(order.paymentMethodType)) factors.push({ label: "Very high cash-on-delivery amount", points: 18 });
  if (recentOrders.length >= 3) factors.push({ label: "Multiple orders within a short time", points: 16 });
  if (!order.customerName || !order.customerPhone || !order.shippingAddress) factors.push({ label: "Missing customer or delivery information", points: 14 });
  if (order.customer?.flagStatus === "WATCHLIST") factors.push({ label: "Customer is on watchlist", points: 20 });
  if (order.customer?.flagStatus === "BLOCKED") factors.push({ label: "Customer is blocked", points: 40 });

  const score = Math.min(100, factors.reduce((total, factor) => total + factor.points, 0));

  return {
    factors,
    level: riskLevelFromScore(score),
    score
  };
}

function riskLevelFromScore(score: number): RiskLevel {
  if (score > 70) return "HIGH";
  if (score > 30) return "MEDIUM";
  return "LOW";
}

function matchesFilter(level: RiskLevel, verificationStatus: string, filter: FakeOrderFilter) {
  if (filter === "all") return true;
  if (filter === "verified") return verificationStatus === "VERIFIED";
  return level.toLowerCase() === filter;
}

function matchesSearch(order: RiskOrder, search: string) {
  if (!search.trim()) return true;
  const query = search.toLowerCase();
  return [order.orderNumber, order.customerName, order.customerEmail, order.customerPhone]
    .some((value) => value?.toLowerCase().includes(query));
}

function uniqueBlockedCustomers(orders: RiskOrder[]) {
  return new Set(orders.filter((order) => order.customer?.flagStatus === "BLOCKED").map((order) => order.customerId ?? order.customerPhone)).size;
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function isCod(paymentMethodType: string) {
  return paymentMethodType === "COD";
}
