import { prisma } from "@dash/db";

/**
 * Self-healing DDL for the blocklist, in the same shape as
 * `ensureFakeOrderRiskSchema` — see CLAUDE.md.
 *
 * Two objects, both additive and idempotent: the `BlockedIp` table itself, and
 * the `Order.ipAddress` column the blocklist is built from. The column lives
 * here rather than in the fake-orders file because this feature owns it, and
 * `ensureFakeOrderRiskSchema` awaits this function so an order read cannot
 * out-run it.
 *
 * `db push` is still the primary path (CLAUDE.md); this only makes the first
 * request on a database that has not had it run survive rather than 500.
 */

let ensurePromise: Promise<void> | null = null;

export function ensureBlockedIpSchema() {
  ensurePromise ??= addBlockedIpObjects().catch((error) => {
    // A failed migration must not be cached as "done" — the next caller retries.
    ensurePromise = null;

    throw error;
  });

  return ensurePromise;
}

async function addBlockedIpObjects() {
  const schema = getDatabaseSchemaName();
  const blockedIpTable = `"${schema}"."BlockedIp"`;
  const orderTable = `"${schema}"."Order"`;

  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS ${blockedIpTable} (
       "id" TEXT NOT NULL,
       "storeId" TEXT NOT NULL,
       "ipAddress" TEXT NOT NULL,
       "reason" TEXT,
       "expiresAt" TIMESTAMP(3),
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       CONSTRAINT "BlockedIp_pkey" PRIMARY KEY ("id")
     )`
  );

  // Named to match what `db push` generates from schema.prisma, so whichever
  // runs first the other finds its work already done.
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "BlockedIp_storeId_ipAddress_key"
       ON ${blockedIpTable} ("storeId", "ipAddress")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "BlockedIp_storeId_idx" ON ${blockedIpTable} ("storeId")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "BlockedIp_storeId_expiresAt_idx"
       ON ${blockedIpTable} ("storeId", "expiresAt")`
  );

  await prisma.$executeRawUnsafe(
    `DO $$ BEGIN
       ALTER TABLE ${blockedIpTable}
         ADD CONSTRAINT "BlockedIp_storeId_fkey"
         FOREIGN KEY ("storeId") REFERENCES "${schema}"."Store"("id") ON DELETE CASCADE;
     EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  );

  await prisma.$executeRawUnsafe(
    `ALTER TABLE ${orderTable} ADD COLUMN IF NOT EXISTS "ipAddress" TEXT`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Order_storeId_ipAddress_idx" ON ${orderTable} ("storeId", "ipAddress")`
  );
}

export function getDatabaseSchemaName() {
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
