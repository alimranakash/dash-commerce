"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStore } from "../stores/queries";
import type { FulfillmentStatus } from "./order.repository";
import {
  updateOrderFulfillmentStatus,
  updateOrderPaymentStatus,
  updateOrderStatus
} from "./order.service";

type OrderStatusUpdate = "CANCELLED" | "COMPLETED" | "PROCESSING";
type PaymentStatusUpdate = "PAID";

export async function updateOrderStatusFormAction(orderId: string, status: OrderStatusUpdate) {
  const store = await requireStore();

  await updateOrderStatus(store.id, orderId, status);

  revalidateOrderPaths(orderId);
  redirect(`/dashboard/orders/${orderId}?updated=1`);
}

/**
 * The seller's explicit fulfillment override.
 *
 * Phase 0 stopped deriving fulfillmentStatus from the order-status buttons, and
 * the courier layer only projects it from a shipment in Phase 2 — so until then
 * this is how an order gets marked fulfilled without claiming a delivery that
 * no carrier confirmed.
 */
export async function updateFulfillmentStatusFormAction(
  orderId: string,
  fulfillmentStatus: FulfillmentStatus
) {
  const store = await requireStore();

  await updateOrderFulfillmentStatus(store.id, orderId, fulfillmentStatus);

  revalidateOrderPaths(orderId);
  redirect(`/dashboard/orders/${orderId}?updated=1`);
}

export async function updatePaymentStatusFormAction(orderId: string, status: PaymentStatusUpdate) {
  const store = await requireStore();

  await updateOrderPaymentStatus(store.id, orderId, status);

  revalidateOrderPaths(orderId);
  redirect(`/dashboard/orders/${orderId}?updated=1`);
}

function revalidateOrderPaths(orderId: string) {
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/transactions");
  revalidatePath(`/dashboard/orders/${orderId}`);
}
