"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@dash/db";
import { requireStore } from "../stores/queries";

type OrderStatusUpdate = "CANCELLED" | "COMPLETED" | "PROCESSING";
type PaymentStatusUpdate = "PAID";

export async function updateOrderStatusFormAction(orderId: string, status: OrderStatusUpdate) {
  const store = await requireStore();

  await prisma.order.updateMany({
    where: {
      id: orderId,
      storeId: store.id
    },
    data: {
      fulfillmentStatus: status === "COMPLETED" ? "FULFILLED" : status === "CANCELLED" ? "RETURNED" : "UNFULFILLED",
      status
    }
  });

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${orderId}`);
  redirect(`/dashboard/orders/${orderId}?updated=1`);
}

export async function updatePaymentStatusFormAction(orderId: string, status: PaymentStatusUpdate) {
  const store = await requireStore();

  await prisma.order.updateMany({
    where: {
      id: orderId,
      storeId: store.id
    },
    data: {
      paymentStatus: status
    }
  });

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${orderId}`);
  redirect(`/dashboard/orders/${orderId}?updated=1`);
}
