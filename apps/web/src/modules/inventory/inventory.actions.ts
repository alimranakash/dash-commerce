"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { PlanFeatureError, requirePlanFeature } from "../billing/subscription-limits";
import type { PlanFeatureKey } from "../billing/plan-features";
import { requireStore } from "../stores/queries";
import { adjustProductStock } from "./inventory.service";
import type { StockAdjustmentInput } from "./inventory.schema";

export type StockAdjustmentActionState = {
  lockedFeature?: PlanFeatureKey;
  fieldErrors?: Record<string, string>;
  message?: string;
  status: "idle" | "error";
};

const initialErrorMessage = "Please fix the highlighted stock adjustment fields.";

export async function adjustStockFormAction(
  _state: StockAdjustmentActionState,
  formData: FormData
): Promise<StockAdjustmentActionState> {
  const store = await requireStore();

  try {
    await requirePlanFeature(store.id, "inventory");
    await adjustProductStock(
      {
        organizationId: store.organizationId,
        storeId: store.id
      },
      stockAdjustmentInputFromFormData(formData)
    );
  } catch (error) {
    return stockAdjustmentErrorState(error);
  }

  revalidatePath("/dashboard/inventory");
  redirect("/dashboard/inventory?adjusted=1");
}

function stockAdjustmentInputFromFormData(formData: FormData): StockAdjustmentInput {
  return {
    adjustmentType: String(formData.get("adjustmentType") ?? "INCREASE") as StockAdjustmentInput["adjustmentType"],
    allowNegative: formData.get("allowNegative") === "on",
    notes: optionalValue(formData, "notes"),
    productId: getValue(formData, "productId"),
    quantity: Number(formData.get("quantity") ?? 0),
    reason: getValue(formData, "reason")
  };
}

function getValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalValue(formData: FormData, key: string) {
  const value = getValue(formData, key);

  return value || undefined;
}

function stockAdjustmentErrorState(error: unknown): StockAdjustmentActionState {
  if (error instanceof ZodError) {
    return {
      fieldErrors: Object.fromEntries(error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message])),
      message: initialErrorMessage,
      status: "error"
    };
  }

  return {
    message: error instanceof Error ? error.message : "Stock adjustment failed.",
    status: "error",
    ...(error instanceof PlanFeatureError ? { lockedFeature: error.featureKey } : {})
  };
}
