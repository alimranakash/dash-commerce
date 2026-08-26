"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireStore } from "../stores/queries";
import { saveOrderBump } from "./order-bump.service";
import type { OrderBumpDiscountType } from "./order-bump.schema";

export type OrderBumpActionState = {
  fieldErrors?: Record<string, string>;
  message?: string;
  status: "error" | "idle" | "saved";
};

export async function saveOrderBumpFormAction(
  _state: OrderBumpActionState,
  formData: FormData
): Promise<OrderBumpActionState> {
  const store = await requireStore();

  try {
    await saveOrderBump(store.id, {
      description: getValue(formData, "description"),
      discountType: getValue(formData, "discountType") as OrderBumpDiscountType,
      discountValue: getValue(formData, "discountValue"),
      // The box is always rendered, so nothing posted can only mean off.
      enabled: formData.get("enabled") === "on",
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
