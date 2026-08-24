import { prisma, type Prisma } from "@dash/db";

type ReturnSchemaClient = Prisma.TransactionClient | typeof prisma;

let ensurePromise: Promise<void> | null = null;

/**
 * Creates the two return tables if the live database predates them.
 *
 * Same contract as ensureProductTaxonomySchema: `packages/db/prisma` has no
 * migrations directory, so a deployed database only gains new tables when
 * someone runs `db:push`. Awaiting this at the top of every returns read and
 * write is what keeps the feature from 500-ing on a database that has not been
 * pushed yet. The DDL mirrors the OrderReturn/OrderReturnItem models in
 * schema.prisma exactly, so `db push` afterwards is a no-op.
 */
export function ensureOrderReturnSchema(db: ReturnSchemaClient = prisma) {
  if (db !== prisma) {
    return createOrderReturnSchema(db);
  }

  ensurePromise ??= createOrderReturnSchema(db);

  return ensurePromise;
}

async function createOrderReturnSchema(db: ReturnSchemaClient) {
  const schema = getDatabaseSchemaName();

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${schema}"."OrderReturn" (
      "id" TEXT PRIMARY KEY,
      "storeId" TEXT NOT NULL,
      "orderId" TEXT NOT NULL,
      "customerId" TEXT,
      "returnNumber" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'REQUESTED',
      "reason" TEXT NOT NULL DEFAULT 'OTHER',
      "reasonNote" TEXT,
      "customerName" TEXT NOT NULL,
      "customerPhone" TEXT NOT NULL,
      "currency" TEXT NOT NULL,
      "itemsAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
      "replacementAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
      "shippingRefundAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
      "restockingFee" DECIMAL(12, 2) NOT NULL DEFAULT 0,
      "refundAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
      "dueAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
      "refundMethod" TEXT NOT NULL DEFAULT 'ORIGINAL_PAYMENT',
      "refundReference" TEXT,
      "restockItems" BOOLEAN NOT NULL DEFAULT TRUE,
      "resolutionNote" TEXT,
      "approvedAt" TIMESTAMP(3),
      "rejectedAt" TIMESTAMP(3),
      "receivedAt" TIMESTAMP(3),
      "restockedAt" TIMESTAMP(3),
      "refundedAt" TIMESTAMP(3),
      "completedAt" TIMESTAMP(3),
      "cancelledAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "OrderReturn_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "${schema}"."Store"("id") ON DELETE CASCADE,
      CONSTRAINT "OrderReturn_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "${schema}"."Order"("id") ON DELETE CASCADE,
      CONSTRAINT "OrderReturn_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "${schema}"."Customer"("id") ON DELETE SET NULL
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "OrderReturn_store_number_key" ON "${schema}"."OrderReturn" ("storeId", "returnNumber")`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "OrderReturn_store_type_idx" ON "${schema}"."OrderReturn" ("storeId", "type")`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "OrderReturn_store_status_idx" ON "${schema}"."OrderReturn" ("storeId", "status")`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "OrderReturn_order_idx" ON "${schema}"."OrderReturn" ("orderId")`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "OrderReturn_customer_idx" ON "${schema}"."OrderReturn" ("customerId")`
  );

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${schema}"."OrderReturnItem" (
      "id" TEXT PRIMARY KEY,
      "returnId" TEXT NOT NULL,
      "orderItemId" TEXT,
      "productId" TEXT,
      "title" TEXT NOT NULL,
      "sku" TEXT,
      "imageUrl" TEXT,
      "unitPrice" DECIMAL(12, 2) NOT NULL,
      "quantity" INTEGER NOT NULL,
      "total" DECIMAL(12, 2) NOT NULL,
      "replacementProductId" TEXT,
      "replacementTitle" TEXT,
      "replacementSku" TEXT,
      "replacementUnitPrice" DECIMAL(12, 2),
      "replacementQuantity" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "OrderReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "${schema}"."OrderReturn"("id") ON DELETE CASCADE,
      CONSTRAINT "OrderReturnItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "${schema}"."OrderItem"("id") ON DELETE SET NULL,
      CONSTRAINT "OrderReturnItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "${schema}"."Product"("id") ON DELETE SET NULL,
      CONSTRAINT "OrderReturnItem_replacementProductId_fkey" FOREIGN KEY ("replacementProductId") REFERENCES "${schema}"."Product"("id") ON DELETE SET NULL
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "OrderReturnItem_return_idx" ON "${schema}"."OrderReturnItem" ("returnId")`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "OrderReturnItem_product_idx" ON "${schema}"."OrderReturnItem" ("productId")`
  );
}

function getDatabaseSchemaName() {
  const fallbackSchema = "public";
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    return fallbackSchema;
  }

  try {
    const schema = new URL(connectionString).searchParams.get("schema") ?? fallbackSchema;

    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(schema) ? schema : fallbackSchema;
  } catch {
    return fallbackSchema;
  }
}
