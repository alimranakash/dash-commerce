"use server";

import { revalidatePath } from "next/cache";
import { createSystemLog } from "../../lib/system-log";
import { requirePlatformAdmin } from "./admin.auth";
import { activateAdminStore, archiveAdminStore, suspendAdminStore } from "./admin-stores.service";

export async function activateAdminStoreAction(storeId: string) {
  const admin = await requirePlatformAdmin();
  const store = await activateAdminStore(storeId);
  await logStoreAction(admin.id, store, "Activated store");
  revalidatePath("/admin/stores");
}

export async function suspendAdminStoreAction(storeId: string) {
  const admin = await requirePlatformAdmin();
  const store = await suspendAdminStore(storeId);
  await logStoreAction(admin.id, store, "Suspended store");
  revalidatePath("/admin/stores");
}

export async function archiveAdminStoreAction(storeId: string) {
  const admin = await requirePlatformAdmin();
  const store = await archiveAdminStore(storeId);
  await logStoreAction(admin.id, store, "Archived store");
  revalidatePath("/admin/stores");
}

async function logStoreAction(
  adminId: string,
  store: { id: string; name: string; organizationId: string },
  message: string
) {
  await createSystemLog({
    level: "INFO",
    message: `${message}: ${store.name}`,
    organizationId: store.organizationId,
    source: "STORE",
    storeId: store.id,
    userId: adminId
  });
}
