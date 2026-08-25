import { prisma } from "@dash/db";
import { settlePreordersForProducts } from "../products/preorder.service";
import {
  countPurchasesForStore,
  getPurchaseByIdForStore,
  getPurchaseCountsForStore,
  getPurchaseNumberExists,
  getPurchasesForStore
} from "./purchase.repository";
import {
  createPurchaseSchema,
  purchaseStatusSchema,
  updatePurchaseSchema,
  type CreatePurchaseInput,
  type PurchaseItemInput,
  type PurchaseStatus,
  type UpdatePurchaseInput
} from "./purchase.schema";

export { getPurchaseByIdForStore, getPurchaseCountsForStore, getPurchasesForStore };

type PurchaseContext = {
  organizationId: string;
  storeId: string;
};

type PreparedPurchaseItem = {
  productId?: string;
  productName: string;
  quantity: number;
  sku?: string;
  totalCost: string;
  unitCost: string;
};

export async function createPurchase(context: PurchaseContext, input: CreatePurchaseInput) {
  const data = createPurchaseSchema.parse(input);
  const purchaseDate = parsePurchaseDate(data.purchaseDate);

  return prisma.$transaction(async (tx) => {
    await assertSupplierBelongsToOrganization(tx, context.organizationId, data.supplierId);
    const items = await prepareItems(tx, context.storeId, data.items);
    const totals = calculateTotals(items, data.discountAmount, data.taxAmount, data.paidAmount);
    const purchaseNumber = await createPurchaseNumber(context.storeId);
    const shouldReceive = data.status === "RECEIVED";

    const purchase = await tx.purchase.create({
      data: {
        organizationId: context.organizationId,
        storeId: context.storeId,
        supplierId: data.supplierId,
        purchaseNumber,
        purchaseDate,
        status: data.status,
        discountAmount: totals.discountAmount,
        dueAmount: totals.dueAmount,
        paidAmount: totals.paidAmount,
        subtotalAmount: totals.subtotalAmount,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        notes: data.notes ?? null,
        receivedAt: shouldReceive ? new Date() : null,
        items: {
          create: items
        }
      },
      include: {
        items: true,
        supplier: true
      }
    });

    if (shouldReceive) {
      await applyProductStock(tx, context.organizationId, context.storeId, purchase.id, items);
      await settlePreordersForProducts(tx, context.storeId, productIdsOf(items));
    }

    return purchase;
  });
}

export async function updatePurchase(
  context: PurchaseContext,
  purchaseId: string,
  input: UpdatePurchaseInput
) {
  const data = updatePurchaseSchema.parse(input);
  const purchaseDate = parsePurchaseDate(data.purchaseDate);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.purchase.findFirst({
      where: {
        id: purchaseId,
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

    await assertSupplierBelongsToOrganization(tx, context.organizationId, data.supplierId);
    const items = await prepareItems(tx, context.storeId, data.items);
    const totals = calculateTotals(items, data.discountAmount, data.taxAmount, data.paidAmount);
    const shouldReceiveNow = data.status === "RECEIVED" && !existing.receivedAt;

    await tx.purchaseItem.deleteMany({
      where: {
        purchaseId
      }
    });

    const purchase = await tx.purchase.update({
      where: {
        id: purchaseId
      },
      data: {
        supplierId: data.supplierId,
        purchaseDate,
        status: data.status,
        discountAmount: totals.discountAmount,
        dueAmount: totals.dueAmount,
        paidAmount: totals.paidAmount,
        subtotalAmount: totals.subtotalAmount,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        notes: data.notes ?? null,
        receivedAt: shouldReceiveNow ? new Date() : existing.receivedAt,
        items: {
          create: items
        }
      },
      include: {
        items: true,
        supplier: true
      }
    });

    if (shouldReceiveNow) {
      await applyProductStock(tx, context.organizationId, context.storeId, purchase.id, items);
      await settlePreordersForProducts(tx, context.storeId, productIdsOf(items));
    } else if (existing.receivedAt) {
      await applyProductStock(
        tx,
        context.organizationId,
        context.storeId,
        purchase.id,
        stockChangesBetween(existing.items, items),
        "Purchase updated"
      );
      // Editing a received purchase moves stock in either direction, so this
      // has to run for a correction downwards too — a line that was settled on
      // stock since taken away is waiting again.
      await settlePreordersForProducts(tx, context.storeId, [
        ...productIdsOf(existing.items),
        ...productIdsOf(items)
      ]);
    }

    return purchase;
  });
}

export async function markPurchaseReceived(context: PurchaseContext, purchaseId: string) {
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.findFirst({
      where: {
        id: purchaseId,
        organizationId: context.organizationId,
        storeId: context.storeId
      },
      include: {
        items: true
      }
    });

    if (!purchase) {
      return null;
    }

    if (purchase.status === "CANCELLED") {
      throw new Error("Cancelled purchases cannot be received.");
    }

    if (!purchase.receivedAt) {
      await applyProductStock(tx, context.organizationId, context.storeId, purchase.id, purchase.items);
      await settlePreordersForProducts(tx, context.storeId, productIdsOf(purchase.items));
    }

    return tx.purchase.update({
      where: {
        id: purchaseId
      },
      data: {
        receivedAt: purchase.receivedAt ?? new Date(),
        status: "RECEIVED"
      }
    });
  });
}

export async function cancelPurchase(context: PurchaseContext, purchaseId: string) {
  const result = await prisma.purchase.updateMany({
    where: {
      id: purchaseId,
      organizationId: context.organizationId,
      storeId: context.storeId
    },
    data: {
      status: "CANCELLED"
    }
  });

  return result.count > 0;
}

export async function assertPurchaseStatus(value: unknown): Promise<PurchaseStatus | "ALL"> {
  if (!value || value === "ALL") return "ALL";
  return purchaseStatusSchema.parse(value);
}

async function createPurchaseNumber(storeId: string) {
  const count = await countPurchasesForStore(storeId);

  for (let offset = 1; offset < 20; offset += 1) {
    const purchaseNumber = `PUR-${String(count + offset).padStart(6, "0")}`;
    if (!(await getPurchaseNumberExists(storeId, purchaseNumber))) {
      return purchaseNumber;
    }
  }

  return `PUR-${Date.now()}`;
}

function parsePurchaseDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Use a valid purchase date.");
  }

  return date;
}

async function assertSupplierBelongsToOrganization(
  tx: TransactionClient,
  organizationId: string,
  supplierId: string
) {
  const supplier = await tx.supplier.findFirst({
    where: {
      id: supplierId,
      organizationId
    },
    select: {
      id: true
    }
  });

  if (!supplier) {
    throw new Error("Supplier not found for this organization.");
  }
}

async function prepareItems(tx: TransactionClient, storeId: string, items: PurchaseItemInput[]) {
  const prepared: PreparedPurchaseItem[] = [];

  for (const item of items) {
    let productName = item.productName?.trim();
    let sku = item.sku;

    if (item.productId) {
      const product = await tx.product.findFirst({
        where: {
          id: item.productId,
          storeId
        },
        select: {
          id: true,
          sku: true,
          title: true
        }
      });

      if (!product) {
        throw new Error("Selected product was not found for this store.");
      }

      productName = product.title;
      sku = product.sku ?? sku;
    }

    if (!productName) {
      throw new Error("Each item needs a product name.");
    }

    const unitCostCents = moneyToCents(item.unitCost);
    const totalCostCents = unitCostCents * item.quantity;

    prepared.push({
      ...(item.productId ? { productId: item.productId } : {}),
      productName,
      quantity: item.quantity,
      ...(sku ? { sku } : {}),
      totalCost: centsToMoney(totalCostCents),
      unitCost: centsToMoney(unitCostCents)
    });
  }

  return prepared;
}

function calculateTotals(
  items: PreparedPurchaseItem[],
  discountAmount: string,
  taxAmount: string,
  paidAmount: string
) {
  const subtotalCents = items.reduce((total, item) => total + moneyToCents(item.totalCost), 0);
  const discountCents = Math.min(moneyToCents(discountAmount), subtotalCents);
  const taxCents = moneyToCents(taxAmount);
  const totalCents = Math.max(subtotalCents - discountCents + taxCents, 0);
  const paidCents = Math.min(moneyToCents(paidAmount), totalCents);
  const dueCents = Math.max(totalCents - paidCents, 0);

  return {
    discountAmount: centsToMoney(discountCents),
    dueAmount: centsToMoney(dueCents),
    paidAmount: centsToMoney(paidCents),
    subtotalAmount: centsToMoney(subtotalCents),
    taxAmount: centsToMoney(taxCents),
    totalAmount: centsToMoney(totalCents)
  };
}

/** The products a delivery touched, deduplicated, ignoring free-text lines. */
function productIdsOf(items: Array<{ productId?: string | null }>) {
  return [...new Set(items.map((item) => item.productId).filter((id): id is string => Boolean(id)))];
}

function stockChangesBetween(
  previous: Array<{ productId?: string | null; productName?: string; quantity: number }>,
  next: Array<{ productId?: string | null; productName?: string; quantity: number }>
) {
  const changes = new Map<string, { productId: string; productName?: string; quantity: number }>();

  function add(items: typeof previous, sign: number) {
    for (const item of items) {
      if (!item.productId) continue;

      const entry = changes.get(item.productId) ?? {
        productId: item.productId,
        ...(item.productName ? { productName: item.productName } : {}),
        quantity: 0
      };

      entry.quantity += sign * item.quantity;
      changes.set(item.productId, entry);
    }
  }

  add(next, 1);
  add(previous, -1);

  return Array.from(changes.values()).filter((change) => change.quantity !== 0);
}

async function applyProductStock(
  tx: TransactionClient,
  organizationId: string,
  storeId: string,
  purchaseId: string,
  items: Array<{ productId?: string | null; productName?: string; quantity: number }>,
  reason = "Purchase received"
) {
  for (const item of items) {
    if (!item.productId || item.quantity === 0) continue;

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

    if (!product) {
      throw new Error(`${item.productName ?? "Selected product"} was not found for this store.`);
    }

    const previousQuantity = product.stockQuantity;
    // No floor at zero. It was harmless when stock could not go under, but a
    // pre-ordered product sits at minus what it owes, and clamping would wipe
    // that debt the moment a partial delivery arrived — seven owed, four
    // received, and the remaining three would vanish from every list that
    // reads negative stock.
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
        quantityChange: newQuantity - previousQuantity,
        reason,
        sourceId: purchaseId,
        sourceType: "PURCHASE",
        storeId,
        type: item.quantity > 0 ? "STOCK_IN" : "STOCK_OUT"
      }
    });
  }
}

function moneyToCents(value: string) {
  const [whole = "0", fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2));
}

function centsToMoney(value: number) {
  return (value / 100).toFixed(2);
}

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
