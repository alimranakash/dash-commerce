import { prisma } from "@dash/db";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import { getCurrentOrganization } from "../organizations/queries";

export async function getCurrentStore() {
  const organization = await getCurrentOrganization();

  if (!organization) {
    return null;
  }

  return prisma.store.findFirst({
    where: {
      organizationId: organization.id
    },
    include: {
      domains: {
        orderBy: [
          {
            isPrimary: "desc"
          },
          {
            createdAt: "asc"
          }
        ]
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  });
}

export async function requireStore() {
  const store = await getCurrentStore();

  if (!store) {
    redirect("/dashboard");
  }

  return store;
}

/**
 * `requireStore()` plus the caller's authority over it.
 *
 * `canManage` gates settings that change how the storefront behaves for every
 * visitor — marketing tags, tracking code — where a MEMBER should be able to
 * look but not touch. Platform admins pass regardless of org role.
 */
export async function getStoreAccess() {
  const [organization, store, user] = await Promise.all([
    getCurrentOrganization(),
    requireStore(),
    getCurrentUser()
  ]);
  const isPlatformAdmin = user?.role === "ADMIN";
  const role = organization?.role ?? "MEMBER";

  return {
    canManage: isPlatformAdmin || role === "OWNER" || role === "ADMIN",
    isPlatformAdmin,
    role,
    store,
    ...(organization?.id ? { organizationId: organization.id } : {}),
    ...(user?.id ? { userId: user.id } : {})
  };
}

/**
 * Server-action guard. Pages should prefer `getStoreAccess()` so they can render
 * a read-only form, but every mutation re-checks here — a disabled input is not
 * a permission check.
 */
export async function requireStoreManager() {
  const access = await getStoreAccess();

  if (!access.canManage) {
    throw new StoreAccessError("Only the store owner or an admin can change these settings.");
  }

  return access;
}

export class StoreAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreAccessError";
  }
}
