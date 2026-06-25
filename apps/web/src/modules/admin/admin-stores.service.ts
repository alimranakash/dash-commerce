import {
  getAdminStoreMetrics,
  getAdminStores,
  updateAdminStoreStatus,
  type AdminStoreStatusFilter
} from "./admin-stores.repository";

export { getAdminStoreMetrics, getAdminStores };
export type { AdminStoreStatusFilter };

export async function activateAdminStore(storeId: string) {
  return updateAdminStoreStatus(storeId, "ACTIVE");
}

export async function suspendAdminStore(storeId: string) {
  return updateAdminStoreStatus(storeId, "SUSPENDED");
}

export async function archiveAdminStore(storeId: string) {
  return updateAdminStoreStatus(storeId, "ARCHIVED");
}
