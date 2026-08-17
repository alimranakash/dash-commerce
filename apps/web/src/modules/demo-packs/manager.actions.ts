"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStoreManager } from "../stores/queries";
import {
  reinstallDemoPackForStore,
  removeDemoContentForStore,
  resetDemoContentForStore
} from "./manager.service";

/**
 * All three wipe or replace the whole demo catalog, so they are manager-only.
 * These actions carry no error state — any failure has always surfaced as a
 * thrown error — so the guard throwing is consistent with what was already
 * there. The page hides the buttons from members; this is the backstop.
 */
export async function reinstallDemoPackAction() {
  const { store } = await requireStoreManager();
  await reinstallDemoPackForStore(store.id, store.organizationId);
  revalidateDemoContentPaths();
  redirect("/dashboard/storefront/demo-content?demoContent=reinstalled");
}

export async function resetDemoContentAction() {
  const { store } = await requireStoreManager();
  await resetDemoContentForStore(store.id, store.organizationId);
  revalidateDemoContentPaths();
  redirect("/dashboard/storefront/demo-content?demoContent=reset");
}

export async function removeDemoContentAction() {
  const { store } = await requireStoreManager();
  await removeDemoContentForStore(store.id);
  revalidateDemoContentPaths();
  redirect("/dashboard/storefront/demo-content?demoContent=removed");
}

function revalidateDemoContentPaths() {
  revalidatePath("/dashboard/storefront/demo-content");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/categories");
}
