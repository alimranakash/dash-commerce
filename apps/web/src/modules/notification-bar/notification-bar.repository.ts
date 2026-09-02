import { randomUUID } from "node:crypto";
import { prisma, type Prisma } from "@dash/db";

/**
 * The only place that touches the database for the Floating Notification Bar.
 *
 * One read and one write, both raw SQL, for the reason
 * `sales-notifications.repository.ts` gives: the model is in `schema.prisma`, so
 * `db:push` creates it, but a checkout that has not re-run `db:generate` has a
 * client that has never heard of it — and this row is read on **every storefront
 * page of every shop**. A bar nobody switched on must not be able to break a
 * storefront on a database nobody migrated.
 *
 * There is no query here for "which bars are live": liveness is decided from the
 * row's own two timestamps by a pure function the check can drive, so the
 * database is never asked a question about the clock.
 */

type NotificationBarClient = Prisma.TransactionClient | typeof prisma;

/** The row as stored. Column names and types match the DDL below exactly. */
export type NotificationBarRecord = {
  backgroundColor: string;
  buttonColor: string;
  buttonTextColor: string;
  ctaHref: string;
  ctaLabel: string;
  dismissDays: number;
  dismissible: boolean;
  display: string;
  enabled: boolean;
  endsAt: Date | null;
  gridAfter: number;
  headline: string;
  homeSlot: string;
  layout: string;
  message: string;
  position: string;
  productSlot: string;
  shopSlot: string;
  showCountdown: boolean;
  showOnMobile: boolean;
  startsAt: Date | null;
  /** Comma-separated surface names. TEXT for the reason the two slot columns
   * either side of it are: the runtime DDL has to be idempotent, and neither
   * `CREATE TYPE` nor an array column can be added that way without care. */
  surfaces: string;
  textColor: string;
};

const COLUMNS = [
  "backgroundColor",
  "buttonColor",
  "buttonTextColor",
  "ctaHref",
  "ctaLabel",
  "dismissDays",
  "dismissible",
  "display",
  "enabled",
  "endsAt",
  "gridAfter",
  "headline",
  "homeSlot",
  "layout",
  "message",
  "position",
  "productSlot",
  "shopSlot",
  "showCountdown",
  "showOnMobile",
  "startsAt",
  "surfaces",
  "textColor"
] as const;

let ensurePromise: Promise<void> | null = null;

export async function getNotificationBarRecord(
  storeId: string
): Promise<NotificationBarRecord | null> {
  await ensureNotificationBarSchema();

  const rows = await prisma.$queryRawUnsafe<NotificationBarRecord[]>(
    `
    SELECT ${COLUMNS.map((column) => `"${column}"`).join(", ")}
    FROM ${tableName("StoreNotificationBar")}
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
export async function upsertNotificationBarRecord(storeId: string, values: NotificationBarRecord) {
  await ensureNotificationBarSchema();

  const params: Array<Date | boolean | number | string | null> = [
    randomUUID(),
    storeId,
    ...COLUMNS.map((column) => values[column])
  ];
  const placeholders = COLUMNS.map((_, index) => `$${index + 3}`);
  const updates = COLUMNS.map((column) => `"${column}" = EXCLUDED."${column}"`);
  const columnList = COLUMNS.map((column) => `"${column}"`).join(", ");

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO ${tableName("StoreNotificationBar")} ("id", "storeId", ${columnList})
    VALUES ($1, $2, ${placeholders.join(", ")})
    ON CONFLICT ("storeId")
    DO UPDATE SET ${updates.join(", ")}, "updatedAt" = CURRENT_TIMESTAMP
  `,
    ...params
  );
}

export function ensureNotificationBarSchema(db: NotificationBarClient = prisma) {
  if (db !== prisma) {
    return createNotificationBarSchema(db);
  }

  ensurePromise ??= createNotificationBarSchema(db);

  return ensurePromise;
}

async function createNotificationBarSchema(db: NotificationBarClient) {
  const schema = getDatabaseSchemaName();

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${schema}"."StoreNotificationBar" (
      "id" TEXT PRIMARY KEY,
      "storeId" TEXT NOT NULL,
      "enabled" BOOLEAN NOT NULL DEFAULT false,
      "headline" TEXT NOT NULL DEFAULT '',
      "message" TEXT NOT NULL DEFAULT '',
      "ctaLabel" TEXT NOT NULL DEFAULT '',
      "ctaHref" TEXT NOT NULL DEFAULT '',
      "position" TEXT NOT NULL DEFAULT 'bottom',
      "layout" TEXT NOT NULL DEFAULT 'floating',
      "backgroundColor" TEXT NOT NULL DEFAULT '',
      "textColor" TEXT NOT NULL DEFAULT '#ffffff',
      "buttonColor" TEXT NOT NULL DEFAULT '#ffffff',
      "buttonTextColor" TEXT NOT NULL DEFAULT '',
      "showCountdown" BOOLEAN NOT NULL DEFAULT true,
      "showOnMobile" BOOLEAN NOT NULL DEFAULT true,
      "dismissible" BOOLEAN NOT NULL DEFAULT true,
      "dismissDays" INTEGER NOT NULL DEFAULT 1,
      "display" TEXT NOT NULL DEFAULT 'overlay',
      "surfaces" TEXT NOT NULL DEFAULT 'home,shop,product,other',
      "homeSlot" TEXT NOT NULL DEFAULT 'after_hero',
      "shopSlot" TEXT NOT NULL DEFAULT 'above_grid',
      "productSlot" TEXT NOT NULL DEFAULT 'below_cart',
      "gridAfter" INTEGER NOT NULL DEFAULT 4,
      "startsAt" TIMESTAMP(3),
      "endsAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "StoreNotificationBar_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "${schema}"."Store"("id") ON DELETE CASCADE
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "StoreNotificationBar_storeId_key" ON "${schema}"."StoreNotificationBar" ("storeId")`
  );

  // For databases that already have the table: `CREATE TABLE IF NOT EXISTS` is a
  // no-op on those, so every column added after the table shipped needs its own
  // idempotent statement — the same pattern `sales-notifications.repository.ts`
  // uses. Each default matches `NOTIFICATION_BAR_DEFAULTS`, and `overlay` plus
  // all four surfaces is deliberately the shop-wide floating bar the first
  // release published: a store that saved settings before placement existed goes
  // on behaving exactly as it did.
  for (const [column, definition] of PLACEMENT_COLUMNS) {
    await db.$executeRawUnsafe(
      `ALTER TABLE "${schema}"."StoreNotificationBar" ADD COLUMN IF NOT EXISTS "${column}" ${definition}`
    );
  }
}

/** Added after the table shipped; see the loop above. */
const PLACEMENT_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ["display", "TEXT NOT NULL DEFAULT 'overlay'"],
  ["surfaces", "TEXT NOT NULL DEFAULT 'home,shop,product,other'"],
  ["homeSlot", "TEXT NOT NULL DEFAULT 'after_hero'"],
  ["shopSlot", "TEXT NOT NULL DEFAULT 'above_grid'"],
  ["productSlot", "TEXT NOT NULL DEFAULT 'below_cart'"],
  ["gridAfter", "INTEGER NOT NULL DEFAULT 4"]
];

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
