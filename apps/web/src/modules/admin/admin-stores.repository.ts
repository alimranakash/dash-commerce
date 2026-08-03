import { prisma } from "@dash/db";

export type AdminStoreStatusFilter = "all" | "active" | "trial" | "suspended";

export async function getAdminStoreMetrics() {
  const where = {
    status: {
      not: "ARCHIVED" as const
    }
  };

  const [totalStores, activeStores, suspendedStores, trialStores] = await Promise.all([
    prisma.store.count({ where }),
    prisma.store.count({ where: { status: "ACTIVE" } }),
    prisma.store.count({ where: { status: "SUSPENDED" } }),
    prisma.store.count({ where: { status: "DRAFT" } })
  ]);

  return {
    activeStores,
    suspendedStores,
    totalStores,
    trialStores
  };
}

export async function getAdminStores(filters: { search?: string; status?: AdminStoreStatusFilter }) {
  const search = filters.search?.trim();

  return prisma.store.findMany({
    where: {
      status: statusFilter(filters.status),
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
                slug: {
                  contains: search,
                  mode: "insensitive"
                }
              },
              {
                domains: {
                  some: {
                    domain: {
                      contains: search,
                      mode: "insensitive"
                    }
                  }
                }
              },
              {
                organization: {
                  name: {
                    contains: search,
                    mode: "insensitive"
                  }
                }
              },
              {
                organization: {
                  members: {
                    some: {
                      user: {
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
                    }
                  }
                }
              }
            ]
          }
        : {})
    },
    include: {
      _count: {
        select: {
          customers: true,
          orders: true,
          products: true
        }
      },
      domains: {
        orderBy: [
          {
            isPrimary: "desc"
          },
          {
            createdAt: "asc"
          }
        ],
        take: 1
      },
      orders: {
        orderBy: {
          updatedAt: "desc"
        },
        select: {
          updatedAt: true
        },
        take: 1
      },
      subscription: {
        include: {
          plan: {
            select: {
              name: true
            }
          }
        }
      },
      organization: {
        include: {
          members: {
            include: {
              user: {
                select: {
                  email: true,
                  image: true,
                  name: true
                }
              }
            },
            orderBy: {
              createdAt: "asc"
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

export async function updateAdminStoreStatus(storeId: string, status: "ACTIVE" | "ARCHIVED" | "SUSPENDED") {
  return prisma.store.update({
    where: {
      id: storeId
    },
    data: {
      status
    }
  });
}

function statusFilter(status: AdminStoreStatusFilter | undefined) {
  if (status === "active") return "ACTIVE";
  if (status === "trial") return "DRAFT";
  if (status === "suspended") return "SUSPENDED";

  return {
    not: "ARCHIVED" as const
  };
}
