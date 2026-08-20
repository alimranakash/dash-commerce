import {
  extendAdminSubscriptionTrial,
  getAdminSubscriptionMetrics,
  getAdminSubscriptionPlans,
  getAdminSubscriptions,
  updateAdminSubscriptionPlan,
  updateAdminSubscriptionSmsLimit,
  updateAdminSubscriptionStatus,
  type AdminSubscriptionBillingFilter,
  type AdminSubscriptionStatusFilter
} from "./admin-subscriptions.repository";
import { changeSubscriptionPlanSchema, extendTrialSchema, smsLimitOverrideSchema, type ChangeSubscriptionPlanInput, type ExtendTrialInput, type SmsLimitOverrideInput } from "./admin-subscriptions.schema";

export { getAdminSubscriptionMetrics, getAdminSubscriptionPlans, getAdminSubscriptions };
export type { AdminSubscriptionBillingFilter, AdminSubscriptionStatusFilter };

export async function changeSubscriptionPlan(subscriptionId: string, input: ChangeSubscriptionPlanInput) {
  const data = changeSubscriptionPlanSchema.parse(input);
  return updateAdminSubscriptionPlan(subscriptionId, data);
}

export async function setSubscriptionSmsLimit(subscriptionId: string, input: SmsLimitOverrideInput) {
  const data = smsLimitOverrideSchema.parse(input);

  return updateAdminSubscriptionSmsLimit(subscriptionId, data.smsLimitOverride);
}

export async function extendSubscriptionTrial(subscriptionId: string, input: ExtendTrialInput) {
  const data = extendTrialSchema.parse(input);
  return extendAdminSubscriptionTrial(subscriptionId, data.days);
}

export async function activateSubscription(subscriptionId: string) {
  return updateAdminSubscriptionStatus(subscriptionId, "ACTIVE");
}

export async function markSubscriptionPastDue(subscriptionId: string) {
  return updateAdminSubscriptionStatus(subscriptionId, "PAST_DUE");
}

export async function cancelSubscription(subscriptionId: string) {
  return updateAdminSubscriptionStatus(subscriptionId, "CANCELLED");
}

export async function resumeSubscription(subscriptionId: string) {
  return updateAdminSubscriptionStatus(subscriptionId, "ACTIVE");
}
