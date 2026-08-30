import { prisma } from "@dash/db";

/**
 * Adds `StoreApiKey.secretCipher` to a database that predates it.
 *
 * The same shape as `ensureCategoryImageSchema` and for the same reason: this
 * repo syncs with `db:push` rather than migrations, so a running deployment that
 * has not been pushed to yet would otherwise 500 on the settings page the moment
 * the column appears in a `select`. Memoized, so it costs one statement per
 * process rather than one per request.
 *
 * Authentication never selects this column, so the AI API keeps working whether
 * or not this has run.
 */

let ensurePromise: Promise<void> | null = null;

export function ensureApiKeySecretSchema() {
  ensurePromise ??= addSecretCipherColumn();

  return ensurePromise;
}

async function addSecretCipherColumn() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "${getDatabaseSchemaName()}"."StoreApiKey" ADD COLUMN IF NOT EXISTS "secretCipher" TEXT`
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
