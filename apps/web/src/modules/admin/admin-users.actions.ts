"use server";

import { revalidatePath } from "next/cache";
import { createSystemLog } from "../../lib/system-log";
import { requirePlatformAdmin } from "./admin.auth";
import {
  activateAdminUser,
  makeUserAdmin,
  removeAdminUser,
  removeUserAdmin,
  suspendAdminUser
} from "./admin-users.service";

export async function makeUserAdminAction(userId: string) {
  const admin = await requirePlatformAdmin();
  await makeUserAdmin(userId);
  await logUserAction(admin.id, userId, "Granted platform admin role");
  revalidatePath("/admin/users");
}

export async function removeUserAdminAction(userId: string) {
  const admin = await requirePlatformAdmin();
  await removeUserAdmin(admin.id, userId);
  await logUserAction(admin.id, userId, "Removed platform admin role");
  revalidatePath("/admin/users");
}

export async function suspendAdminUserAction(userId: string) {
  const admin = await requirePlatformAdmin();
  await suspendAdminUser(admin.id, userId);
  await logUserAction(admin.id, userId, "Suspended user account");
  revalidatePath("/admin/users");
}

export async function activateAdminUserAction(userId: string) {
  const admin = await requirePlatformAdmin();
  await activateAdminUser(userId);
  await logUserAction(admin.id, userId, "Activated user account");
  revalidatePath("/admin/users");
}

export async function deleteAdminUserAction(userId: string) {
  const admin = await requirePlatformAdmin();
  await removeAdminUser(admin.id, userId);
  await logUserAction(admin.id, userId, "Deleted user account");
  revalidatePath("/admin/users");
}

async function logUserAction(adminId: string, targetUserId: string, message: string) {
  await createSystemLog({
    level: "INFO",
    message,
    metadata: {
      targetUserId
    },
    source: "AUTH",
    userId: adminId
  });
}
