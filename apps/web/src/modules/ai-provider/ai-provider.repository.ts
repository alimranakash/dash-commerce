import { randomUUID } from "node:crypto";
import { prisma, type Prisma } from "@dash/db";

type AiSettingClient = Prisma.TransactionClient | typeof prisma;

/** The row as stored. The two cipher columns never leave the server. */
export type StoreAiSettingRecord = {
  brandVoice: string | null;
  contentLanguage: string;
  contentTone: string;
  defaultProvider: string;
  geminiApiKeyCipher: string | null;
  geminiApiKeyHint: string | null;
  geminiModel: string;
  openaiApiKeyCipher: string | null;
  openaiApiKeyHint: string | null;
  openaiModel: string;
  /** Whether the AI Shopping Agent answers customers on the storefront. */
  shoppingAgentEnabled: boolean;
};

const COLUMNS = [
  "brandVoice",
  "contentLanguage",
  "contentTone",
  "defaultProvider",
  "geminiApiKeyCipher",
  "geminiApiKeyHint",
  "geminiModel",
  "openaiApiKeyCipher",
  "openaiApiKeyHint",
  "openaiModel",
  "shoppingAgentEnabled"
] as const;

let ensurePromise: Promise<void> | null = null;

/**
 * Raw SQL rather than `prisma.storeAiSetting`, matching
 * `product-content.repository.ts` and `product-taxonomy.service.ts`: the model
 * is in `schema.prisma` so `db:push` creates it, but a checkout that has not
 * re-run `db:generate` has a client that has never heard of it. The idempotent
 * DDL below means the settings page works on a database nobody has migrated.
 */
export async function getStoreAiSettingRecord(
  storeId: string
): Promise<StoreAiSettingRecord | null> {
  await ensureStoreAiSettingSchema();

  const rows = await prisma.$queryRawUnsafe<StoreAiSettingRecord[]>(
    `
    SELECT ${COLUMNS.map((column) => `"${column}"`).join(", ")}
    FROM ${tableName("StoreAiSetting")}
    WHERE "storeId" = $1
    LIMIT 1
  `,
    storeId
  );

  return rows[0] ?? null;
}

/**
 * Replace the whole row.
 *
 * Every column is written on every save, including the ciphers — the service
 * has already resolved "set / clear / keep" for those against the existing row,
 * so what arrives here is the intended final state rather than a patch. That
 * keeps the one decision about whether a credential survives in one place.
 */
export async function upsertStoreAiSettingRecord(storeId: string, values: StoreAiSettingRecord) {
  await ensureStoreAiSettingSchema();

  const params: Array<boolean | string | null> = [
    randomUUID(),
    storeId,
    ...COLUMNS.map((column) => values[column])
  ];
  const placeholders = COLUMNS.map((_, index) => `$${index + 3}`);
  const updates = COLUMNS.map((column) => `"${column}" = EXCLUDED."${column}"`);

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO ${tableName("StoreAiSetting")} ("id", "storeId", ${COLUMNS.map((column) => `"${column}"`).join(", ")})
    VALUES ($1, $2, ${placeholders.join(", ")})
    ON CONFLICT ("storeId")
    DO UPDATE SET ${updates.join(", ")}, "updatedAt" = CURRENT_TIMESTAMP
  `,
    ...params
  );
}

export function ensureStoreAiSettingSchema(db: AiSettingClient = prisma) {
  if (db !== prisma) {
    return createStoreAiSettingSchema(db);
  }

  ensurePromise ??= createStoreAiSettingSchema(db);

  return ensurePromise;
}

async function createStoreAiSettingSchema(db: AiSettingClient) {
  const schema = getDatabaseSchemaName();

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${schema}"."StoreAiSetting" (
      "id" TEXT PRIMARY KEY,
      "storeId" TEXT NOT NULL,
      "defaultProvider" TEXT NOT NULL DEFAULT 'storeos',
      "geminiApiKeyCipher" TEXT,
      "geminiApiKeyHint" TEXT,
      "geminiModel" TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
      "openaiApiKeyCipher" TEXT,
      "openaiApiKeyHint" TEXT,
      "openaiModel" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
      "contentTone" TEXT NOT NULL DEFAULT 'friendly',
      "contentLanguage" TEXT NOT NULL DEFAULT 'en',
      "brandVoice" TEXT,
      "shoppingAgentEnabled" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "StoreAiSetting_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "${schema}"."Store"("id") ON DELETE CASCADE
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "StoreAiSetting_storeId_key" ON "${schema}"."StoreAiSetting" ("storeId")`
  );
  // For the databases that already have the table. `CREATE TABLE IF NOT EXISTS`
  // is a no-op on those, so a column added after the table shipped needs its own
  // idempotent statement — the same pattern `demo-schema.ts` uses. Defaulted to
  // false, which is the state every existing shop should be in: nobody has a
  // customer-facing assistant until they ask for one.
  await db.$executeRawUnsafe(
    `ALTER TABLE "${schema}"."StoreAiSetting" ADD COLUMN IF NOT EXISTS "shoppingAgentEnabled" BOOLEAN NOT NULL DEFAULT false`
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
