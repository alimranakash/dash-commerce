import { randomUUID } from "node:crypto";
import { prisma, type Prisma } from "@dash/db";

/**
 * The only place that touches the database for free shipping.
 *
 * Raw SQL for the reason `sales-notifications.repository.ts` gives: the model is
 * in `schema.prisma`, so `db:push` creates it, but a checkout that has not
 * re-run `db:generate` has a client that has never heard of it — and this row is
 * read on every cart, every mini cart and **every checkout**. A shop that has
 * never configured free shipping must not be able to break its own checkout on a
 * database nobody migrated.
 *
 * `threshold` is TEXT rather than a numeric column for the same idempotency
 * reason the enum-ish columns elsewhere are text: the runtime DDL has to be safe
 * to re-run, and a fixed-2 string is what `Order.shippingAmount` already stores,
 * so money never round-trips through a float on its way here.
 */

type FreeShippingClient = Prisma.TransactionClient | typeof prisma;

/** The row as stored. Column names and types match the DDL below exactly. */
export type FreeShippingRecord = {
  barEnabled: boolean;
  barSuccessText: string;
  barText: string;
  enabled: boolean;
  /** Comma-separated surface names. */
  surfaces: string;
  /** Fixed-2 decimal string. */
  threshold: string;
  /** Comma-separated `ShippingZone` ids. Empty means every zone. */
  zoneIds: string;
};

const COLUMNS = [
  "barEnabled",
  "barSuccessText",
  "barText",
  "enabled",
  "surfaces",
  "threshold",
  "zoneIds"
] as const;

let ensurePromise: Promise<void> | null = null;

export async function getFreeShippingRecord(storeId: string): Promise<FreeShippingRecord | null> {
  await ensureFreeShippingSchema();

  const rows = await prisma.$queryRawUnsafe<FreeShippingRecord[]>(
    `
    SELECT ${COLUMNS.map((column) => `"${column}"`).join(", ")}
    FROM ${tableName("StoreFreeShipping")}
    WHERE "storeId" = $1
    LIMIT 1
  `,
    storeId
  );

  return rows[0] ?? null;
}

/**
 * Replace the whole row. The service has already merged the seller's form over
 * the stored values, so what arrives is the intended final state rather than a
 * patch — one place decides what a blank field means, and it is not here.
 */
export async function upsertFreeShippingRecord(storeId: string, values: FreeShippingRecord) {
  await ensureFreeShippingSchema();

  const params: Array<boolean | string> = [
    randomUUID(),
    storeId,
    ...COLUMNS.map((column) => values[column])
  ];
  const placeholders = COLUMNS.map((_, index) => `$${index + 3}`);
  const updates = COLUMNS.map((column) => `"${column}" = EXCLUDED."${column}"`);
  const columnList = COLUMNS.map((column) => `"${column}"`).join(", ");

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO ${tableName("StoreFreeShipping")} ("id", "storeId", ${columnList})
    VALUES ($1, $2, ${placeholders.join(", ")})
    ON CONFLICT ("storeId")
    DO UPDATE SET ${updates.join(", ")}, "updatedAt" = CURRENT_TIMESTAMP
  `,
    ...params
  );
}

/**
 * Whether any of these products earns free delivery on its own.
 *
 * Raw SQL and `LIMIT 1` rather than a Prisma `count`, for the reason the rest of
 * this file is raw: `Product.freeShipping` is a column added after the model
 * shipped, and a deploy whose generated client predates it would throw on a
 * typed read — inside `createCheckoutOrder`, which is the worst possible place
 * to find out. The idempotent `ALTER` below guarantees the column exists; this
 * asks for it in a way that does not need the client to have heard of it.
 *
 * Scoped by `storeId` as well as by id, so a product id guessed from another
 * tenant cannot buy free delivery here.
 */
export async function hasFreeShippingProduct(storeId: string, productIds: string[]) {
  if (productIds.length === 0) {
    return false;
  }

  await ensureFreeShippingSchema();

  const placeholders = productIds.map((_, index) => `$${index + 2}`).join(", ");
  const rows = await prisma.$queryRawUnsafe<Array<{ one: number }>>(
    `
    SELECT 1 AS one
    FROM ${tableName("Product")}
    WHERE "storeId" = $1 AND "id" IN (${placeholders}) AND "freeShipping" = true
    LIMIT 1
  `,
    storeId,
    ...productIds
  );

  return rows.length > 0;
}

export function ensureFreeShippingSchema(db: FreeShippingClient = prisma) {
  if (db !== prisma) {
    return createFreeShippingSchema(db);
  }

  ensurePromise ??= createFreeShippingSchema(db);

  return ensurePromise;
}

async function createFreeShippingSchema(db: FreeShippingClient) {
  const schema = getDatabaseSchemaName();

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${schema}"."StoreFreeShipping" (
      "id" TEXT PRIMARY KEY,
      "storeId" TEXT NOT NULL,
      "enabled" BOOLEAN NOT NULL DEFAULT false,
      "threshold" TEXT NOT NULL DEFAULT '0.00',
      "zoneIds" TEXT NOT NULL DEFAULT '',
      "barEnabled" BOOLEAN NOT NULL DEFAULT true,
      "barText" TEXT NOT NULL DEFAULT 'Add {amount} more to get FREE shipping',
      "barSuccessText" TEXT NOT NULL DEFAULT 'You have earned free shipping.',
      "surfaces" TEXT NOT NULL DEFAULT 'cart,mini_cart',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "StoreFreeShipping_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "${schema}"."Store"("id") ON DELETE CASCADE
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "StoreFreeShipping_storeId_key" ON "${schema}"."StoreFreeShipping" ("storeId")`
  );
  // The per-product route lives on `Product`, which is an old table this module
  // adds one column to — so it needs its own idempotent statement, exactly as
  // CLAUDE.md prescribes for a column a self-healing path reads. Without it a
  // checkout on a database that has not been pushed would fail on the read
  // above rather than simply finding nothing flagged.
  await db.$executeRawUnsafe(
    `ALTER TABLE "${schema}"."Product" ADD COLUMN IF NOT EXISTS "freeShipping" BOOLEAN NOT NULL DEFAULT false`
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

function tableName(name: string) {
  const schema = getDatabaseSchemaName().replace(/"/g, '""');
  const table = name.replace(/"/g, '""');

  return `"${schema}"."${table}"`;
}
