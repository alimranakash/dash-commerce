import { prisma, type Prisma } from "@dash/db";

type CategoryImageSchemaClient = Prisma.TransactionClient | typeof prisma;

let ensurePromise: Promise<void> | null = null;

export function ensureCategoryImageSchema(db: CategoryImageSchemaClient = prisma) {
  if (db !== prisma) {
    return addCategoryImageColumn(db);
  }

  ensurePromise ??= addCategoryImageColumn(db);

  return ensurePromise;
}

async function addCategoryImageColumn(db: CategoryImageSchemaClient) {
  await db.$executeRawUnsafe(
    `ALTER TABLE "${getDatabaseSchemaName()}"."Category" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT`
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
