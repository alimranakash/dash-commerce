import { prisma } from "@dash/db";
import {
  getInventoryProductsForStore,
  getInventorySummaryForStore,
  getStockMovementsForProduct,
  getStockMovementsForStore,
  type StockMovementFilters
} from "./inventory.repository";
import { stockAdjustmentSchema, type StockAdjustmentInput } from "./inventory.schema";

export {
  getInventoryProductsForStore,
  getInventorySummaryForStore,
  getStockMovementsForProduct,
  getStockMovementsForStore
};
export type { StockMovementFilters };

type InventoryContext = {
  createdBy?: string;
  organizationId: string;
  storeId: string;
};

export async function adjustProductStock(context: InventoryContext, input: StockAdjustmentInput) {
  const data = stockAdjustmentSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: {
        id: data.productId,
        storeId: context.storeId
      },
      select: {
        id: true,
        stockQuantity: true,
        title: true
      }
    });

    if (!product) {
      throw new Error("Product not found for this store.");
    }

    const previousQuantity = product.stockQuantity;
    const newQuantity = calculateAdjustedQuantity(previousQuantity, data.adjustmentType, data.quantity);

    if (newQuantity < 0 && !data.allowNegative) {
      throw new Error("Stock cannot go below zero.");
    }

    await tx.product.update({
      where: {
        id: product.id
      },
      data: {
        stockQuantity: newQuantity
      }
    });

    return tx.stockMovement.create({
      data: {
        createdBy: context.createdBy ?? null,
        newQuantity,
        notes: data.notes ?? null,
        organizationId: context.organizationId,
        previousQuantity,
        productId: product.id,
        quantityChange: newQuantity - previousQuantity,
        reason: data.reason,
        sourceType: "MANUAL",
        storeId: context.storeId,
        type: "ADJUSTMENT"
      }
    });
  });
}

function calculateAdjustedQuantity(current: number, type: StockAdjustmentInput["adjustmentType"], quantity: number) {
  if (type === "INCREASE") return current + quantity;
  if (type === "DECREASE") return current - quantity;

  return quantity;
}
