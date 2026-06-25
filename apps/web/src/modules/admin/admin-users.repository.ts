import { prisma } from "@dash/db";

export type AdminUserRoleFilter = "admin" | "all" | "seller";
export type AdminUserStatusFilter = "active" | "all" | "suspended";

export async function getAdminUserMetrics() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalUsers, adminUsers, newUsersThisMonth] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: {
        role: "ADMIN"
      }
    }),
    prisma.user.count({
      where: {
        createdAt: {
          gte: monthStart
        }
      }
    })
  ]);

  return {
    adminUsers,
    newUsersThisMonth,
    sellerUsers: totalUsers - adminUsers,
    totalUsers
  };
}

export async function getAdminUsers(filters: {
  role?: AdminUserRoleFilter;
  search?: string;
  status?: AdminUserStatusFilter;
}) {
  const search = filters.search?.trim();

  return prisma.user.findMany({
    where: {
      ...(filters.role === "admin" ? { role: "ADMIN" as const } : {}),
      ...(filters.role === "seller" ? { role: { not: "ADMIN" as const } } : {}),
      ...(filters.status === "active" ? { isSuspended: false } : {}),
      ...(filters.status === "suspended" ? { isSuspended: true } : {}),
      ...(search
        ? {
            OR: [
              {
                name: {
                  contains: search,
                  mode: "insensitive"
                }
              },
              {
                email: {
                  contains: search,
                  mode: "insensitive"
                }
              }
            ]
          }
        : {})
    },
    include: {
      accounts: {
        select: {
          provider: true
        }
      },
      memberships: {
        include: {
          organization: {
            include: {
              stores: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  status: true
                }
              }
            }
          }
        }
      },
      sessions: {
        orderBy: {
          expires: "desc"
        },
        select: {
          expires: true
        },
        take: 1
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

export async function setAdminUserRole(userId: string, role: "ADMIN" | "MEMBER") {
  return prisma.user.update({
    where: {
      id: userId
    },
    data: {
      role
    }
  });
}

export async function setAdminUserSuspended(userId: string, isSuspended: boolean) {
  return prisma.user.update({
    where: {
      id: userId
    },
    data: {
      isSuspended
    }
  });
}

export async function deleteAdminUser(userId: string) {
  return prisma.user.delete({
    where: {
      id: userId
    }
  });
}
