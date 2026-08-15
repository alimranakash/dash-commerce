"use server";

import { revalidatePath } from "next/cache";
import { requireStore } from "../stores/queries";
import {
  markAbandonedCartContacted,
  markAbandonedCartRecoveredManually
} from "./abandoned-cart.service";
import type { AbandonedCartOutreachChannel } from "./abandoned-cart.types";

export async function markAbandonedCartContactedAction(
  cartId: string,
  channel: AbandonedCartOutreachChannel = "manual"
) {
  const store = await requireStore();

  await markAbandonedCartContacted(store.id, { cartId, channel });

  revalidateAbandonedCartPaths();
}

export async function markAbandonedCartRecoveredAction(cartId: string) {
  const store = await requireStore();

  await markAbandonedCartRecoveredManually(store.id, { cartId });

  revalidateAbandonedCartPaths();
}

function revalidateAbandonedCartPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/abandoned-cart");
  revalidatePath("/dashboard/reports/abandoned-carts");
}
