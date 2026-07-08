"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStore } from "../stores/queries";
import {
  reinstallDemoPackForStore,
  removeDemoContentForStore,
  resetDemoContentForStore
} from "./manager.service";

export async function reinstallDemoPackAction() {
  const store = await requireStore();
  await reinstallDemoPackForStore(store.id, store.organizationId);
  revalidateDemoContentPaths();
  redirect("/dashboard/settings/demo-content?demoContent=reinstalled");
}

export async function resetDemoContentAction() {
  const store = await requireStore();
  await resetDemoContentForStore(store.id, store.organizationId);
  revalidateDemoContentPaths();
  redirect("/dashboard/settings/demo-content?demoContent=reset");
}

export async function removeDemoContentAction() {
  const store = await requireStore();
  await removeDemoContentForStore(store.id);
  revalidateDemoContentPaths();
  redirect("/dashboard/settings/demo-content?demoContent=removed");
}

function revalidateDemoContentPaths() {
  revalidatePath("/dashboard/settings/demo-content");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/categories");
}
