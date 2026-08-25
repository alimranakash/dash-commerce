"use server";

import { revalidatePath } from "next/cache";
import { hasPlanFeature } from "../billing/subscription-limits";
import { requireStore } from "../stores/queries";
import {
  markAbandonedCartContacted,
  markAbandonedCartRecoveredManually
} from "./abandoned-cart.service";
import type { AbandonedCartOutreachChannel } from "./abandoned-cart.types";
import type { PlanFeatureKey } from "../billing/plan-features";

/**
 * `locked` is returned rather than thrown so the dashboard can tell "your plan
 * does not include this" apart from "the save failed", and show an upgrade
 * dialog instead of a generic retry notice.
 */
export type AbandonedCartActionResult =
  | { feature: PlanFeatureKey; status: "locked" }
  | { status: "ok" };

export async function markAbandonedCartContactedAction(
  cartId: string,
  channel: AbandonedCartOutreachChannel = "manual"
): Promise<AbandonedCartActionResult> {
  const store = await requireStore();

  // Free plans can browse abandoned carts but cannot work them — the recovery
  // actions are the paid part of the feature.
  if (!(await hasPlanFeature(store.id, "abandoned_cart"))) {
    return { feature: "abandoned_cart", status: "locked" };
  }

  await markAbandonedCartContacted(store.id, { cartId, channel });

  revalidateAbandonedCartPaths();

  return { status: "ok" };
}

export async function markAbandonedCartRecoveredAction(
  cartId: string
): Promise<AbandonedCartActionResult> {
  const store = await requireStore();

  if (!(await hasPlanFeature(store.id, "abandoned_cart"))) {
    return { feature: "abandoned_cart", status: "locked" };
  }

  await markAbandonedCartRecoveredManually(store.id, { cartId });

  revalidateAbandonedCartPaths();

  return { status: "ok" };
}

function revalidateAbandonedCartPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/abandoned-cart");
  // The same rows, read through a different filter — both lists go stale on
  // every status change, whichever page the seller made it from.
  revalidatePath("/dashboard/orders/incomplete");
  revalidatePath("/dashboard/reports/abandoned-carts");
}
