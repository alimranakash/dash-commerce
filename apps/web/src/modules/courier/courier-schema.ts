import { prisma, type Prisma } from "@dash/db";

type CourierSchemaClient = Prisma.TransactionClient | typeof prisma;

let ensurePromise: Promise<void> | null = null;

export function ensureCourierSchema(db: CourierSchemaClient = prisma) {
  if (db !== prisma) {
    return createCourierSchema(db);
  }

  ensurePromise ??= createCourierSchema(db);

  return ensurePromise;
}

async function createCourierSchema(db: CourierSchemaClient) {
  const schema = getDatabaseSchemaName();

  await db.$executeRawUnsafe(
    `ALTER TYPE "${schema}"."FulfillmentStatus" ADD VALUE IF NOT EXISTS 'SHIPPED'`
  );

  await db.$executeRawUnsafe(`
    DO $$
    BEGIN
      CREATE TYPE "${schema}"."ShipmentStatus" AS ENUM (
        'PENDING', 'REQUESTED', 'BOOKED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY',
        'DELIVERED', 'PARTIALLY_DELIVERED', 'RETURNED', 'CANCELLED', 'HOLD', 'LOST',
        'FAILED', 'UNKNOWN'
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${schema}"."CourierAccount" (
      "id" TEXT PRIMARY KEY,
      "storeId" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "label" TEXT,
      "isEnabled" BOOLEAN NOT NULL DEFAULT true,
      "isDefault" BOOLEAN NOT NULL DEFAULT false,
      "credentialsCipher" TEXT,
      "credentialsPublic" JSONB,
      "secretHint" TEXT,
      "metadata" JSONB,
      "lastTestedAt" TIMESTAMP(3),
      "lastTestStatus" TEXT,
      "lastTestMessage" TEXT,
      "balanceAmount" NUMERIC(12, 2),
      "balanceCheckedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CourierAccount_storeId_fkey" FOREIGN KEY ("storeId")
        REFERENCES "${schema}"."Store"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "CourierAccount_storeId_provider_key" ON "${schema}"."CourierAccount" ("storeId", "provider")`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "CourierAccount_storeId_idx" ON "${schema}"."CourierAccount" ("storeId")`
  );

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${schema}"."Shipment" (
      "id" TEXT PRIMARY KEY,
      "storeId" TEXT NOT NULL,
      "orderId" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "courierAccountId" TEXT,
      "status" "${schema}"."ShipmentStatus" NOT NULL DEFAULT 'PENDING',
      "providerStatus" TEXT,
      "providerShipmentId" TEXT,
      "trackingCode" TEXT,
      "invoiceReference" TEXT NOT NULL,
      "codAmount" NUMERIC(12, 2) NOT NULL DEFAULT 0,
      "labelUrl" TEXT,
      "requestHash" TEXT,
      "attemptCount" INTEGER NOT NULL DEFAULT 0,
      "lastError" TEXT,
      "lastSyncedAt" TIMESTAMP(3),
      "bookedAt" TIMESTAMP(3),
      "deliveredAt" TIMESTAMP(3),
      "cancelledAt" TIMESTAMP(3),
      "rawResponse" JSONB,
      "createdByUserId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Shipment_storeId_fkey" FOREIGN KEY ("storeId")
        REFERENCES "${schema}"."Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId")
        REFERENCES "${schema}"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "Shipment_courierAccountId_fkey" FOREIGN KEY ("courierAccountId")
        REFERENCES "${schema}"."CourierAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Shipment_storeId_orderId_provider_key" ON "${schema}"."Shipment" ("storeId", "orderId", "provider")`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Shipment_storeId_status_idx" ON "${schema}"."Shipment" ("storeId", "status")`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Shipment_orderId_idx" ON "${schema}"."Shipment" ("orderId")`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Shipment_trackingCode_idx" ON "${schema}"."Shipment" ("trackingCode")`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Shipment_courierAccountId_idx" ON "${schema}"."Shipment" ("courierAccountId")`
  );
  // The carrier requires `invoice` to be unique per merchant account, and both the
  // webhook receiver and the timed-out-booking reconciliation look a shipment up by
  // invoice or consignment id rather than by order.
  await db.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Shipment_storeId_provider_invoiceReference_key" ON "${schema}"."Shipment" ("storeId", "provider", "invoiceReference")`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Shipment_storeId_invoiceReference_idx" ON "${schema}"."Shipment" ("storeId", "invoiceReference")`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Shipment_provider_providerShipmentId_idx" ON "${schema}"."Shipment" ("provider", "providerShipmentId")`
  );

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${schema}"."DeliveryEvent" (
      "id" TEXT PRIMARY KEY,
      "storeId" TEXT NOT NULL,
      "shipmentId" TEXT NOT NULL,
      "status" "${schema}"."ShipmentStatus" NOT NULL,
      "providerStatus" TEXT,
      "message" TEXT,
      "source" TEXT NOT NULL DEFAULT 'SYSTEM',
      "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "payload" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "DeliveryEvent_storeId_fkey" FOREIGN KEY ("storeId")
        REFERENCES "${schema}"."Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "DeliveryEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId")
        REFERENCES "${schema}"."Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "DeliveryEvent_shipmentId_occurredAt_idx" ON "${schema}"."DeliveryEvent" ("shipmentId", "occurredAt")`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "DeliveryEvent_storeId_idx" ON "${schema}"."DeliveryEvent" ("storeId")`
  );

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${schema}"."CourierCustomerScore" (
      "id" TEXT PRIMARY KEY,
      "storeId" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "phone" TEXT NOT NULL,
      "totalParcels" INTEGER NOT NULL DEFAULT 0,
      "totalDelivered" INTEGER NOT NULL DEFAULT 0,
      "totalCancelled" INTEGER NOT NULL DEFAULT 0,
      "successRatio" NUMERIC(5, 2),
      "raw" JSONB,
      "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CourierCustomerScore_storeId_fkey" FOREIGN KEY ("storeId")
        REFERENCES "${schema}"."Store"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "CourierCustomerScore_storeId_provider_phone_key" ON "${schema}"."CourierCustomerScore" ("storeId", "provider", "phone")`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "CourierCustomerScore_storeId_idx" ON "${schema}"."CourierCustomerScore" ("storeId")`
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
