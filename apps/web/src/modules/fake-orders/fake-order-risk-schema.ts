import { prisma } from "@dash/db";

/**
 * Self-healing DDL for the stored risk assessment, in the same shape as
 * `ensureCategoryImageSchema` — see CLAUDE.md.
 *
 * The risk engine now writes its result onto the order instead of recomputing it
 * on every dashboard read, so these columns must exist before the first
 * assessment runs. Everything here is additive and idempotent: new enum values,
 * `ADD COLUMN IF NOT EXISTS`, and indexes.
 *
 * The expression index on the digits-only phone is what makes the per-phone
 * signal aggregate a lookup rather than a store-wide scan. `regexp_replace` is
 * IMMUTABLE, so it is indexable, and the expression is character-for-character
 * the one used by `getPhoneRiskSignals`. Prisma cannot express an expression
 * index, so it is the one object here that lives only in this file — `db push`
 * leaves it alone today, and if that ever changes the next process start
 * recreates it. The other three indexes are in schema.prisma as well; keep both
 * sides in sync.
 */

let ensurePromise: Promise<void> | null = null;

export function ensureFakeOrderRiskSchema() {
  ensurePromise ??= addRiskColumns().catch((error) => {
    // A failed migration must not be cached as "done" — the next caller retries.
    ensurePromise = null;

    throw error;
  });

  return ensurePromise;
}

async function addRiskColumns() {
  const schema = getDatabaseSchemaName();
  const orderTable = `"${schema}"."Order"`;

  for (const value of ["PENDING_REVIEW", "BLOCKED"]) {
    await prisma.$executeRawUnsafe(
      `ALTER TYPE "${schema}"."OrderVerificationStatus" ADD VALUE IF NOT EXISTS '${value}'`
    );
  }

  await prisma.$executeRawUnsafe(
    `DO $$ BEGIN
       CREATE TYPE "${schema}"."OrderRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
     EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  );

  await prisma.$executeRawUnsafe(
    `ALTER TABLE ${orderTable} ADD COLUMN IF NOT EXISTS "riskScore" INTEGER NOT NULL DEFAULT 0`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE ${orderTable} ADD COLUMN IF NOT EXISTS "riskLevel" "${schema}"."OrderRiskLevel" NOT NULL DEFAULT 'LOW'`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE ${orderTable} ADD COLUMN IF NOT EXISTS "riskFactors" JSONB`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE ${orderTable} ADD COLUMN IF NOT EXISTS "riskAssessedAt" TIMESTAMP(3)`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE ${orderTable} ADD COLUMN IF NOT EXISTS "verificationDecidedAt" TIMESTAMP(3)`
  );

  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Order_storeId_verificationStatus_idx" ON ${orderTable} ("storeId", "verificationStatus")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Order_storeId_riskLevel_idx" ON ${orderTable} ("storeId", "riskLevel")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Order_storeId_riskAssessedAt_idx" ON ${orderTable} ("storeId", "riskAssessedAt")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Order_storeId_normalizedPhone_idx" ON ${orderTable} ("storeId", (regexp_replace("customerPhone", '\\D', '', 'g')))`
  );

  // Seller decisions predate this column: an order that was already marked keeps
  // its decision instead of being handed back to the engine on first assessment.
  await prisma.$executeRawUnsafe(
    `UPDATE ${orderTable}
        SET "verificationDecidedAt" = COALESCE("verifiedAt", "markedFakeAt")
      WHERE "verificationDecidedAt" IS NULL
        AND ("verifiedAt" IS NOT NULL OR "markedFakeAt" IS NOT NULL)`
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
