"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireStore } from "../stores/queries";
import {
  advanceOrderReturnStatus,
  createOrderReturn,
  deleteOrderReturn,
  recordOrderReturnRefund
} from "./return.service";
import type {
  CreateOrderReturnInput,
  OrderReturnStatus,
  RecordOrderReturnRefundInput
} from "./return.schema";

export type OrderReturnActionState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

/**
 * Opens a return, exchange or refund.
 *
 * Returns an error state rather than redirecting on failure, for the same reason
 * the order forms do: "only 2 of that shirt are still open for a return" has to
 * come back to a form the seller has already filled in, not to an error page.
 */
export async function createOrderReturnFormAction(
  _state: OrderReturnActionState,
  formData: FormData
): Promise<OrderReturnActionState> {
  const store = await requireStore();
  let createdId: string;
  let orderId: string;

  try {
    const created = await createOrderReturn(store, returnFromFormData(formData));

    createdId = created.id;
    orderId = created.orderId;
  } catch (error) {
    return errorState(error, "Could not open this request.");
  }

  revalidateReturnPaths(orderId);
  redirect(`/dashboard/orders/returns/${createdId}?created=1`);
}

/**
 * One step of the workflow — approve, reject, mark coming back, mark received,
 * settle, cancel.
 *
 * A refused move is a sentence the seller needs to read ("mark the goods received
 * before settling this request", "not enough stock for this exchange"), so it
 * comes back on the request page as a message rather than as a thrown error.
 */
export async function advanceOrderReturnStatusFormAction(
  returnId: string,
  next: OrderReturnStatus
) {
  const store = await requireStore();
  let message: string | null = null;
  let orderId: string | null = null;

  try {
    orderId = await advanceOrderReturnStatus(store, returnId, next);
  } catch (error) {
    message = error instanceof Error ? error.message : "Could not update this request.";
  }

  revalidateReturnPaths(orderId);
  redirect(
    message
      ? `/dashboard/orders/returns/${returnId}?error=${encodeURIComponent(message)}`
      : `/dashboard/orders/returns/${returnId}?updated=1`
  );
}

export async function recordOrderReturnRefundFormAction(
  returnId: string,
  _state: OrderReturnActionState,
  formData: FormData
): Promise<OrderReturnActionState> {
  const store = await requireStore();
  let orderId: string;

  try {
    orderId = await recordOrderReturnRefund(store, returnId, refundFromFormData(formData));
  } catch (error) {
    return errorState(error, "Could not record this refund.");
  }

  revalidateReturnPaths(orderId);
  redirect(`/dashboard/orders/returns/${returnId}?updated=1`);
}

export async function deleteOrderReturnFormAction(returnId: string) {
  const store = await requireStore();
  let message: string | null = null;

  try {
    await deleteOrderReturn(store.id, returnId);
  } catch (error) {
    message = error instanceof Error ? error.message : "Could not delete this request.";
  }

  revalidateReturnPaths(null);

  if (message) {
    redirect(`/dashboard/orders/returns/${returnId}?error=${encodeURIComponent(message)}`);
  }

  redirect("/dashboard/orders/returns?deleted=1");
}

function returnFromFormData(formData: FormData): CreateOrderReturnInput {
  return {
    flatRefundAmount: optionalValue(formData, "flatRefundAmount"),
    items: returnLinesFromFormData(formData),
    orderId: getValue(formData, "orderId"),
    reason: getValue(formData, "reason") as CreateOrderReturnInput["reason"],
    reasonNote: optionalValue(formData, "reasonNote"),
    refundMethod: getValue(formData, "refundMethod") as CreateOrderReturnInput["refundMethod"],
    restockingFee: optionalValue(formData, "restockingFee"),
    restockItems: formData.get("restockItems") === "on",
    shippingRefundAmount: optionalValue(formData, "shippingRefundAmount"),
    type: getValue(formData, "type") as CreateOrderReturnInput["type"]
  };
}

/**
 * The lines arrive as one JSON field rather than as indexed inputs, for the same
 * reason the manual order form posts its basket that way: rows are added and
 * removed in the browser, and `items[2][quantity]` names would have to be
 * renumbered on every removal. Nothing here is trusted — every line is re-read
 * against the order in the service.
 */
function returnLinesFromFormData(formData: FormData): CreateOrderReturnInput["items"] {
  try {
    const parsed: unknown = JSON.parse(String(formData.get("items") ?? "[]"));

    return Array.isArray(parsed) ? (parsed as CreateOrderReturnInput["items"]) : [];
  } catch {
    return [];
  }
}

function refundFromFormData(formData: FormData): RecordOrderReturnRefundInput {
  return {
    refundMethod: getValue(
      formData,
      "refundMethod"
    ) as RecordOrderReturnRefundInput["refundMethod"],
    refundReference: optionalValue(formData, "refundReference"),
    resolutionNote: optionalValue(formData, "resolutionNote")
  };
}

function errorState(error: unknown, fallback: string): OrderReturnActionState {
  if (error instanceof ZodError) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: Object.fromEntries(
        error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message])
      )
    };
  }

  return {
    status: "error",
    message: error instanceof Error ? error.message : fallback
  };
}

function getValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalValue(formData: FormData, key: string) {
  const value = getValue(formData, key);

  return value || undefined;
}

function revalidateReturnPaths(orderId: string | null) {
  revalidatePath("/dashboard/orders/returns");
  revalidatePath("/dashboard/orders/exchanges");
  revalidatePath("/dashboard/orders/refunds");
  revalidatePath("/dashboard/orders");
  // Settling a request moves stock and can flip the order to refunded, so the
  // pages that read either are now stale.
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/reports");

  if (orderId) {
    revalidatePath(`/dashboard/orders/${orderId}`);
  }
}
