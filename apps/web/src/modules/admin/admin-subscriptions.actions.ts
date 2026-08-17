"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requirePlatformAdmin } from "./admin.auth";
import {
  activateSubscription,
  cancelSubscription,
  changeSubscriptionPlan,
  extendSubscriptionTrial,
  markSubscriptionPastDue,
  resumeSubscription
} from "./admin-subscriptions.service";

export type SubscriptionActionState = {
  fieldErrors?: Record<string, string>;
  message?: string;
  status: "idle" | "error" | "success";
};

export async function changeSubscriptionPlanAction(subscriptionId: string, _state: SubscriptionActionState, formData: FormData): Promise<SubscriptionActionState> {
  await requirePlatformAdmin();

  const startsAt = String(formData.get("startsAt") ?? "").trim();

  try {
    await changeSubscriptionPlan(subscriptionId, {
      billingCycle: String(formData.get("billingCycle") ?? "MONTHLY") as "MONTHLY" | "YEARLY",
      planId: String(formData.get("planId") ?? ""),
      ...(startsAt ? { startsAt: new Date(startsAt) } : {})
    });
  } catch (error) {
    return subscriptionErrorState(error);
  }

  revalidatePath("/admin/subscriptions");
  return {
    message: "Subscription plan updated.",
    status: "success"
  };
}

export async function extendSubscriptionTrialAction(subscriptionId: string, _state: SubscriptionActionState, formData: FormData): Promise<SubscriptionActionState> {
  await requirePlatformAdmin();

  try {
    await extendSubscriptionTrial(subscriptionId, {
      days: Number(formData.get("days") ?? 0)
    });
  } catch (error) {
    return subscriptionErrorState(error);
  }

  revalidatePath("/admin/subscriptions");
  return {
    message: "Trial extended.",
    status: "success"
  };
}

export async function activateSubscriptionAction(subscriptionId: string) {
  await requirePlatformAdmin();
  await activateSubscription(subscriptionId);
  revalidatePath("/admin/subscriptions");
}

export async function markSubscriptionPastDueAction(subscriptionId: string) {
  await requirePlatformAdmin();
  await markSubscriptionPastDue(subscriptionId);
  revalidatePath("/admin/subscriptions");
}

export async function cancelSubscriptionAction(subscriptionId: string) {
  await requirePlatformAdmin();
  await cancelSubscription(subscriptionId);
  revalidatePath("/admin/subscriptions");
}

export async function resumeSubscriptionAction(subscriptionId: string) {
  await requirePlatformAdmin();
  await resumeSubscription(subscriptionId);
  revalidatePath("/admin/subscriptions");
}

function subscriptionErrorState(error: unknown): SubscriptionActionState {
  if (error instanceof ZodError) {
    return {
      fieldErrors: Object.fromEntries(error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message])),
      message: "Please fix the highlighted subscription fields.",
      status: "error"
    };
  }

  return {
    message: error instanceof Error ? error.message : "Subscription operation failed.",
    status: "error"
  };
}
