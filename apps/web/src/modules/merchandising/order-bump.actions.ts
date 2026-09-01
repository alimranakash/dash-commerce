"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import type { PlanFeatureKey } from "../billing/plan-features";
import { PlanFeatureError, requirePlanFeature } from "../billing/subscription-limits";
import { requireStore } from "../stores/queries";
import { saveOrderBump } from "./order-bump.service";
import type { OrderBumpDiscountType } from "./order-bump.schema";

export type OrderBumpActionState = {
  fieldErrors?: Record<string, string>;
  /** Set when the plan refused the write, so the form can open the upgrade dialog. */
  lockedFeature?: PlanFeatureKey;
  message?: string;
  status: "error" | "idle" | "saved";
};

export async function saveOrderBumpFormAction(
  _state: OrderBumpActionState,
  formData: FormData
): Promise<OrderBumpActionState> {
  const store = await requireStore();
  // The box is always rendered, so nothing posted can only mean off.
  const enabled = formData.get("enabled") === "on";

  try {
    // Order Bump is a Starter feature. Saving the offer switched *off* stays
    // open on any plan: the offer is live on the checkout the customer is
    // looking at right now, and a lapsed store must be able to pull it.
    if (enabled) {
      await requirePlanFeature(store.id, "order_bump");
    }

    await saveOrderBump(store.id, {
      description: getValue(formData, "description"),
      discountType: getValue(formData, "discountType") as OrderBumpDiscountType,
      discountValue: getValue(formData, "discountValue"),
      enabled,
      headline: getValue(formData, "headline"),
      productId: getValue(formData, "productId")
    });
  } catch (error) {
    return orderBumpErrorState(error);
  }

  // The offer is read on every checkout render, so the storefront pages that
  // carry it have to be let go of too.
  revalidatePath("/dashboard/marketing/order-bump");
  revalidatePath(`/s/${store.slug}/checkout`);

  return { status: "saved" };
}

function getValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function orderBumpErrorState(error: unknown): OrderBumpActionState {
  // Carried as a key so the form opens the shared upgrade dialog rather than
  // printing the refusal as though it were a field the seller could fix.
  if (error instanceof PlanFeatureError) {
    return { lockedFeature: error.featureKey, message: error.message, status: "error" };
  }

  if (error instanceof ZodError) {
    return {
      fieldErrors: Object.fromEntries(
        error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message])
      ),
      message: "Please fix the highlighted fields.",
      status: "error"
    };
  }

  return {
    message: error instanceof Error ? error.message : "The offer could not be saved.",
    status: "error"
  };
}
