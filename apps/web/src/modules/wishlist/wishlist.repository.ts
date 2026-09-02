import { randomUUID } from "node:crypto";
import { prisma } from "@dash/db";
import type { WishlistDemandRow } from "./wishlist.types";

/**
 * The only place that touches the database for wishlists, and every query here
 * is scoped by `storeId` — a token alone must never be enough to read a list,
 * or a cookie carried across a subdomain would open somebody else's shop.
 *
 * Raw SQL rather than `prisma.wishlistItem`, matching
 * `ai-provider.repository.ts` and `product-content.repository.ts`: the model is
 * in `schema.prisma` so `db:push` creates it, but a checkout that has not re-run
 * `db:generate` has a client that has never heard of it. The idempotent DDL
 * below means a save works on a database nobody has migrated.
 */

export type WishlistRow = {
  createdAt: Date;
  productId: string;
};

let ensurePromise: Promise<void> | null = null;

/** One shopper's saved product ids and when each was saved, newest first. */
export async function findWishlistRows(storeId: string, token: string): Promise<WishlistRow[]> {
  await ensureWishlistSchema();

  return prisma.$queryRawUnsafe<WishlistRow[]>(
    `
    SELECT "productId", "createdAt"
    FROM ${tableName("WishlistItem")}
    WHERE "storeId" = $1 AND "token" = $2
    ORDER BY "createdAt" DESC
  `,
    storeId,
    token
  );
}

export async function countWishlistItems(storeId: string, token: string): Promise<number> {
  await ensureWishlistSchema();

  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `
    SELECT COUNT(*)::bigint AS count
    FROM ${tableName("WishlistItem")}
    WHERE "storeId" = $1 AND "token" = $2
  `,
    storeId,
    token
  );

  return Number(rows[0]?.count ?? 0);
}

/**
 * Saves a product, or does nothing if it was already saved.
 *
 * Returns whether a row was created, which is what lets `toggleWishlistItem`
 * decide in one round trip instead of reading before writing and racing a second
 * tab against itself.
 */
export async function insertWishlistItem(storeId: string, token: string, productId: string) {
  await ensureWishlistSchema();

  const inserted = await prisma.$executeRawUnsafe(
    `
    INSERT INTO ${tableName("WishlistItem")} ("id", "storeId", "token", "productId")
    VALUES ($1, $2, $3, $4)
    ON CONFLICT ("storeId", "token", "productId") DO NOTHING
  `,
    randomUUID(),
    storeId,
    token,
    productId
  );

  return inserted > 0;
}

export async function deleteWishlistItem(storeId: string, token: string, productId: string) {
  await ensureWishlistSchema();

  const deleted = await prisma.$executeRawUnsafe(
    `
    DELETE FROM ${tableName("WishlistItem")}
    WHERE "storeId" = $1 AND "token" = $2 AND "productId" = $3
  `,
    storeId,
    token,
    productId
  );

  return deleted > 0;
}

export async function deleteWishlist(storeId: string, token: string) {
  await ensureWishlistSchema();

  await prisma.$executeRawUnsafe(
    `
    DELETE FROM ${tableName("WishlistItem")}
    WHERE "storeId" = $1 AND "token" = $2
  `,
    storeId,
    token
  );
}

/**
 * How many shoppers saved each product, best first — the seller's half of the
 * feature.
 *
 * Joined to `Product` rather than counted alone so a row that no longer resolves
 * to a live product cannot appear as a nameless id, and narrowed to ACTIVE and
 * PUBLIC for the same reason the storefront is: demand for something the shop
 * has stopped selling is not something to act on.
 */
export async function findWishlistDemand(input: {
  limit: number;
  since: Date;
  storeId: string;
}): Promise<WishlistDemandRow[]> {
  await ensureWishlistSchema();

  const rows = await prisma.$queryRawUnsafe<
    Array<{ productId: string; saves: bigint; slug: string; stockQuantity: number; title: string }>
  >(
    `
    SELECT
      w."productId" AS "productId",
      COUNT(*)::bigint AS saves,
      p."slug" AS slug,
      p."stockQuantity" AS "stockQuantity",
      p."title" AS title
    FROM ${tableName("WishlistItem")} w
    JOIN ${tableName("Product")} p ON p."id" = w."productId"
    WHERE w."storeId" = $1
      AND w."createdAt" >= $2
      AND p."storeId" = $1
      AND p."status" = 'ACTIVE'
      AND p."visibility" = 'PUBLIC'
    GROUP BY w."productId", p."slug", p."stockQuantity", p."title"
    ORDER BY saves DESC, p."title" ASC
    LIMIT $3
  `,
    input.storeId,
    input.since,
    input.limit
  );

  return rows.map((row) => ({
    productId: row.productId,
    saves: Number(row.saves),
    slug: row.slug,
    stockQuantity: row.stockQuantity,
    title: row.title
  }));
}

/**
 * When each save happened, for the report's trend line.
 *
 * Dates and nothing else, fed straight into the reports module's `timeSeries`
 * the way the order reports feed it their rows — bucketing in SQL would put the
 * store's timezone in two places, and `timeSeries` already does it in the one
 * the rest of the reports agree on.
 */
export async function findWishlistSaveDates(input: { since: Date; storeId: string }) {
  await ensureWishlistSchema();

  return prisma.$queryRawUnsafe<Array<{ createdAt: Date }>>(
    `
    SELECT "createdAt"
    FROM ${tableName("WishlistItem")}
    WHERE "storeId" = $1 AND "createdAt" >= $2
    ORDER BY "createdAt" ASC
  `,
    input.storeId,
    input.since
  );
}

/** Totals for the report header: saves in the window, and how many lists they came from. */
export async function getWishlistTotals(input: { since: Date; storeId: string }) {
  await ensureWishlistSchema();

  const rows = await prisma.$queryRawUnsafe<
    Array<{ products: bigint; saves: bigint; shoppers: bigint }>
  >(
    `
    SELECT
      COUNT(*)::bigint AS saves,
      COUNT(DISTINCT "token")::bigint AS shoppers,
      COUNT(DISTINCT "productId")::bigint AS products
    FROM ${tableName("WishlistItem")}
    WHERE "storeId" = $1 AND "createdAt" >= $2
  `,
    input.storeId,
    input.since
  );

  return {
    products: Number(rows[0]?.products ?? 0),
    saves: Number(rows[0]?.saves ?? 0),
    shoppers: Number(rows[0]?.shoppers ?? 0)
  };
}

export function ensureWishlistSchema() {
  ensurePromise ??= createWishlistSchema();

  return ensurePromise;
}

async function createWishlistSchema() {
  const schema = getDatabaseSchemaName();

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${schema}"."WishlistItem" (
      "id" TEXT PRIMARY KEY,
      "storeId" TEXT NOT NULL,
      "token" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "WishlistItem_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "${schema}"."Store"("id") ON DELETE CASCADE,
      CONSTRAINT "WishlistItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "${schema}"."Product"("id") ON DELETE CASCADE
    )
  `);
  // The toggle depends on this one: `ON CONFLICT DO NOTHING` needs a constraint
  // to conflict against, and without it saving twice would make two rows and the
  // heart would never turn back off.
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "WishlistItem_storeId_token_productId_key" ON "${schema}"."WishlistItem" ("storeId", "token", "productId")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "WishlistItem_storeId_token_idx" ON "${schema}"."WishlistItem" ("storeId", "token")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "WishlistItem_storeId_productId_idx" ON "${schema}"."WishlistItem" ("storeId", "productId")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "WishlistItem_productId_idx" ON "${schema}"."WishlistItem" ("productId")`
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
