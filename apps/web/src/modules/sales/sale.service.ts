import { prisma } from "@dash/db";
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
};

type PreparedSaleItem = {
  discount: string;
  productId: string;
  productName: string;
  quantity: number;
  sku?: string;
  total: string;
  unitPrice: string;
};

export async function createSale(context: SaleContext, input: CreateSaleInput) {
  const data = createSaleSchema.parse(input);

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

    return sale;
  });
}

export async function updateSale(context: SaleContext, saleId: string, input: UpdateSaleInput) {
  const data = updateSaleSchema.parse(input);

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
    const shouldCompleteNow = data.status === "COMPLETED" && !existing.completedAt;

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
        completedAt: shouldCompleteNow ? new Date() : existing.completedAt,
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

    if (shouldCompleteNow) {
      await decreaseProductStock(tx, context.organizationId, context.storeId, sale.id, items);
    }

    return sale;
  });
}

export async function voidSale(context: SaleContext, saleId: string) {
  const result = await prisma.sale.updateMany({
    where: {
      id: saleId,
      organizationId: context.organizationId,
      storeId: context.storeId
    },
    data: {
      status: "CANCELLED"
    }
  });

  return result.count > 0;
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

    prepared.push({
      discount: centsToMoney(discountCents),
      productId: product.id,
      productName: product.title,
      quantity: item.quantity,
      ...(product.sku ? { sku: product.sku } : {}),
      total: centsToMoney(totalCents),
      unitPrice: centsToMoney(unitPriceCents)
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
