import type { Prisma } from "@dash/db";
import {
  createManualSubscriptionPayment,
  findDuplicateManualPayment,
  getActiveBillingPlans,
  getBillingSettingsRecord,
  getBillingStoreUsage,
  getOrCreateStoreSubscription,
  updateBillingSettingsRecord
} from "./billing.repository";
import {
  billingSettingsSchema,
  submitManualPaymentSchema,
  type BillingSettingsInput,
  type SubmitManualPaymentInput
} from "./billing.schema";

export async function getBillingDashboardData(store: { id: string; organizationId: string }) {
  const [plans, subscription, billingSettings, usage] = await Promise.all([
    getActiveBillingPlans(),
    getOrCreateStoreSubscription({
      organizationId: store.organizationId,
      storeId: store.id
    }),
    getBillingSettingsRecord(),
    getBillingStoreUsage(store.id)
  ]);

  return {
    billingSettings,
    plans,
    subscription: normalizeSubscriptionStatus(subscription),
    usage
  };
}

export async function submitManualSubscriptionPayment(
  store: {
    currency: string;
    id: string;
    organizationId: string;
  },
  input: SubmitManualPaymentInput
) {
  const data = submitManualPaymentSchema.parse(input);
  const plans = await getActiveBillingPlans();
  const selectedPlan = plans.find((plan) => plan.id === data.planId);

  if (!selectedPlan) {
    throw new Error("Selected plan is not available.");
  }

  const expectedAmount = getPlanPrice(selectedPlan, data.billingCycle);

  if (!Number.isFinite(Number(expectedAmount)) || Number(expectedAmount) <= 0) {
    throw new Error("Payment amount could not be verified. Please refresh and try again.");
  }

  const duplicate = await findDuplicateManualPayment(store.id, data.paymentReference);

  if (duplicate) {
    throw new Error("This transaction ID is already submitted.");
  }

  return createManualSubscriptionPayment({
    amount: expectedAmount,
    billingCycle: data.billingCycle,
    currency: selectedPlan.currency || store.currency,
    organizationId: store.organizationId,
    paymentMethod: data.paymentMethod,
    paymentNote: data.paymentNote,
    paymentReference: data.paymentReference,
    planId: selectedPlan.id,
    senderNumber: data.senderNumber,
    storeId: store.id
  });
}

export async function getBillingSettings() {
  return getBillingSettingsRecord();
}

export async function updateBillingSettings(input: BillingSettingsInput) {
  return updateBillingSettingsRecord(billingSettingsSchema.parse(input));
}

export function getPlanPrice(plan: Plan, billingCycle: "MONTHLY" | "YEARLY") {
  return (billingCycle === "YEARLY" ? plan.priceYearly : plan.priceMonthly).toString();
}

export function getTrialRemaining(subscription: { trialEndsAt: Date | null }) {
  if (!subscription.trialEndsAt) {
    return null;
  }

  const diff = subscription.trialEndsAt.getTime() - Date.now();

  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function normalizeSubscriptionStatus<T extends SubscriptionWithPlan>(subscription: T) {
  if (
    subscription.currentPeriodEndsAt &&
    subscription.currentPeriodEndsAt < new Date() &&
    subscription.status === "ACTIVE"
  ) {
    return {
      ...subscription,
      status: "PAST_DUE" as const
    };
  }

  return subscription;
}

type Plan = Prisma.PlanGetPayload<Record<string, never>>;
type SubscriptionWithPlan = Prisma.SubscriptionGetPayload<{
  include: {
    plan: true;
  };
}>;
