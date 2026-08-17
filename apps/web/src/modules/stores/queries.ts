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
/**
 * The single definition of "manager". Shared by `getStoreAccess()` and
 * `getViewerCanManageStore()` so the pages, the server actions, and the
 * navigation cannot drift into disagreeing about who may change what.
 */
export function isStoreManager(params: {
  organizationRole: string | undefined;
  platformRole: string | undefined;
}) {
  return (
    params.platformRole === "ADMIN" ||
    params.organizationRole === "OWNER" ||
    params.organizationRole === "ADMIN"
  );
}

export async function getStoreAccess() {
  const [organization, store, user] = await Promise.all([
    getCurrentOrganization(),
    requireStore(),
    getCurrentUser()
  ]);
  const isPlatformAdmin = user?.role === "ADMIN";
  const role = organization?.role ?? "MEMBER";

  return {
    canManage: isStoreManager({ organizationRole: role, platformRole: user?.role }),
    isPlatformAdmin,
    role,
    store,
    ...(organization?.id ? { organizationId: organization.id } : {}),
    ...(user?.id ? { userId: user.id } : {})
  };
}

/**
 * The same question as `getStoreAccess().canManage`, without requiring a store
 * and without redirecting — for the navigation, which only needs to decide which
 * sections to draw and runs on every dashboard page.
 *
 * Fails *open*. Every action and page behind these links checks for itself and
 * fails closed, so the worst a wrong `true` causes is a link that then explains
 * it is read-only; a wrong `false` would hide an owner's entire settings menu
 * over a transient error.
 */
export async function getViewerCanManageStore() {
  const [organization, user] = await Promise.all([getCurrentOrganization(), getCurrentUser()]);

  return isStoreManager({ organizationRole: organization?.role, platformRole: user?.role });
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
