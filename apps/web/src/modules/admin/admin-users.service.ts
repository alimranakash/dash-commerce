import {
  deleteAdminUser,
  getAdminUserMetrics,
  getAdminUsers,
  setAdminUserRole,
  setAdminUserSuspended,
  type AdminUserRoleFilter,
  type AdminUserStatusFilter
} from "./admin-users.repository";

export { getAdminUserMetrics, getAdminUsers };
export type { AdminUserRoleFilter, AdminUserStatusFilter };

export async function makeUserAdmin(userId: string) {
  return setAdminUserRole(userId, "ADMIN");
}

export async function removeUserAdmin(currentAdminId: string, userId: string) {
  assertNotSelf(currentAdminId, userId, "You cannot remove your own admin role.");
  return setAdminUserRole(userId, "MEMBER");
}

export async function suspendAdminUser(currentAdminId: string, userId: string) {
  assertNotSelf(currentAdminId, userId, "You cannot suspend your own account.");
  return setAdminUserSuspended(userId, true);
}

export async function activateAdminUser(userId: string) {
  return setAdminUserSuspended(userId, false);
}

export async function removeAdminUser(currentAdminId: string, userId: string) {
  assertNotSelf(currentAdminId, userId, "You cannot delete your own account.");
  return deleteAdminUser(userId);
}

function assertNotSelf(currentAdminId: string, userId: string, message: string) {
  if (currentAdminId === userId) {
    throw new Error(message);
  }
}
