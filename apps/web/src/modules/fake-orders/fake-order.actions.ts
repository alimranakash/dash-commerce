"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasPlanFeature } from "../billing/subscription-limits";
import type { GatedResult } from "../billing/plan-features";
import { requireStore } from "../stores/queries";
import {
  blockOrderCustomer,
  markOrderFake,
  markOrderVerified,
  returnOrderToNormalQueue
} from "./fake-order.service";
import { setCourierVerificationRequired } from "./fake-order.verification";

export async function markOrderVerifiedAction(orderId: string): Promise<GatedResult> {
  const store = await requireStore();

  if (!(await hasPlanFeature(store.id, "fake_orders"))) {
    return { lockedFeature: "fake_orders" };
  }

  await markOrderVerified(store.id, orderId);
  revalidateFakeOrderPaths(orderId);

  return {};
}

export async function markOrderFakeAction(orderId: string): Promise<GatedResult> {
  const store = await requireStore();

  if (!(await hasPlanFeature(store.id, "fake_orders"))) {
    return { lockedFeature: "fake_orders" };
  }

  await markOrderFake(store.id, orderId);
  revalidateFakeOrderPaths(orderId);

  return {};
}

export async function blockCustomerAction(orderId: string): Promise<GatedResult> {
  const store = await requireStore();

  if (!(await hasPlanFeature(store.id, "fake_orders"))) {
    return { lockedFeature: "fake_orders" };
  }

  await blockOrderCustomer(store.id, orderId);
  revalidateFakeOrderPaths(orderId);

  return {};
}

export async function returnToNormalQueueAction(orderId: string): Promise<GatedResult> {
  const store = await requireStore();

  if (!(await hasPlanFeature(store.id, "fake_orders"))) {
    return { lockedFeature: "fake_orders" };
  }

  await returnOrderToNormalQueue(store.id, orderId);
  revalidateFakeOrderPaths(orderId);

  return {};
}

export async function markOrderVerifiedAndRedirectAction(orderId: string): Promise<GatedResult> {
  const result = await markOrderVerifiedAction(orderId);

  if (result.lockedFeature) {
    return result;
  }

  redirect("/dashboard/orders/verification?updated=1");
}

export async function markOrderFakeAndRedirectAction(orderId: string): Promise<GatedResult> {
  const result = await markOrderFakeAction(orderId);

  if (result.lockedFeature) {
    return result;
  }

  redirect("/dashboard/orders/verification?updated=1");
}

export async function blockCustomerAndRedirectAction(orderId: string): Promise<GatedResult> {
  const result = await blockCustomerAction(orderId);

  if (result.lockedFeature) {
    return result;
  }

  redirect("/dashboard/orders/verification?updated=1");
}

export async function returnToNormalQueueAndRedirectAction(orderId: string): Promise<GatedResult> {
  const result = await returnToNormalQueueAction(orderId);

  if (result.lockedFeature) {
    return result;
  }

  redirect("/dashboard/orders/verification?updated=1");
}

/**
 * Turns the courier gate on or off for this store. Off by default — a store that
 * never touches this keeps booking exactly as before.
 */
export async function setCourierVerificationRequiredAction(required: boolean): Promise<GatedResult> {
  const store = await requireStore();

  // This one drives the verification queue rather than fake-order triage.
  if (!(await hasPlanFeature(store.id, "order_verification"))) {
    return { lockedFeature: "order_verification" };
  }

  await setCourierVerificationRequired(store.id, required);

  revalidatePath("/dashboard/orders/verification");
  revalidatePath("/dashboard/orders");

  redirect(`/dashboard/orders/verification?policy=${required ? "on" : "off"}`);
}

function revalidateFakeOrderPaths(orderId: string) {
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/orders/fake");
  revalidatePath("/dashboard/orders/verification");
  revalidatePath(`/dashboard/orders/fake/${orderId}`);
  revalidatePath(`/dashboard/orders/${orderId}`);
}
