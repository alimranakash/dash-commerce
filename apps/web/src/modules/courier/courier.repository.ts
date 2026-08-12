import { prisma, type Prisma } from "@dash/db";
import { ensureCourierSchema } from "./courier-schema";
import type { DeliveryEventSource, ShipmentStatus } from "./courier.types";

/**
 * Every function here is scoped by storeId — a store can only ever read or write
 * its own courier accounts, shipments, delivery events and cached scores.
 */

export type CourierAccountWriteInput = {
  credentialsCipher?: string | null;
  credentialsPublic?: Prisma.InputJsonValue;
  isDefault?: boolean;
  isEnabled?: boolean;
  label?: string | null;
  metadata?: Prisma.InputJsonValue;
  provider: string;
  secretHint?: string | null;
  storeId: string;
};

export type ShipmentCreateInput = {
  codAmount: number | string;
  courierAccountId?: string | null;
  createdByUserId?: string | null;
  invoiceReference: string;
  orderId: string;
  provider: string;
  requestHash?: string | null;
  status?: ShipmentStatus;
  storeId: string;
};

export type ShipmentWriteInput = {
  attemptCount?: number;
  bookedAt?: Date | null;
  cancelledAt?: Date | null;
  courierAccountId?: string | null;
  deliveredAt?: Date | null;
  labelUrl?: string | null;
  lastError?: string | null;
  lastSyncedAt?: Date | null;
  providerShipmentId?: string | null;
  providerStatus?: string | null;
  rawResponse?: Prisma.InputJsonValue;
  requestHash?: string | null;
  status?: ShipmentStatus;
  trackingCode?: string | null;
};

export type DeliveryEventCreateInput = {
  message?: string | null;
  occurredAt?: Date;
  payload?: Prisma.InputJsonValue;
  providerStatus?: string | null;
  shipmentId: string;
  source: DeliveryEventSource;
  status: ShipmentStatus;
  storeId: string;
};

export type CourierCustomerScoreWriteInput = {
  phone: string;
  provider: string;
  raw?: Prisma.InputJsonValue;
  storeId: string;
  successRatio?: number | null;
  totalCancelled?: number;
  totalDelivered: number;
  totalParcels: number;
};

/* -------------------------------------------------------------------------- */
/* Courier accounts                                                           */
/* -------------------------------------------------------------------------- */

export async function getCourierAccountsForStore(storeId: string) {
  await ensureCourierSchema();

  return prisma.courierAccount.findMany({
    where: {
      storeId
    },
    orderBy: [{ isDefault: "desc" }, { provider: "asc" }]
  });
}

export async function getCourierAccountForStore(storeId: string, provider: string) {
  await ensureCourierSchema();

  return prisma.courierAccount.findFirst({
    where: {
      provider,
      storeId
    }
  });
}

export async function getDefaultCourierAccountForStore(storeId: string) {
  await ensureCourierSchema();

  return prisma.courierAccount.findFirst({
    where: {
      isDefault: true,
      isEnabled: true,
      storeId
    }
  });
}

export async function upsertCourierAccountForStore(input: CourierAccountWriteInput) {
  await ensureCourierSchema();

  const data = courierAccountData(input);

  return prisma.courierAccount.upsert({
    where: {
      storeId_provider: {
        provider: input.provider,
        storeId: input.storeId
      }
    },
    update: data,
    create: {
      provider: input.provider,
      storeId: input.storeId,
      ...data
    }
  });
}

/** Makes one provider the store default and clears the flag on every other one. */
export async function setDefaultCourierAccountForStore(storeId: string, provider: string) {
  await ensureCourierSchema();

  return prisma.$transaction([
    prisma.courierAccount.updateMany({
      where: {
        provider: {
          not: provider
        },
        storeId
      },
      data: {
        isDefault: false
      }
    }),
    prisma.courierAccount.updateMany({
      where: {
        provider,
        storeId
      },
      data: {
        isDefault: true
      }
    })
  ]);
}

export async function updateCourierAccountTestResultForStore(
  storeId: string,
  provider: string,
  input: { lastTestMessage: string; lastTestStatus: string }
) {
  await ensureCourierSchema();

  return prisma.courierAccount.updateMany({
    where: {
      provider,
      storeId
    },
    data: {
      lastTestMessage: input.lastTestMessage,
      lastTestStatus: input.lastTestStatus,
      lastTestedAt: new Date()
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Shipments                                                                  */
/* -------------------------------------------------------------------------- */

export async function getShipmentsForStore(storeId: string) {
  await ensureCourierSchema();

  return prisma.shipment.findMany({
    where: {
      storeId
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

export async function getShipmentsForOrder(storeId: string, orderId: string) {
  await ensureCourierSchema();

  return prisma.shipment.findMany({
    where: {
      orderId,
      storeId
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

export async function getShipmentsForOrders(storeId: string, orderIds: string[]) {
  await ensureCourierSchema();

  if (orderIds.length === 0) {
    return [];
  }

  return prisma.shipment.findMany({
    where: {
      orderId: {
        in: orderIds
      },
      storeId
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

export async function getShipmentByIdForStore(storeId: string, shipmentId: string) {
  await ensureCourierSchema();

  return prisma.shipment.findFirst({
    where: {
      id: shipmentId,
      storeId
    }
  });
}

/** The idempotency lookup: at most one shipment exists per order and provider. */
export async function getShipmentForOrderProvider(storeId: string, orderId: string, provider: string) {
  await ensureCourierSchema();

  return prisma.shipment.findFirst({
    where: {
      orderId,
      provider,
      storeId
    }
  });
}

export async function createShipmentForStore(input: ShipmentCreateInput) {
  await ensureCourierSchema();

  return prisma.shipment.create({
    data: {
      codAmount: input.codAmount,
      invoiceReference: input.invoiceReference,
      orderId: input.orderId,
      provider: input.provider,
      storeId: input.storeId,
      ...(input.courierAccountId !== undefined ? { courierAccountId: input.courierAccountId } : {}),
      ...(input.createdByUserId !== undefined ? { createdByUserId: input.createdByUserId } : {}),
      ...(input.requestHash !== undefined ? { requestHash: input.requestHash } : {}),
      ...(input.status !== undefined ? { status: input.status } : {})
    }
  });
}

export async function updateShipmentForStore(
  storeId: string,
  shipmentId: string,
  input: ShipmentWriteInput
) {
  await ensureCourierSchema();

  return prisma.shipment.updateMany({
    where: {
      id: shipmentId,
      storeId
    },
    data: shipmentData(input)
  });
}

/* -------------------------------------------------------------------------- */
/* Delivery events                                                            */
/* -------------------------------------------------------------------------- */

export async function createDeliveryEventForStore(input: DeliveryEventCreateInput) {
  await ensureCourierSchema();

  return prisma.deliveryEvent.create({
    data: {
      shipmentId: input.shipmentId,
      source: input.source,
      status: input.status,
      storeId: input.storeId,
      ...(input.message !== undefined ? { message: input.message } : {}),
      ...(input.occurredAt !== undefined ? { occurredAt: input.occurredAt } : {}),
      ...(input.payload !== undefined ? { payload: input.payload } : {}),
      ...(input.providerStatus !== undefined ? { providerStatus: input.providerStatus } : {})
    }
  });
}

export async function getDeliveryEventsForShipment(storeId: string, shipmentId: string) {
  await ensureCourierSchema();

  return prisma.deliveryEvent.findMany({
    where: {
      shipmentId,
      storeId
    },
    orderBy: {
      occurredAt: "desc"
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Cached courier customer scores                                             */
/* -------------------------------------------------------------------------- */

export async function getCourierCustomerScoreForStore(
  storeId: string,
  provider: string,
  phone: string
) {
  await ensureCourierSchema();

  return prisma.courierCustomerScore.findFirst({
    where: {
      phone,
      provider,
      storeId
    }
  });
}

export async function upsertCourierCustomerScoreForStore(input: CourierCustomerScoreWriteInput) {
  await ensureCourierSchema();

  const data = {
    checkedAt: new Date(),
    successRatio: input.successRatio ?? null,
    totalDelivered: input.totalDelivered,
    totalParcels: input.totalParcels,
    ...(input.raw !== undefined ? { raw: input.raw } : {}),
    ...(input.totalCancelled !== undefined ? { totalCancelled: input.totalCancelled } : {})
  };

  return prisma.courierCustomerScore.upsert({
    where: {
      storeId_provider_phone: {
        phone: input.phone,
        provider: input.provider,
        storeId: input.storeId
      }
    },
    update: data,
    create: {
      phone: input.phone,
      provider: input.provider,
      storeId: input.storeId,
      ...data
    }
  });
}

/* -------------------------------------------------------------------------- */

function courierAccountData(input: CourierAccountWriteInput) {
  return {
    ...(input.credentialsCipher !== undefined ? { credentialsCipher: input.credentialsCipher } : {}),
    ...(input.credentialsPublic !== undefined ? { credentialsPublic: input.credentialsPublic } : {}),
    ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
    ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
    ...(input.label !== undefined ? { label: input.label } : {}),
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    ...(input.secretHint !== undefined ? { secretHint: input.secretHint } : {})
  };
}

function shipmentData(input: ShipmentWriteInput) {
  return {
    ...(input.attemptCount !== undefined ? { attemptCount: input.attemptCount } : {}),
    ...(input.bookedAt !== undefined ? { bookedAt: input.bookedAt } : {}),
    ...(input.cancelledAt !== undefined ? { cancelledAt: input.cancelledAt } : {}),
    ...(input.courierAccountId !== undefined ? { courierAccountId: input.courierAccountId } : {}),
    ...(input.deliveredAt !== undefined ? { deliveredAt: input.deliveredAt } : {}),
    ...(input.labelUrl !== undefined ? { labelUrl: input.labelUrl } : {}),
    ...(input.lastError !== undefined ? { lastError: input.lastError } : {}),
    ...(input.lastSyncedAt !== undefined ? { lastSyncedAt: input.lastSyncedAt } : {}),
    ...(input.providerShipmentId !== undefined ? { providerShipmentId: input.providerShipmentId } : {}),
    ...(input.providerStatus !== undefined ? { providerStatus: input.providerStatus } : {}),
    ...(input.rawResponse !== undefined ? { rawResponse: input.rawResponse } : {}),
    ...(input.requestHash !== undefined ? { requestHash: input.requestHash } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.trackingCode !== undefined ? { trackingCode: input.trackingCode } : {})
  };
}
