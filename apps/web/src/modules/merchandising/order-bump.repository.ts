import { prisma, type Prisma } from "@dash/db";
import type { OrderBumpDiscountType } from "./order-bump.schema";

/** Everything the offer needs off the product it is made of. */
const offerProductSelect = {
  allowPreorder: true,
  id: true,
  images: {
    orderBy: {
      position: "asc"
    },
    select: {
      url: true
    },
    take: 1
  },
  price: true,
  shortDescription: true,
  stockQuantity: true,
  title: true
} satisfies Prisma.ProductSelect;

export type OrderBumpProduct = Prisma.ProductGetPayload<{ select: typeof offerProductSelect }>;

export async function getOrderBumpConfig(storeId: string) {
  return prisma.orderBump.findUnique({
    where: {
      storeId
    }
  });
}

export async function saveOrderBumpConfig(
  storeId: string,
  data: {
    description: string;
    discountType: OrderBumpDiscountType;
    discountValue: string;
    enabled: boolean;
    headline: string;
    productId: string | null;
  }
) {
  return prisma.orderBump.upsert({
    where: {
      storeId
    },
    update: data,
    create: {
      storeId,
      ...data
    }
  });
}

/**
 * A product the bump may actually be made of.
 *
 * Sellable is not the same as visible: a hidden or archived product must not
 * appear on a checkout page, and one with options cannot, because the offer is
 * a single tick with nowhere to ask which size.
 */
export async function getSellableOrderBumpProduct(storeId: string, productId: string) {
  return prisma.product.findFirst({
    where: {
      id: productId,
      status: "ACTIVE",
      storeId,
      variants: {
        none: {}
      },
      visibility: "PUBLIC"
    },
    select: offerProductSelect
  });
}

/** The same filter over several candidates at once, ranking preserved by the caller. */
export async function getSellableOrderBumpProducts(storeId: string, productIds: string[]) {
  if (productIds.length === 0) {
    return [];
  }

  return prisma.product.findMany({
    where: {
      id: {
        in: productIds
      },
      status: "ACTIVE",
      storeId,
      variants: {
        none: {}
      },
      visibility: "PUBLIC"
    },
    select: offerProductSelect
  });
}

/** Every product the seller may pin the offer to. */
export async function getOrderBumpProductOptions(storeId: string) {
  return prisma.product.findMany({
    where: {
      status: "ACTIVE",
      storeId,
      variants: {
        none: {}
      },
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
