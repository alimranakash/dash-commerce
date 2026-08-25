import { prisma, type Prisma } from "@dash/db";
import { getOrderShipments } from "../courier/courier.service";
import {
  decrementProductVariantStock,
  findProductVariantIdBySku,
  incrementProductVariantStock,
  productHasVariants
} from "../products/product-variants.service";
import type { ManualOrderItemInput } from "./order-create.schema";

/**
 * Changing what an order is for, after it was placed.
 *
 * Everything else a seller can correct is text and arithmetic. This moves
 * stock, so it is the one edit that can quietly corrupt the catalog: a unit
 * taken out and never put back is invisible until someone counts the shelf.
 *
 * The reconciliation is deliberately blunt rather than clever. Every existing
 * line is credited back in full, then every new line is reserved from scratch,
 * both inside one transaction. A net diff would touch fewer rows, but it also
 * fails on cases this does not — reducing the last unit of a product that is
 * now at zero, or swapping between two options of the same product — because
 * the stock is returned before it is asked for again.
 */

type OrderLineWrite = {
  imageUrl: string | null;
  price: string;
  productId: string;
  quantity: number;
  sku: string | null;
  title: string;
  total: string;
  variantId: string | null;
};

type ExistingLine = {
  id: string;
  productId: string | null;
  quantity: number;
  sku: string | null;
  title: string;
  variantId: string | null;
};

export type RepricedOrder = {
  subtotalAmount: string;
};

/**
 * Refuses the edit outright rather than half-applying it.
 *
 * Both refusals are about somebody else already acting on the old order: a
 * carrier holding a printed label with a cash-on-delivery amount, or a return
 * that was opened against lines this would delete.
 */
export async function assertOrderItemsEditable(storeId: string, orderId: string) {
  const [shipments, returns] = await Promise.all([
    getOrderShipments(storeId, orderId),
    prisma.orderReturn.count({
      where: {
        orderId,
        storeId
      }
    })
  ]);

  if (shipments.length > 0) {
    throw new Error(
      "This order is already booked with a courier, so its products cannot be changed. Cancel the booking first, or edit the delivery charge only."
    );
  }

  if (returns > 0) {
    throw new Error(
      "This order has a return against it, so its products cannot be changed. The return is filed against the lines as they were."
    );
  }
}

/**
 * Gives back what an order line took, to wherever it took it from.
 *
 * Lines written before `OrderItem.variantId` existed do not say which option
 * they sold, so the SKU is looked up instead. When that finds nothing and the
 * product sells through options, the line is refused rather than credited to
 * the product's own stock — putting units back in the wrong place is the one
 * outcome worse than not being able to edit.
 */
async function restoreLineStock(
  tx: Prisma.TransactionClient,
  storeId: string,
  line: ExistingLine
) {
  if (!line.productId) {
    // The product has been deleted since. There is nothing left to credit, and
    // the order is free to drop the line.
    return;
  }

  const variantId =
    line.variantId ??
    (line.sku ? await findProductVariantIdBySku(tx, storeId, line.productId, line.sku) : null);

  if (variantId) {
    await incrementProductVariantStock(tx, storeId, line.productId, variantId, line.quantity);

    return;
  }

  if (!line.variantId && (await productHasVariants(tx, storeId, line.productId))) {
    throw new Error(
      `"${line.title}" was ordered before this store tracked product options, so its stock cannot be worked out. Its products cannot be changed.`
    );
  }

  await tx.product.updateMany({
    where: {
      id: line.productId,
      storeId
    },
    data: {
      stockQuantity: {
        increment: line.quantity
      }
    }
  });
}

/** Takes stock for a line the seller has just put on the order. */
async function reserveLineStock(
  tx: Prisma.TransactionClient,
  storeId: string,
  item: ManualOrderItemInput,
  productTitle: string
) {
  if (!item.variantId) {
    const updated = await tx.product.updateMany({
      where: {
        id: item.productId,
        storeId,
        stockQuantity: {
          gte: item.quantity
        }
      },
      data: {
        stockQuantity: {
          decrement: item.quantity
        }
      }
    });

    if (updated.count !== 1) {
      throw new Error(`${productTitle} does not have enough stock.`);
    }

    return null;
  }

  return decrementProductVariantStock(tx, storeId, item.productId, item.variantId, item.quantity);
}

/**
 * Rewrites an order's lines and returns what they now add up to.
 *
 * Runs inside the caller's transaction so the stock movement, the lines and
 * the order's own totals all land together.
 */
export async function replaceOrderItems(
  tx: Prisma.TransactionClient,
  storeId: string,
  orderId: string,
  items: ManualOrderItemInput[]
): Promise<RepricedOrder> {
  const existing = await tx.orderItem.findMany({
    where: {
      order: {
        storeId
      },
      orderId
    },
    select: {
      id: true,
      productId: true,
      quantity: true,
      sku: true,
      title: true,
      variantId: true
    }
  });

  for (const line of existing) {
    await restoreLineStock(tx, storeId, line);
  }

  const products = await tx.product.findMany({
    where: {
      id: {
        in: [...new Set(items.map((item) => item.productId))]
      },
      status: {
        not: "ARCHIVED"
      },
      storeId
    },
    select: {
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
      sku: true,
      title: true
    }
  });
  const productsById = new Map(products.map((product) => [product.id, product]));
  const lines: OrderLineWrite[] = [];

  for (const item of items) {
    const product = productsById.get(item.productId);

    if (!product) {
      throw new Error("One of the selected products is no longer available.");
    }

    const variant = await reserveLineStock(tx, storeId, item, product.title);
    const price = item.price ?? Number(variant ? variant.price : product.price).toFixed(2);

    lines.push({
      imageUrl: variant?.imageUrl ?? product.images[0]?.url ?? null,
      price,
      productId: product.id,
      quantity: item.quantity,
      sku: variant?.sku ?? product.sku ?? null,
      title: variant ? `${product.title} - ${variant.title}` : product.title,
      total: (Number(price) * item.quantity).toFixed(2),
      variantId: variant?.id ?? null
    });
  }

  await tx.orderItem.deleteMany({
    where: {
      id: {
        in: existing.map((line) => line.id)
      }
    }
  });

  await tx.orderItem.createMany({
    data: lines.map((line) => ({
      ...line,
      orderId
    }))
  });

  return {
    subtotalAmount: lines.reduce((sum, line) => sum + Number(line.total), 0).toFixed(2)
  };
}
