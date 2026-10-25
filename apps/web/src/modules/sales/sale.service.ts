import { prisma } from "@dash/db";
import { applySaleLoyaltyOptIn, reconcileSaleLoyalty } from "../loyalty/loyalty.sales";
import { prepareSaleLoyalty } from "../loyalty/loyalty.service";
import {
  adjustProductVariantStock,
  ensureProductVariantSchema,
  getProductVariantForSale,
  getProductVariantStock,
  productHasActiveVariants
} from "../products/product-variants.service";
import {
  countSalesForStore,
  getSaleByIdForStore,
  getSaleMetricsForStore,
  getSaleNumberExists,
  getSalesForStore,
  type SaleFilters
} from "./sale.repository";
import {
  createSaleSchema,
  updateSaleSchema,
  type CreateSaleInput,
  type SaleItemInput,
  type SalePaymentStatus,
  type UpdateSaleInput
} from "./sale.schema";

export { getSaleByIdForStore, getSaleMetricsForStore, getSalesForStore };
export type { SaleFilters };

type SaleContext = {
  organizationId: string;
  storeId: string;
  /** Who is saving, for the record of a customer's loyalty opt-in. */
  userId?: string | null | undefined;
};

type PreparedSaleItem = {
  discount: string;
  productId: string;
  productName: string;
  quantity: number;
  sku?: string;
  total: string;
  unitPrice: string;
  /** Set for a product sold by option: the line's stock is that variant's. */
  variantId?: string;
};

export async function createSale(context: SaleContext, input: CreateSaleInput) {
  const data = createSaleSchema.parse(input);
  // Read before the transaction, as an order's are: the store's settings and
  // plan, never from inside it — and the variant tables' DDL with them.
  const loyalty = await prepareSaleLoyalty(context.storeId);
  await ensureProductVariantSchema();

  return prisma.$transaction(async (tx) => {
    if (data.customerId) {
      await assertCustomerBelongsToStore(tx, context.storeId, data.customerId);
    }

    const items = await prepareItems(tx, context.storeId, data.items);
    const totals = calculateTotals(items, data.discount, data.tax, data.shipping, data.paidAmount);
    const saleNumber = await createSaleNumber(context.storeId);
    const shouldComplete = data.status === "COMPLETED";

    const sale = await tx.sale.create({
      data: {
        completedAt: shouldComplete ? new Date() : null,
        customerId: data.customerId ?? null,
        discount: totals.discount,
        dueAmount: totals.dueAmount,
        notes: data.notes ?? null,
        organizationId: context.organizationId,
        paidAmount: totals.paidAmount,
        paymentMethod: data.paymentMethod,
        paymentStatus: totals.paymentStatus,
        saleDate: parseSaleDate(data.saleDate),
        saleNumber,
        saleType: data.saleType,
        shipping: totals.shipping,
        status: data.status,
        storeId: context.storeId,
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        items: {
          create: items
        }
      },
      include: {
        customer: true,
        items: true
      }
    });

    if (shouldComplete) {
      await decreaseProductStock(tx, context.organizationId, context.storeId, sale.id, items);
    }

    // The opt-in, then the points, in the sale's own transaction: a sale and
    // what it earned commit together or not at all.
    await applySaleLoyaltyOptIn(tx, context.storeId, saleOptIn(context, sale.id, data), loyalty);
    await reconcileSaleLoyalty(tx, context.storeId, sale.id, loyalty);

    return sale;
  });
}

export async function updateSale(context: SaleContext, saleId: string, input: UpdateSaleInput) {
  const data = updateSaleSchema.parse(input);
  const loyalty = await prepareSaleLoyalty(context.storeId);
  await ensureProductVariantSchema();

  return prisma.$transaction(async (tx) => {
    const existing = await tx.sale.findFirst({
      where: {
        id: saleId,
        organizationId: context.organizationId,
        storeId: context.storeId
      },
      include: {
        items: true
      }
    });

    if (!existing) {
      return null;
    }

    if (data.customerId) {
      await assertCustomerBelongsToStore(tx, context.storeId, data.customerId);
    }

    const items = await prepareItems(tx, context.storeId, data.items);
    const totals = calculateTotals(items, data.discount, data.tax, data.shipping, data.paidAmount);
    const stockWasDeducted = existing.status === "COMPLETED";
    const shouldDeductStock = data.status === "COMPLETED";

    if (stockWasDeducted) {
      await restoreProductStock(tx, context.organizationId, context.storeId, saleId, existing.items);
    }

    await tx.saleItem.deleteMany({
      where: {
        saleId
      }
    });

    const sale = await tx.sale.update({
      where: {
        id: saleId
      },
      data: {
        completedAt: shouldDeductStock ? existing.completedAt ?? new Date() : null,
        customerId: data.customerId ?? null,
        discount: totals.discount,
        dueAmount: totals.dueAmount,
        notes: data.notes ?? null,
        paidAmount: totals.paidAmount,
        paymentMethod: data.paymentMethod,
        paymentStatus: totals.paymentStatus,
        saleDate: parseSaleDate(data.saleDate),
        saleType: data.saleType,
        shipping: totals.shipping,
        status: data.status,
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        items: {
          create: items
        }
      },
      include: {
        customer: true,
        items: true
      }
    });

    if (shouldDeductStock) {
      await decreaseProductStock(tx, context.organizationId, context.storeId, sale.id, items);
    }

    // Every edit reconciles — status, payment, items, discount, customer and
    // the opt-in all move what the sale should have earned.
    await applySaleLoyaltyOptIn(tx, context.storeId, saleOptIn(context, sale.id, data), loyalty);
    await reconcileSaleLoyalty(tx, context.storeId, sale.id, loyalty);

    return sale;
  });
}

export async function voidSale(context: SaleContext, saleId: string) {
  const loyalty = await prepareSaleLoyalty(context.storeId);
  await ensureProductVariantSchema();

  return prisma.$transaction(async (tx) => {
    const existing = await tx.sale.findFirst({
      where: {
        id: saleId,
        organizationId: context.organizationId,
        storeId: context.storeId
      },
      include: {
        items: true
      }
    });

    if (!existing || existing.status === "CANCELLED") {
      return false;
    }

    if (existing.status === "COMPLETED") {
      await restoreProductStock(tx, context.organizationId, context.storeId, saleId, existing.items);
    }

    await tx.sale.update({
      where: {
        id: saleId
      },
      data: {
        completedAt: null,
        status: "CANCELLED"
      }
    });

    // A cancelled sale gives back what it earned — even with the programme
    // or the plan switched off since, as a cancelled order does.
    await reconcileSaleLoyalty(tx, context.storeId, saleId, loyalty);

    return true;
  });
}

function saleOptIn(
  context: SaleContext,
  saleId: string,
  data: { customerId?: string | undefined; loyaltyOptIn: "in" | "keep" | "out" }
) {
  return {
    choice: data.loyaltyOptIn,
    customerId: data.customerId ?? null,
    saleId,
    userId: context.userId ?? null
  };
}

async function createSaleNumber(storeId: string) {
  const count = await countSalesForStore(storeId);

  for (let offset = 1; offset < 20; offset += 1) {
    const saleNumber = `SALE-${String(count + offset).padStart(6, "0")}`;
    if (!(await getSaleNumberExists(storeId, saleNumber))) {
      return saleNumber;
    }
  }

  return `SALE-${Date.now()}`;
}

async function assertCustomerBelongsToStore(tx: TransactionClient, storeId: string, customerId: string) {
  const customer = await tx.customer.findFirst({
    where: {
      id: customerId,
      storeId
    },
    select: {
      id: true
    }
  });

  if (!customer) {
    throw new Error("Customer not found for this store.");
  }
}

async function prepareItems(tx: TransactionClient, storeId: string, items: SaleItemInput[]) {
  const prepared: PreparedSaleItem[] = [];

  for (const item of items) {
    const product = await tx.product.findFirst({
      where: {
        id: item.productId,
        storeId
      },
      select: {
        id: true,
        price: true,
        sku: true,
        title: true
      }
    });

    if (!product) {
      throw new Error("Selected product was not found for this store.");
    }

    const unitPriceCents = moneyToCents(item.unitPrice);
    const discountCents = Math.min(moneyToCents(item.discount), unitPriceCents * item.quantity);
    const totalCents = Math.max(unitPriceCents * item.quantity - discountCents, 0);
    const line = {
      discount: centsToMoney(discountCents),
      productId: product.id,
      quantity: item.quantity,
      total: centsToMoney(totalCents),
      unitPrice: centsToMoney(unitPriceCents)
    };

    // A product sold by option is only ever sold as one of them — its stock
    // lives on the variants, as checkout and order entry already keep it.
    if (!(await productHasActiveVariants(tx, storeId, product.id))) {
      prepared.push({ ...line, productName: product.title, ...(product.sku ? { sku: product.sku } : {}) });
      continue;
    }

    if (!item.variantId) {
      throw new Error(`Choose which option of ${product.title} was sold.`);
    }

    const variant = await getProductVariantForSale(tx, storeId, product.id, item.variantId);
    const sku = variant.sku ?? product.sku;

    prepared.push({
      ...line,
      productName: `${product.title} - ${variant.title}`,
      ...(sku ? { sku } : {}),
      variantId: variant.id
    });
  }

  return prepared;
}

function calculateTotals(
  items: PreparedSaleItem[],
  discount: string,
  tax: string,
  shipping: string,
  paidAmount: string
) {
  const subtotalCents = items.reduce((total, item) => total + moneyToCents(item.total), 0);
  const discountCents = Math.min(moneyToCents(discount), subtotalCents);
  const taxCents = moneyToCents(tax);
  const shippingCents = moneyToCents(shipping);
  const totalCents = Math.max(subtotalCents - discountCents + taxCents + shippingCents, 0);
  const paidCents = Math.min(moneyToCents(paidAmount), totalCents);
  const dueCents = Math.max(totalCents - paidCents, 0);

  return {
    discount: centsToMoney(discountCents),
    dueAmount: centsToMoney(dueCents),
    paidAmount: centsToMoney(paidCents),
    paymentStatus: paymentStatusFromCents(totalCents, paidCents),
    shipping: centsToMoney(shippingCents),
    subtotal: centsToMoney(subtotalCents),
    tax: centsToMoney(taxCents),
    total: centsToMoney(totalCents)
  };
}

async function decreaseProductStock(
  tx: TransactionClient,
  organizationId: string,
  storeId: string,
  saleId: string,
  items: PreparedSaleItem[]
) {
  for (const item of items) {
    if (item.variantId) {
      // The rule checkout's decrement uses: an option set to keep selling past
      // zero may go under, any other may not.
      const variant = await getProductVariantForSale(tx, storeId, item.productId, item.variantId);

      if (!variant.continueSelling && variant.stockQuantity < item.quantity) {
        throw new Error(`${item.productName} does not have enough stock.`);
      }

      if ((await adjustProductVariantStock(tx, storeId, item.productId, item.variantId, -item.quantity)) !== 1) {
        throw new Error(`${item.productName} does not have enough stock.`);
      }
      await tx.stockMovement.create({
        data: {
          createdBy: null,
          newQuantity: variant.stockQuantity - item.quantity,
          notes: `Option ${variant.title} — the quantities are the option's own stock.`,
          organizationId,
          previousQuantity: variant.stockQuantity,
          productId: item.productId,
          quantityChange: -item.quantity,
          reason: "Sale completed",
          sourceId: saleId,
          sourceType: "SALE",
          storeId,
          type: "STOCK_OUT"
        }
      });
      continue;
    }

    const product = await tx.product.findFirst({
      where: {
        id: item.productId,
        storeId
      },
      select: {
        id: true,
        stockQuantity: true,
        title: true
      }
    });

    if (!product || product.stockQuantity < item.quantity) {
      throw new Error(`${item.productName} does not have enough stock.`);
    }

    const previousQuantity = product.stockQuantity;
    const newQuantity = previousQuantity - item.quantity;

    await tx.product.update({
      where: {
        id: product.id
      },
      data: {
        stockQuantity: newQuantity
      }
    });

    await tx.stockMovement.create({
      data: {
        createdBy: null,
        newQuantity,
        notes: null,
        organizationId,
        previousQuantity,
        productId: product.id,
        quantityChange: -item.quantity,
        reason: "Sale completed",
        sourceId: saleId,
        sourceType: "SALE",
        storeId,
        type: "STOCK_OUT"
      }
    });
  }
}

async function restoreProductStock(
  tx: TransactionClient,
  organizationId: string,
  storeId: string,
  saleId: string,
  items: Array<{ productId: string; quantity: number; variantId?: string | null | undefined }>
) {
  for (const item of items) {
    // A line that took stock from an option gives it back there; a line written
    // before options were tracked on sales took it from the product, and gives
    // it back to the product below.
    if (item.variantId) {
      const variant = await getProductVariantStock(tx, storeId, item.productId, item.variantId);

      // The option was deleted since. There is no shelf to put it back on, and
      // refusing the edit over it would strand the sale — as order editing does.
      if (!variant) {
        continue;
      }

      await adjustProductVariantStock(tx, storeId, item.productId, item.variantId, item.quantity);
      await tx.stockMovement.create({
        data: {
          createdBy: null,
          newQuantity: variant.stockQuantity + item.quantity,
          notes: `Option ${variant.title} — the quantities are the option's own stock.`,
          organizationId,
          previousQuantity: variant.stockQuantity,
          productId: item.productId,
          quantityChange: item.quantity,
          reason: "Sale stock restored",
          sourceId: saleId,
          sourceType: "SALE",
          storeId,
          type: "STOCK_IN"
        }
      });
      continue;
    }

    const product = await tx.product.findFirst({
      where: {
        id: item.productId,
        storeId
      },
      select: {
        id: true,
        stockQuantity: true
      }
    });

    if (!product) {
      continue;
    }

    const previousQuantity = product.stockQuantity;
    const newQuantity = previousQuantity + item.quantity;

    await tx.product.update({
      where: {
        id: product.id
      },
      data: {
        stockQuantity: newQuantity
      }
    });

    await tx.stockMovement.create({
      data: {
        createdBy: null,
        newQuantity,
        notes: null,
        organizationId,
        previousQuantity,
        productId: product.id,
        quantityChange: item.quantity,
        reason: "Sale stock restored",
        sourceId: saleId,
        sourceType: "SALE",
        storeId,
        type: "STOCK_IN"
      }
    });
  }
}

function paymentStatusFromCents(totalCents: number, paidCents: number): SalePaymentStatus {
  if (paidCents <= 0) return "UNPAID";
  if (paidCents >= totalCents) return "PAID";
  return "PARTIAL";
}

function parseSaleDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Use a valid sale date.");
  }

  return date;
}

function moneyToCents(value: string) {
  const [whole = "0", fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2));
}

function centsToMoney(value: number) {
  return (value / 100).toFixed(2);
}

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
