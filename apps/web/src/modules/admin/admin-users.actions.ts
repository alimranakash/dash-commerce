"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "./admin.auth";
import {
  activateAdminUser,
  makeUserAdmin,
  removeAdminUser,
  removeUserAdmin,
  suspendAdminUser
} from "./admin-users.service";

export async function makeUserAdminAction(userId: string) {
  await requirePlatformAdmin();
  await makeUserAdmin(userId);
  revalidatePath("/admin/users");
}

export async function removeUserAdminAction(userId: string) {
  const admin = await requirePlatformAdmin();
  await removeUserAdmin(admin.id, userId);
  revalidatePath("/admin/users");
}

export async function suspendAdminUserAction(userId: string) {
  const admin = await requirePlatformAdmin();
  await suspendAdminUser(admin.id, userId);
  revalidatePath("/admin/users");
}

export async function activateAdminUserAction(userId: string) {
  await requirePlatformAdmin();
  await activateAdminUser(userId);
  revalidatePath("/admin/users");
}

export async function deleteAdminUserAction(userId: string) {
  const admin = await requirePlatformAdmin();
  await removeAdminUser(admin.id, userId);
  revalidatePath("/admin/users");
}
