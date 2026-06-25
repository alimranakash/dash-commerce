"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "./admin.auth";
import { activateAdminStore, archiveAdminStore, suspendAdminStore } from "./admin-stores.service";

export async function activateAdminStoreAction(storeId: string) {
  await requirePlatformAdmin();
  await activateAdminStore(storeId);
  revalidatePath("/admin/stores");
}

export async function suspendAdminStoreAction(storeId: string) {
  await requirePlatformAdmin();
  await suspendAdminStore(storeId);
  revalidatePath("/admin/stores");
}

export async function archiveAdminStoreAction(storeId: string) {
  await requirePlatformAdmin();
  await archiveAdminStore(storeId);
  revalidatePath("/admin/stores");
}
