"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireStore } from "../stores/queries";
import { createSale, updateSale, voidSale } from "./sale.service";
import type { CreateSaleInput } from "./sale.schema";

export type SaleActionState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export async function createSaleFormAction(
  _state: SaleActionState,
  formData: FormData
): Promise<SaleActionState> {
  const store = await requireStore();

  try {
    await createSale(contextFromStore(store), saleInputFromFormData(formData));
  } catch (error) {
    return saleErrorState(error);
  }

  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/products");
  redirect("/dashboard/sales?created=1");
}

export async function updateSaleFormAction(
  saleId: string,
  _state: SaleActionState,
  formData: FormData
): Promise<SaleActionState> {
  const store = await requireStore();

  try {
    const sale = await updateSale(contextFromStore(store), saleId, saleInputFromFormData(formData));

    if (!sale) {
      return { message: "Sale not found.", status: "error" };
    }
  } catch (error) {
    return saleErrorState(error);
  }

  revalidatePath("/dashboard/sales");
  revalidatePath(`/dashboard/sales/${saleId}`);
  revalidatePath("/dashboard/products");
  redirect(`/dashboard/sales/${saleId}?updated=1`);
}

export async function voidSaleAction(saleId: string) {
  const store = await requireStore();
  await voidSale(contextFromStore(store), saleId);

  revalidatePath("/dashboard/sales");
  revalidatePath(`/dashboard/sales/${saleId}`);
  revalidatePath("/dashboard/products");
  redirect("/dashboard/sales?voided=1");
}

function saleInputFromFormData(formData: FormData): CreateSaleInput {
  const productIds = formData.getAll("productId").map(stringValue);
  const quantities = formData.getAll("quantity").map(stringValue);
  const unitPrices = formData.getAll("unitPrice").map(stringValue);
  const discounts = formData.getAll("itemDiscount").map(stringValue);
  const rowCount = Math.max(productIds.length, quantities.length, unitPrices.length);

  return {
    customerId: optionalValue(formData.get("customerId")),
    discount: stringValue(formData.get("discount")) || "0",
    items: Array.from({ length: rowCount }, (_, index) => ({
      discount: discounts[index] || "0",
      productId: productIds[index] ?? "",
      quantity: Number(quantities[index] || 1),
      unitPrice: unitPrices[index] || "0"
    })).filter((item) => item.productId),
    notes: optionalValue(formData.get("notes")),
    paidAmount: stringValue(formData.get("paidAmount")) || "0",
    paymentMethod: stringValue(formData.get("paymentMethod")) as CreateSaleInput["paymentMethod"],
    saleDate: stringValue(formData.get("saleDate")),
    saleType: stringValue(formData.get("saleType")) as CreateSaleInput["saleType"],
    shipping: stringValue(formData.get("shipping")) || "0",
    status: stringValue(formData.get("status")) as CreateSaleInput["status"],
    tax: stringValue(formData.get("tax")) || "0"
  };
}

function contextFromStore(store: { id: string; organizationId: string }) {
  return {
    organizationId: store.organizationId,
    storeId: store.id
  };
}

function stringValue(value: FormDataEntryValue | null | undefined) {
  return String(value ?? "").trim();
}

function optionalValue(value: FormDataEntryValue | null | undefined) {
  const next = stringValue(value);
  return next || undefined;
}

function saleErrorState(error: unknown): SaleActionState {
  if (error instanceof ZodError) {
    return {
      fieldErrors: Object.fromEntries(
        error.issues.map((issue) => [issue.path.length ? String(issue.path[0]) : "form", issue.message])
      ),
      message: "Please fix the highlighted sale fields.",
      status: "error"
    };
  }

  return {
    message: error instanceof Error ? error.message : "Sale operation failed.",
    status: "error"
  };
}
