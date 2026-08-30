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

/**
 * The two surfaces these actions serve. A cart that was never carried into
 * checkout is Abandoned Carts; a checkout that was filled in and never placed is
 * Incomplete Orders. Same rows, same recovery actions, two line items on the
 * pricing page — so the caller says which one it is speaking for and the gate
 * asks about that feature.
 */
export type CartRecoverySurface = "abandoned_cart" | "incomplete_orders";

const CART_RECOVERY_SURFACES: ReadonlySet<string> = new Set([
  "abandoned_cart",
  "incomplete_orders"
]);

/**
 * The surface argument crosses the server-action boundary, so it is a string
 * from the network however it is typed here. Anything unrecognised falls back to
 * `abandoned_cart` rather than being trusted, which keeps a crafted request from
 * naming some unrelated feature the store happens to be entitled to and getting
 * a recovery write out of it.
 */
function gateFeature(surface: CartRecoverySurface): CartRecoverySurface {
  return CART_RECOVERY_SURFACES.has(surface) ? surface : "abandoned_cart";
}

export async function markAbandonedCartContactedAction(
  cartId: string,
  channel: AbandonedCartOutreachChannel = "manual",
  surface: CartRecoverySurface = "abandoned_cart"
): Promise<AbandonedCartActionResult> {
  const store = await requireStore();
  const feature = gateFeature(surface);

  // Free plans can browse these lists but cannot work them — the recovery
  // actions are the paid part of the feature.
  if (!(await hasPlanFeature(store.id, feature))) {
    return { feature, status: "locked" };
  }

  await markAbandonedCartContacted(store.id, { cartId, channel });

  revalidateAbandonedCartPaths();

  return { status: "ok" };
}

export async function markAbandonedCartRecoveredAction(
  cartId: string,
  surface: CartRecoverySurface = "abandoned_cart"
): Promise<AbandonedCartActionResult> {
  const store = await requireStore();
  const feature = gateFeature(surface);

  if (!(await hasPlanFeature(store.id, feature))) {
    return { feature, status: "locked" };
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
