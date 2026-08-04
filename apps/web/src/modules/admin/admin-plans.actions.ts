"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requirePlatformAdmin } from "./admin.auth";
import { createPlan, markPlanFeatured, removePlan, togglePlanActive, updatePlan } from "./admin-plans.service";
import type { PlanInput } from "./admin-plans.schema";

export type PlanActionState = {
  fieldErrors?: Record<string, string>;
  message?: string;
  status: "idle" | "error" | "success";
};

export async function createPlanAction(_state: PlanActionState, formData: FormData): Promise<PlanActionState> {
  await requirePlatformAdmin();

  try {
    await createPlan(planInputFromFormData(formData));
  } catch (error) {
    return planErrorState(error);
  }

  revalidatePath("/admin/plans");
  return {
    message: "Plan created.",
    status: "success"
  };
}

export async function updatePlanAction(planId: string, _state: PlanActionState, formData: FormData): Promise<PlanActionState> {
  await requirePlatformAdmin();

  try {
    await updatePlan(planId, planInputFromFormData(formData));
  } catch (error) {
    return planErrorState(error);
  }

  revalidatePath("/admin/plans");
  return {
    message: "Plan updated.",
    status: "success"
  };
}

export async function activatePlanAction(planId: string) {
  await requirePlatformAdmin();
  await togglePlanActive(planId, true);
  revalidatePath("/admin/plans");
}

export async function deactivatePlanAction(planId: string) {
  await requirePlatformAdmin();
  await togglePlanActive(planId, false);
  revalidatePath("/admin/plans");
}

export async function markPlanFeaturedAction(planId: string) {
  await requirePlatformAdmin();
  await markPlanFeatured(planId);
  revalidatePath("/admin/plans");
}

export async function deletePlanAction(planId: string) {
  await requirePlatformAdmin();

  try {
    await removePlan(planId);
  } catch {
    return {
      message: "This plan could not be deleted. Stores are still subscribed to it — deactivate the plan instead.",
      ok: false as const
    };
  }

  revalidatePath("/admin/plans");
  return {
    ok: true as const
  };
}

function planInputFromFormData(formData: FormData): PlanInput {
  return {
    aiEnabled: formData.get("aiEnabled") === "on",
    currency: getValue(formData, "currency"),
    customDomainEnabled: formData.get("customDomainEnabled") === "on",
    description: optionalValue(formData, "description"),
    isActive: formData.get("isActive") === "on",
    isFeatured: formData.get("isFeatured") === "on",
    name: getValue(formData, "name"),
    orderLimit: Number(formData.get("orderLimit") ?? 0),
    posEnabled: formData.get("posEnabled") === "on",
    priceMonthly: Number(formData.get("priceMonthly") ?? 0),
    priceYearly: Number(formData.get("priceYearly") ?? 0),
    productLimit: Number(formData.get("productLimit") ?? 0),
    slug: getValue(formData, "slug"),
    sortOrder: Number(formData.get("sortOrder") ?? 0),
    staffLimit: Number(formData.get("staffLimit") ?? 0),
    storeLimit: Number(formData.get("storeLimit") ?? 0),
    trialDays: Number(formData.get("trialDays") ?? 0)
  };
}

function getValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalValue(formData: FormData, key: string) {
  const value = getValue(formData, key);
  return value || undefined;
}

function planErrorState(error: unknown): PlanActionState {
  if (error instanceof ZodError) {
    return {
      fieldErrors: Object.fromEntries(error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message])),
      message: "Please fix the highlighted plan fields.",
      status: "error"
    };
  }

  return {
    message: error instanceof Error ? error.message : "Plan operation failed.",
    status: "error"
  };
}
