"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStore } from "../stores/queries";
import { updateOrderPaymentStatus, updateOrderStatus } from "./order.service";

type OrderStatusUpdate = "CANCELLED" | "COMPLETED" | "PROCESSING";
type PaymentStatusUpdate = "PAID";

export async function updateOrderStatusFormAction(orderId: string, status: OrderStatusUpdate) {
  const store = await requireStore();

  await updateOrderStatus(store.id, orderId, status);

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
