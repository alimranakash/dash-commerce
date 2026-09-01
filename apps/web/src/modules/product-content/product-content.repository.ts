import { randomUUID } from "node:crypto";
import { prisma, type Prisma } from "@dash/db";
import type { ProductContentSource } from "./product-content.schema";

type ProductContentClient = Prisma.TransactionClient | typeof prisma;

/**
 * The five columns that live on `ProductContent`. Title, short description and
 * description are not among them — those are `Product` columns and are written
 * through `updateProduct`, so there is never a second copy of a field the
 * storefront already renders.
 */
export type ProductContentRecord = {
  features: string | null;
  keywords: string | null;
  lastGeneratedAt: Date | null;
  lastSource: string | null;
  metaDescription: string | null;
  seoTitle: string | null;
  socialCaption: string | null;
};

export type ProductContentWrite = {
  features?: string | null;
  keywords?: string | null;
  metaDescription?: string | null;
  seoTitle?: string | null;
  socialCaption?: string | null;
};

const CONTENT_COLUMNS = [
  "features",
  "keywords",
  "metaDescription",
  "seoTitle",
  "socialCaption"
] as const;

let ensurePromise: Promise<void> | null = null;

/**
 * The two store fields the composer and the StoreOS envelope quote back to the
 * seller. Read here rather than in the service so this domain keeps to the rule
 * that only its repository touches `prisma`.
 */
export async function getStoreContentContext(storeId: string) {
  return prisma.store.findUnique({
    select: {
      currency: true,
      name: true
    },
    where: {
      id: storeId
    }
  });
}

/**
 * Raw SQL rather than `prisma.productContent`, matching
 * `product-taxonomy.service.ts`: the model is declared in `schema.prisma` so
 * `db:push` creates it, but a checkout that has not re-run `db:generate` still
 * has a client that has never heard of it. Going through `$queryRawUnsafe` plus
 * the idempotent DDL below means this feature works on a database nobody has
 * migrated yet, which is the pattern the rest of this app already relies on.
 */
export async function getProductContentRecord(
  storeId: string,
  productId: string
): Promise<ProductContentRecord | null> {
  await ensureProductContentSchema();

  const rows = await prisma.$queryRawUnsafe<ProductContentRecord[]>(
    `
    SELECT "features", "keywords", "lastGeneratedAt", "lastSource", "metaDescription",
           "seoTitle", "socialCaption"
    FROM ${tableName("ProductContent")}
    WHERE "storeId" = $1 AND "productId" = $2
    LIMIT 1
  `,
    storeId,
    productId
  );

  return rows[0] ?? null;
}

/**
 * Write the satellite row, touching only the columns the caller named.
 *
 * `values` carries one entry per field the seller actually applied, so an
 * untouched field keeps whatever was there — this is a partial update, not a
 * replace. `storeId` is in the WHERE clause as well as the INSERT so a product
 * id from another tenant updates nothing rather than the wrong row.
 */
export async function upsertProductContentRecord(input: {
  generatedAt?: Date | null;
  productId: string;
  source?: ProductContentSource | null;
  storeId: string;
  values: ProductContentWrite;
}) {
  await ensureProductContentSchema();

  const columns = CONTENT_COLUMNS.filter((column) => input.values[column] !== undefined);

  if (columns.length === 0 && !input.source) {
    return;
  }

  // $1..$3 are the row's identity; the value columns follow in a stable order so
  // the placeholder numbering below cannot drift from the parameter array.
  const params: Array<Date | null | string> = [randomUUID(), input.storeId, input.productId];
  const insertColumns: string[] = [];
  const insertPlaceholders: string[] = [];
  const updates: string[] = [];

  for (const column of columns) {
    params.push(input.values[column] ?? null);
    insertColumns.push(`"${column}"`);
    insertPlaceholders.push(`$${params.length}`);
    updates.push(`"${column}" = EXCLUDED."${column}"`);
  }

  if (input.source) {
    params.push(input.source);
    insertColumns.push(`"lastSource"`);
    insertPlaceholders.push(`$${params.length}`);
    updates.push(`"lastSource" = EXCLUDED."lastSource"`);

    params.push(input.generatedAt ?? new Date());
    insertColumns.push(`"lastGeneratedAt"`);
    insertPlaceholders.push(`$${params.length}`);
    updates.push(`"lastGeneratedAt" = EXCLUDED."lastGeneratedAt"`);
  }

  const columnList = insertColumns.length ? `, ${insertColumns.join(", ")}` : "";
  const valueList = insertPlaceholders.length ? `, ${insertPlaceholders.join(", ")}` : "";

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO ${tableName("ProductContent")} AS content ("id", "storeId", "productId"${columnList})
    VALUES ($1, $2, $3${valueList})
    ON CONFLICT ("productId")
    DO UPDATE SET ${updates.join(", ")}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE content."storeId" = $2
  `,
    ...params
  );
}

/**
 * Idempotent DDL for the satellite table, memoized per process the way
 * `ensureCategoryImageSchema` is. Awaited at the top of every read and write
 * above, so a database that predates this feature heals itself on first use.
 */
export function ensureProductContentSchema(db: ProductContentClient = prisma) {
  if (db !== prisma) {
    return createProductContentSchema(db);
  }

  ensurePromise ??= createProductContentSchema(db);

  return ensurePromise;
}

async function createProductContentSchema(db: ProductContentClient) {
  const schema = getDatabaseSchemaName();

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${schema}"."ProductContent" (
      "id" TEXT PRIMARY KEY,
      "storeId" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "features" TEXT,
      "seoTitle" TEXT,
      "metaDescription" TEXT,
      "keywords" TEXT,
      "socialCaption" TEXT,
      "lastSource" TEXT,
      "lastGeneratedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ProductContent_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "${schema}"."Store"("id") ON DELETE CASCADE,
      CONSTRAINT "ProductContent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "${schema}"."Product"("id") ON DELETE CASCADE
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "ProductContent_productId_key" ON "${schema}"."ProductContent" ("productId")`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ProductContent_storeId_idx" ON "${schema}"."ProductContent" ("storeId")`
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
