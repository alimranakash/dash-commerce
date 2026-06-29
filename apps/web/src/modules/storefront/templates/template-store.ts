import { prisma } from "@dash/db";

export async function getStoreActiveTemplate(storeId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ activeTemplate: string | null }>>(
    `SELECT "activeTemplate" FROM "${getDatabaseSchemaName()}"."Store" WHERE "id" = $1 LIMIT 1`,
    storeId
  );

  return rows[0]?.activeTemplate ?? null;
}

export async function updateStoreActiveTemplate(storeId: string, templateId: string) {
  await prisma.$executeRawUnsafe(
    `UPDATE "${getDatabaseSchemaName()}"."Store" SET "activeTemplate" = $1 WHERE "id" = $2`,
    templateId,
    storeId
  );
}

export async function withStoreActiveTemplate<TStore extends { id: string }>(store: TStore) {
  return {
    ...store,
    activeTemplate: await getStoreActiveTemplate(store.id)
  };
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
