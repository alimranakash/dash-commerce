import { prisma } from "@dash/db";

/**
 * Every function here is scoped by `storeId` except the two hostname lookups,
 * which are cross-store by design: `StoreDomain.domain` is globally unique, so
 * "who owns this hostname" and "may this hostname be served" are questions that
 * have to be asked across the whole table. Both return only the columns the
 * caller needs, so neither can leak another store's data into a seller-facing
 * message.
 */

export async function listStoreDomains(storeId: string) {
  return prisma.storeDomain.findMany({
    orderBy: [
      {
        isPrimary: "desc"
      },
      {
        createdAt: "asc"
      }
    ],
    where: {
      storeId
    }
  });
}

export async function findStoreDomainById(params: { domainId: string; storeId: string }) {
  return prisma.storeDomain.findFirst({
    where: {
      id: params.domainId,
      storeId: params.storeId
    }
  });
}

/** Ownership check for a hostname, across every store. */
export async function findDomainOwner(domain: string) {
  return prisma.storeDomain.findUnique({
    select: {
      domain: true,
      id: true,
      storeId: true,
      type: true,
      verifiedAt: true
    },
    where: {
      domain
    }
  });
}

/**
 * The one query that answers "may this hostname be served?" — a verified custom
 * domain on a store that is not archived. Request routing and the on-demand TLS
 * authorisation endpoint both need exactly this, and must agree.
 */
export async function findServableCustomDomain(domain: string) {
  return prisma.storeDomain.findFirst({
    select: {
      domain: true,
      id: true,
      store: {
        select: {
          id: true,
          slug: true,
          status: true
        }
      }
    },
    where: {
      domain,
      store: {
        status: {
          in: ["ACTIVE", "DRAFT"]
        }
      },
      type: "CUSTOM",
      verifiedAt: {
        not: null
      }
    }
  });
}

export async function countCustomDomains(storeId: string) {
  return prisma.storeDomain.count({
    where: {
      storeId,
      type: "CUSTOM"
    }
  });
}

/**
 * Custom rows are always created unverified and never primary — a hostname only
 * becomes servable once DNS has been checked.
 */
export async function createCustomDomains(params: { hostnames: string[]; storeId: string }) {
  return prisma.$transaction(
    params.hostnames.map((domain) =>
      prisma.storeDomain.create({
        data: {
          domain,
          isPrimary: false,
          storeId: params.storeId,
          type: "CUSTOM"
        }
      })
    )
  );
}

export async function deleteStoreDomain(params: { domainId: string; storeId: string }) {
  return prisma.storeDomain.deleteMany({
    where: {
      id: params.domainId,
      storeId: params.storeId
    }
  });
}

/**
 * Moves the primary flag in one transaction, so the "exactly one primary per
 * store" invariant never has a window where it is false.
 */
export async function setPrimaryStoreDomain(params: { domainId: string; storeId: string }) {
  await prisma.$transaction([
    prisma.storeDomain.updateMany({
      data: {
        isPrimary: false
      },
      where: {
        id: {
          not: params.domainId
        },
        storeId: params.storeId
      }
    }),
    prisma.storeDomain.updateMany({
      data: {
        isPrimary: true
      },
      where: {
        id: params.domainId,
        storeId: params.storeId
      }
    })
  ]);
}

export async function findPlatformStoreDomain(storeId: string) {
  return prisma.storeDomain.findFirst({
    orderBy: {
      createdAt: "asc"
    },
    where: {
      storeId,
      type: "DASH_SUBDOMAIN"
    }
  });
}

/** Write path for the DNS-verification pass; `null` marks a row unverified. */
export async function setStoreDomainVerification(params: {
  domainId: string;
  storeId: string;
  verifiedAt: Date | null;
}) {
  return prisma.storeDomain.updateMany({
    data: {
      verifiedAt: params.verifiedAt
    },
    where: {
      id: params.domainId,
      storeId: params.storeId,
      type: "CUSTOM"
    }
  });
}

/**
 * Records what the last DNS check saw, so the badge and its explanation survive
 * a page reload instead of living only in the action's response.
 */
export async function recordStoreDomainCheck(params: {
  detail: string;
  domainId: string;
  status: string;
  storeId: string;
}) {
  return prisma.storeDomain.updateMany({
    data: {
      lastCheckDetail: params.detail,
      lastCheckStatus: params.status,
      lastCheckedAt: new Date()
    },
    where: {
      id: params.domainId,
      storeId: params.storeId,
      type: "CUSTOM"
    }
  });
}

export type StoreDomainRecord = Awaited<ReturnType<typeof listStoreDomains>>[number];
