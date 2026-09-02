import { randomUUID } from "node:crypto";
import { prisma, type Prisma } from "@dash/db";
import { publicProductWhere } from "../storefront/resolver";
import type { SalesNotificationOrderStatus } from "./sales-notifications.schema";

/**
 * The only place that touches the database for Sales Notifications.
 *
 * Two reads and one write. The settings row is raw SQL for the reason
 * `ai-provider.repository.ts` gives — the model is in `schema.prisma`, so
 * `db:push` creates it, but a checkout that has not re-run `db:generate` has a
 * client that has never heard of it, and this row is read on **every storefront
 * page of every shop**. A widget nobody switched on must not be able to break a
 * storefront on a database nobody migrated.
 *
 * The event read is ordinary Prisma: `Order` and `OrderItem` are as old as the
 * app and no generated client is missing them.
 */

type SalesNotificationClient = Prisma.TransactionClient | typeof prisma;

/** The row as stored. Column names and types match the DDL below exactly. */
export type SalesNotificationSettingRecord = {
  displaySeconds: number;
  enabled: boolean;
  gapSeconds: number;
  initialDelaySeconds: number;
  lookbackDays: number;
  loopFeed: boolean;
  maxPerSession: number;
  nameDisplay: string;
  /** Comma-separated `OrderStatus` values. TEXT for the same reason the two
   * columns above are: the runtime DDL has to be idempotent, and neither
   * `CREATE TYPE` nor an array column can be added that way without care. */
  orderStatuses: string;
  position: string;
  requirePublicProduct: boolean;
  showLocation: boolean;
  showOnMobile: boolean;
  showProductImage: boolean;
  showTimeAgo: boolean;
};

const COLUMNS = [
  "displaySeconds",
  "enabled",
  "gapSeconds",
  "initialDelaySeconds",
  "lookbackDays",
  "loopFeed",
  "maxPerSession",
  "nameDisplay",
  "orderStatuses",
  "position",
  "requirePublicProduct",
  "showLocation",
  "showOnMobile",
  "showProductImage",
  "showTimeAgo"
] as const;

let ensurePromise: Promise<void> | null = null;

export async function getSalesNotificationSettingRecord(
  storeId: string
): Promise<SalesNotificationSettingRecord | null> {
  await ensureSalesNotificationSchema();

  const rows = await prisma.$queryRawUnsafe<SalesNotificationSettingRecord[]>(
    `
    SELECT ${COLUMNS.map((column) => `"${column}"`).join(", ")}
    FROM ${tableName("StoreSalesNotificationSetting")}
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
export async function upsertSalesNotificationSettingRecord(
  storeId: string,
  values: SalesNotificationSettingRecord
) {
  await ensureSalesNotificationSchema();

  const params: Array<boolean | number | string> = [
    randomUUID(),
    storeId,
    ...COLUMNS.map((column) => values[column])
  ];
  const placeholders = COLUMNS.map((_, index) => `$${index + 3}`);
  const updates = COLUMNS.map((column) => `"${column}" = EXCLUDED."${column}"`);
  const columnList = COLUMNS.map((column) => `"${column}"`).join(", ");

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO ${tableName("StoreSalesNotificationSetting")} ("id", "storeId", ${columnList})
    VALUES ($1, $2, ${placeholders.join(", ")})
    ON CONFLICT ("storeId")
    DO UPDATE SET ${updates.join(", ")}, "updatedAt" = CURRENT_TIMESTAMP
  `,
    ...params
  );
}

/**
 * The orders a card may be drawn from, newest first.
 *
 * Read as order *items* rather than orders, because the card names a product and
 * an order can carry four of them. The service dedupes to one card per order.
 *
 * Two of the three filters are the seller's:
 *
 * - **Status.** Whichever ones they ticked, defaulting to all five. A shop that
 *   ships on delivery has most of its real sales sitting in PENDING for days, so
 *   a widget that only counted COMPLETED would show almost nothing.
 * - **Product.** With `requirePublicProduct` the join is narrowed by
 *   `publicProductWhere` — the one definition of "a shopper may see this
 *   product" — so only items that can still be opened and bought are
 *   advertised. Without it every order qualifies and the *service* decides what
 *   the card may say: a product that is no longer public gets no link and keeps
 *   the order line's own snapshot of what was sold.
 *
 * The third is not theirs to change. Orders the seller marked fake are excluded
 * here, always: that flag is the shop's own record that the purchase never
 * happened, and there is no reading of "social proof" that survives quoting one.
 */
export async function listSalesNotificationCandidates(input: {
  limit: number;
  /** The statuses the seller chose. Never empty — the schema refuses that. */
  orderStatuses: SalesNotificationOrderStatus[];
  /** When true, only items whose product a shopper could open and buy today. */
  requirePublicProduct: boolean;
  since: Date;
  storeId: string;
}) {
  return prisma.orderItem.findMany({
    orderBy: {
      order: {
        createdAt: "desc"
      }
    },
    select: {
      imageUrl: true,
      order: {
        select: {
          createdAt: true,
          customerName: true,
          id: true,
          shippingCity: true,
          shippingDistrict: true
        }
      },
      product: {
        select: {
          images: {
            orderBy: {
              position: "asc"
            },
            select: {
              url: true
            },
            take: 1
          },
          slug: true,
          // Selected so the service can tell a linkable product from one that
          // has since been hidden, without a second query and without a second
          // definition of what "public" means.
          status: true,
          title: true,
          visibility: true
        }
      },
      title: true
    },
    // Room to dedupe: a four-line order is four rows here and one card.
    take: input.limit * 4,
    where: {
      order: {
        createdAt: {
          gte: input.since
        },
        markedFakeAt: null,
        status: {
          in: input.orderStatuses
        },
        storeId: input.storeId
      },
      ...(input.requirePublicProduct ? { product: publicProductWhere(input.storeId) } : {})
    }
  });
}

/** How many orders are eligible today, for the dashboard's "what will show" line. */
export async function countSalesNotificationCandidates(input: {
  orderStatuses: SalesNotificationOrderStatus[];
  requirePublicProduct: boolean;
  since: Date;
  storeId: string;
}) {
  return prisma.order.count({
    where: {
      createdAt: {
        gte: input.since
      },
      ...(input.requirePublicProduct
        ? {
            items: {
              some: {
                product: publicProductWhere(input.storeId)
              }
            }
          }
        : {}),
      markedFakeAt: null,
      status: {
        in: input.orderStatuses
      },
      storeId: input.storeId
    }
  });
}

export function ensureSalesNotificationSchema(db: SalesNotificationClient = prisma) {
  if (db !== prisma) {
    return createSalesNotificationSchema(db);
  }

  ensurePromise ??= createSalesNotificationSchema(db);

  return ensurePromise;
}

async function createSalesNotificationSchema(db: SalesNotificationClient) {
  const schema = getDatabaseSchemaName();

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${schema}"."StoreSalesNotificationSetting" (
      "id" TEXT PRIMARY KEY,
      "storeId" TEXT NOT NULL,
      "enabled" BOOLEAN NOT NULL DEFAULT false,
      "nameDisplay" TEXT NOT NULL DEFAULT 'initial',
      "orderStatuses" TEXT NOT NULL DEFAULT 'PENDING,CONFIRMED,PROCESSING,COMPLETED,CANCELLED',
      "requirePublicProduct" BOOLEAN NOT NULL DEFAULT false,
      "position" TEXT NOT NULL DEFAULT 'bottom-left',
      "showLocation" BOOLEAN NOT NULL DEFAULT true,
      "showOnMobile" BOOLEAN NOT NULL DEFAULT true,
      "showProductImage" BOOLEAN NOT NULL DEFAULT true,
      "showTimeAgo" BOOLEAN NOT NULL DEFAULT true,
      "initialDelaySeconds" INTEGER NOT NULL DEFAULT 8,
      "displaySeconds" INTEGER NOT NULL DEFAULT 6,
      "gapSeconds" INTEGER NOT NULL DEFAULT 18,
      "maxPerSession" INTEGER NOT NULL DEFAULT 8,
      "lookbackDays" INTEGER NOT NULL DEFAULT 14,
      "loopFeed" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "StoreSalesNotificationSetting_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "${schema}"."Store"("id") ON DELETE CASCADE
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "StoreSalesNotificationSetting_storeId_key" ON "${schema}"."StoreSalesNotificationSetting" ("storeId")`
  );
  // For databases that already have the table: `CREATE TABLE IF NOT EXISTS` is a
  // no-op on those, so a column added after the table shipped needs its own
  // idempotent statement — the same pattern `ai-provider.repository.ts` uses for
  // `shoppingAgentEnabled`. Both defaults match `SALES_NOTIFICATION_DEFAULTS`,
  // so a shop that saved settings before these existed keeps behaving the way
  // the dashboard says it does.
  await db.$executeRawUnsafe(
    `ALTER TABLE "${schema}"."StoreSalesNotificationSetting" ADD COLUMN IF NOT EXISTS "orderStatuses" TEXT NOT NULL DEFAULT 'PENDING,CONFIRMED,PROCESSING,COMPLETED,CANCELLED'`
  );
  await db.$executeRawUnsafe(
    `ALTER TABLE "${schema}"."StoreSalesNotificationSetting" ADD COLUMN IF NOT EXISTS "requirePublicProduct" BOOLEAN NOT NULL DEFAULT false`
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
