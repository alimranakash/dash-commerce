import { prisma, type Prisma } from "@dash/db";

/**
 * What the store has sold and cannot yet ship.
 *
 * Two questions, and they are not the same one. "What do I owe" is answered by
 * stock that has gone negative — the running total the checkout wrote as it
 * oversold. "Whose order is waiting" is answered by the lines marked at the
 * time they were placed, which is what the seller rings people about.
 *
 * A product can appear in the first list and not the second once the stock has
 * been bought in and the orders shipped, and that is the point: the debt is a
 * number, the promises are people.
 */

export type PreorderDebt = {
  /** Negative stock, read as a positive quantity owed. */
  owed: number;
  preorderReleaseAt: Date | null;
  productId: string;
  sku: string | null;
  title: string;
  /** False once the seller has switched pre-orders back off. */
  stillSelling: boolean;
};

export type PreorderWaitingOrder = {
  createdAt: Date;
  customerName: string;
  customerPhone: string;
  lines: Array<{ quantity: number; title: string }>;
  orderId: string;
  orderNumber: string;
  status: string;
};

/**
 * Every product the store is short on, worst first.
 *
 * Negative stock is the whole signal, so a product that was never opted into
 * pre-orders but has somehow gone under still shows up — that is a discrepancy
 * the seller wants to see rather than one worth hiding.
 */
export async function getPreorderDebts(storeId: string): Promise<PreorderDebt[]> {
  const products = await prisma.product.findMany({
    where: {
      status: {
        not: "ARCHIVED"
      },
      stockQuantity: {
        lt: 0
      },
      storeId
    },
    orderBy: {
      stockQuantity: "asc"
    },
    select: {
      allowPreorder: true,
      id: true,
      preorderReleaseAt: true,
      sku: true,
      stockQuantity: true,
      title: true
    }
  });

  return products.map((product) => ({
    owed: Math.abs(product.stockQuantity),
    preorderReleaseAt: product.preorderReleaseAt,
    productId: product.id,
    sku: product.sku,
    stillSelling: product.allowPreorder,
    title: product.title
  }));
}

/**
 * The orders those debts belong to.
 *
 * Cancelled orders are left out: nobody is waiting on one, and listing them
 * would have the seller buying stock for a parcel that is never going out.
 */
export async function getPreorderWaitingOrders(storeId: string): Promise<PreorderWaitingOrder[]> {
  const orders = await prisma.order.findMany({
    where: {
      items: {
        some: {
          isPreorder: true
        }
      },
      status: {
        not: "CANCELLED"
      },
      storeId
    },
    orderBy: {
      createdAt: "asc"
    },
    select: {
      createdAt: true,
      customerName: true,
      customerPhone: true,
      id: true,
      items: {
        where: {
          isPreorder: true
        },
        orderBy: {
          createdAt: "asc"
        },
        select: {
          quantity: true,
          title: true
        }
      },
      orderNumber: true,
      status: true
    }
  });

  return orders.map((order) => ({
    createdAt: order.createdAt,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    lines: order.items.map((item) => ({ quantity: item.quantity, title: item.title })),
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status
  }));
}

/**
 * Marks pre-ordered lines shippable once the stock behind them has landed.
 *
 * Called after a delivery moves stock, inside that same transaction. The debt
 * is whatever the product's stock is still under by, and it is settled from the
 * oldest promise forward — the person who has waited longest gets the units
 * first, which is also the order the pre-orders page lists them in.
 *
 * Deliberately conservative at the boundary. Lines are walked newest-first and
 * left waiting until the outstanding debt is fully accounted for, so a line
 * that is only half covered stays waiting: a seller told an order is ready
 * cannot half-pack it, and being told too early is worse than being told late.
 *
 * Variants are not settled here. Their stock lives on the variant row and a
 * purchase restocks products, so there is nothing in a delivery that says which
 * option arrived — those lines stay flagged until someone says otherwise.
 */
export async function settlePreordersForProducts(
  tx: Prisma.TransactionClient,
  storeId: string,
  productIds: string[]
) {
  const unique = [...new Set(productIds)];

  for (const productId of unique) {
    const product = await tx.product.findFirst({
      where: {
        id: productId,
        storeId
      },
      select: {
        stockQuantity: true
      }
    });

    if (!product) {
      continue;
    }

    const owed = Math.max(0, -product.stockQuantity);
    const waiting = await tx.orderItem.findMany({
      where: {
        isPreorder: true,
        order: {
          status: {
            not: "CANCELLED"
          },
          storeId
        },
        productId,
        variantId: null
      },
      orderBy: {
        createdAt: "desc"
      },
      select: {
        id: true,
        quantity: true
      }
    });

    const settled: string[] = [];
    let accountedFor = 0;

    for (const line of waiting) {
      if (accountedFor >= owed) {
        settled.push(line.id);
        continue;
      }

      accountedFor += line.quantity;
    }

    if (settled.length === 0) {
      continue;
    }

    await tx.orderItem.updateMany({
      where: {
        id: {
          in: settled
        }
      },
      data: {
        isPreorder: false
      }
    });
  }
}
