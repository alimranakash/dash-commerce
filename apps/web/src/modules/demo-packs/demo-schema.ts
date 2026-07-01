import type { Prisma, prisma } from "@dash/db";

type DemoSchemaClient = Prisma.TransactionClient | typeof prisma;

export async function ensureDemoContentSchema(db: DemoSchemaClient) {
  const schema = getDatabaseSchemaName();

  await db.$executeRawUnsafe(`ALTER TABLE "${schema}"."Store" ADD COLUMN IF NOT EXISTS "activeDemoPack" TEXT NOT NULL DEFAULT 'general-demo-v1'`);
  await db.$executeRawUnsafe(`ALTER TABLE "${schema}"."Store" ADD COLUMN IF NOT EXISTS "demoPackInstalledAt" TIMESTAMP(3)`);
  await db.$executeRawUnsafe(`ALTER TABLE "${schema}"."Product" ADD COLUMN IF NOT EXISTS "isDemoContent" BOOLEAN NOT NULL DEFAULT FALSE`);
  await db.$executeRawUnsafe(`ALTER TABLE "${schema}"."Product" ADD COLUMN IF NOT EXISTS "demoPackId" TEXT`);
  await db.$executeRawUnsafe(`ALTER TABLE "${schema}"."Category" ADD COLUMN IF NOT EXISTS "isDemoContent" BOOLEAN NOT NULL DEFAULT FALSE`);
  await db.$executeRawUnsafe(`ALTER TABLE "${schema}"."Category" ADD COLUMN IF NOT EXISTS "demoPackId" TEXT`);
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
