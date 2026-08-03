"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireStore } from "../stores/queries";
import { cancelPurchase, createPurchase, markPurchaseReceived, updatePurchase } from "./purchase.service";
import type { CreatePurchaseInput } from "./purchase.schema";

export type PurchaseActionState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export async function createPurchaseFormAction(
  _state: PurchaseActionState,
  formData: FormData
): Promise<PurchaseActionState> {
  const store = await requireStore();
  const context = { organizationId: store.organizationId, storeId: store.id };

  try {
    await createPurchase(context, purchaseInputFromFormData(formData));
  } catch (error) {
    return purchaseErrorState(error);
  }

  revalidatePath("/dashboard/purchases");
  revalidatePath("/dashboard/products");
  redirect("/dashboard/purchases?created=1");
}

export async function updatePurchaseFormAction(
  purchaseId: string,
  _state: PurchaseActionState,
  formData: FormData
): Promise<PurchaseActionState> {
  const store = await requireStore();
  const context = { organizationId: store.organizationId, storeId: store.id };

  try {
    const purchase = await updatePurchase(context, purchaseId, purchaseInputFromFormData(formData));

    if (!purchase) {
      return {
        status: "error",
        message: "Purchase not found."
      };
    }
  } catch (error) {
    return purchaseErrorState(error);
  }

  revalidatePath("/dashboard/purchases");
  revalidatePath(`/dashboard/purchases/${purchaseId}`);
  revalidatePath("/dashboard/products");
  redirect(`/dashboard/purchases/${purchaseId}?updated=1`);
}

export async function markPurchaseReceivedAction(purchaseId: string) {
  const store = await requireStore();
  await markPurchaseReceived({ organizationId: store.organizationId, storeId: store.id }, purchaseId);

  revalidatePath("/dashboard/purchases");
  revalidatePath(`/dashboard/purchases/${purchaseId}`);
  revalidatePath("/dashboard/products");
  redirect(`/dashboard/purchases/${purchaseId}?received=1`);
}

export async function cancelPurchaseAction(purchaseId: string) {
  const store = await requireStore();
  await cancelPurchase({ organizationId: store.organizationId, storeId: store.id }, purchaseId);

  revalidatePath("/dashboard/purchases");
  revalidatePath(`/dashboard/purchases/${purchaseId}`);
  redirect("/dashboard/purchases?cancelled=1");
}

function purchaseInputFromFormData(formData: FormData): CreatePurchaseInput {
  const productIds = formData.getAll("productId").map(stringValue);
  const productNames = formData.getAll("productName").map(stringValue);
  const skus = formData.getAll("sku").map(stringValue);
  const quantities = formData.getAll("quantity").map(stringValue);
  const unitCosts = formData.getAll("unitCost").map(stringValue);
  const rowCount = Math.max(productIds.length, productNames.length, quantities.length, unitCosts.length);

  return {
    supplierId: stringValue(formData.get("supplierId")),
    purchaseDate: stringValue(formData.get("purchaseDate")),
    status: stringValue(formData.get("status")) as CreatePurchaseInput["status"],
    discountAmount: stringValue(formData.get("discountAmount")) || "0",
    taxAmount: stringValue(formData.get("taxAmount")) || "0",
    paidAmount: stringValue(formData.get("paidAmount")) || "0",
    notes: optionalValue(formData.get("notes")),
    items: Array.from({ length: rowCount }, (_, index) => ({
      productId: optionalValue(productIds[index]),
      productName: optionalValue(productNames[index]),
      sku: optionalValue(skus[index]),
      quantity: Number(quantities[index] || 1),
      unitCost: unitCosts[index] || "0"
    })).filter((item) => item.productId || item.productName)
  };
}

function stringValue(value: FormDataEntryValue | null | undefined) {
  return String(value ?? "").trim();
}

function optionalValue(value: FormDataEntryValue | string | null | undefined) {
  const next = String(value ?? "").trim();
  return next || undefined;
}

function purchaseErrorState(error: unknown): PurchaseActionState {
  if (error instanceof ZodError) {
    const fieldErrors = Object.fromEntries(
      error.issues.map((issue) => [issue.path.length ? String(issue.path[0]) : "form", issue.message])
    );

    return {
      status: "error",
      message: fieldErrors.items ?? "Please fix the highlighted purchase fields.",
      fieldErrors
    };
  }

  return {
    status: "error",
    message: error instanceof Error ? error.message : "Purchase operation failed."
  };
}
