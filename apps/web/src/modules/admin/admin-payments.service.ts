import {
  getAdminPaymentChartData,
  getAdminPaymentMetrics,
  getAdminPaymentRevenueSummary,
  getAdminPayments,
  updateAdminPaymentStatus,
  type AdminPaymentGatewayFilter,
  type AdminPaymentStatusFilter
} from "./admin-payments.repository";

export {
  getAdminPaymentChartData,
  getAdminPaymentMetrics,
  getAdminPaymentRevenueSummary,
  getAdminPayments
};
export type { AdminPaymentGatewayFilter, AdminPaymentStatusFilter };

export async function markPaymentPaid(paymentId: string) {
  return updateAdminPaymentStatus(paymentId, "PAID");
}

export async function markPaymentFailed(paymentId: string) {
  return updateAdminPaymentStatus(paymentId, "FAILED");
}
