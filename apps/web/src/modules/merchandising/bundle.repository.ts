import { prisma, type Prisma } from "@dash/db";
import type { BundleDiscountType, BundleStatus, BundleType } from "./bundle.schema";

const bundleInclude = {
  items: {
    orderBy: {
      product: {
        title: "asc"
      }
    },
    select: {
      product: {
        select: {
          id: true,
          price: true,
          title: true
        }
      },
      productId: true,
      quantity: true
    }
  }
} satisfies Prisma.BundleInclude;

export type BundleRecord = Prisma.BundleGetPayload<{ include: typeof bundleInclude }>;

export type BundleWriteData = {
  buyQuantity: number;
  description: string;
  discountType: BundleDiscountType;
  discountValue: string;
  expiresAt: Date | null;
  getQuantity: number;
  name: string;
  startsAt: Date | null;
  status: BundleStatus;
  type: BundleType;
};

export async function listBundleRecords(storeId: string) {
  return prisma.bundle.findMany({
    where: {
      storeId
    },
    orderBy: {
      createdAt: "desc"
    },
    include: bundleInclude
  });
}

export async function getBundleRecord(storeId: string, bundleId: string) {
  return prisma.bundle.findFirst({
    where: {
      id: bundleId,
      storeId
    },
    include: bundleInclude
  });
}

/**
 * The bundles a cart should be priced against right now.
 *
 * The window is evaluated here rather than in the pricing engine, which is kept
 * free of clocks so the same cart always prices the same way.
 */
export async function getLiveBundleRecords(storeId: string, at: Date) {
  return prisma.bundle.findMany({
    where: {
      status: "ACTIVE",
      storeId,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: at } }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: at } }] }
      ]
    },
    orderBy: {
      createdAt: "asc"
    },
    include: bundleInclude
  });
}

/**
 * Writes the bundle and its products together.
 *
 * The item rows are replaced wholesale rather than diffed: the editor always
 * posts the complete list, and a partial write would leave the bundle naming a
 * product the seller has just taken out of it.
 */
export async function saveBundleRecord(input: {
  bundleId?: string | undefined;
  data: BundleWriteData;
  items: Array<{ productId: string; quantity: number }>;
  storeId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const bundle = input.bundleId
      ? await tx.bundle.update({
          data: input.data,
          where: {
            id: input.bundleId
          }
        })
      : await tx.bundle.create({
          data: {
            ...input.data,
            storeId: input.storeId
          }
        });

    await tx.bundleItem.deleteMany({
      where: {
        bundleId: bundle.id
      }
    });

    await tx.bundleItem.createMany({
      data: input.items.map((item) => ({
        bundleId: bundle.id,
        productId: item.productId,
        quantity: item.quantity
      }))
    });

    return bundle;
  });
}

export async function deleteBundleRecord(storeId: string, bundleId: string) {
  const result = await prisma.bundle.deleteMany({
    where: {
      id: bundleId,
      storeId
    }
  });

  return result.count === 1;
}

export async function setBundleStatusRecord(
  storeId: string,
  bundleId: string,
  status: BundleStatus
) {
  const result = await prisma.bundle.updateMany({
    data: {
      status
    },
    where: {
      id: bundleId,
      storeId
    }
  });

  return result.count === 1;
}

/** Which of these product ids the store actually owns and can sell. */
export async function getSellableBundleProductIds(storeId: string, productIds: string[]) {
  if (productIds.length === 0) {
    return new Set<string>();
  }

  const rows = await prisma.product.findMany({
    where: {
      id: {
        in: productIds
      },
      status: "ACTIVE",
      storeId
    },
    select: {
      id: true
    }
  });

  return new Set(rows.map((row) => row.id));
}

/** Everything the bundle editor may be built from. */
export async function getBundleProductOptions(storeId: string) {
  return prisma.product.findMany({
    where: {
      status: "ACTIVE",
      storeId,
      visibility: "PUBLIC"
    },
    orderBy: {
      title: "asc"
    },
    select: {
      id: true,
      price: true,
      title: true
    }
  });
}

/** One order's bundle rows, written inside the order transaction. */
export async function createOrderBundles(
  tx: Prisma.TransactionClient,
  input: {
    bundles: Array<{
      bundleId: string;
      discountAmount: string;
      name: string;
      timesApplied: number;
    }>;
    orderId: string;
    storeId: string;
  }
) {
  if (input.bundles.length === 0) {
    return;
  }

  await tx.orderBundle.createMany({
    data: input.bundles.map((bundle) => ({
      bundleId: bundle.bundleId,
      discountAmount: bundle.discountAmount,
      name: bundle.name,
      orderId: input.orderId,
      storeId: input.storeId,
      timesApplied: bundle.timesApplied
    }))
  });
}
