"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStore } from "../stores/queries";
import {
  blockOrderCustomer,
  markOrderFake,
  markOrderVerified,
  returnOrderToNormalQueue
} from "./fake-order.service";

export async function markOrderVerifiedAction(orderId: string) {
  const store = await requireStore();
  await markOrderVerified(store.id, orderId);
  revalidateFakeOrderPaths(orderId);
}

export async function markOrderFakeAction(orderId: string) {
  const store = await requireStore();
  await markOrderFake(store.id, orderId);
  revalidateFakeOrderPaths(orderId);
}

export async function blockCustomerAction(orderId: string) {
  const store = await requireStore();
  await blockOrderCustomer(store.id, orderId);
  revalidateFakeOrderPaths(orderId);
}

export async function returnToNormalQueueAction(orderId: string) {
  const store = await requireStore();
  await returnOrderToNormalQueue(store.id, orderId);
  revalidateFakeOrderPaths(orderId);
}

export async function markOrderVerifiedAndRedirectAction(orderId: string) {
  await markOrderVerifiedAction(orderId);
  redirect("/dashboard/orders/verification?updated=1");
}

export async function markOrderFakeAndRedirectAction(orderId: string) {
  await markOrderFakeAction(orderId);
  redirect("/dashboard/orders/verification?updated=1");
}

export async function blockCustomerAndRedirectAction(orderId: string) {
  await blockCustomerAction(orderId);
  redirect("/dashboard/orders/verification?updated=1");
}

export async function returnToNormalQueueAndRedirectAction(orderId: string) {
  await returnToNormalQueueAction(orderId);
  redirect("/dashboard/orders/verification?updated=1");
}

function revalidateFakeOrderPaths(orderId: string) {
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/orders/fake");
  revalidatePath("/dashboard/orders/verification");
  revalidatePath(`/dashboard/orders/fake/${orderId}`);
  revalidatePath(`/dashboard/orders/${orderId}`);
}
