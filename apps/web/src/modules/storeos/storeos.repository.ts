import { prisma, type Prisma } from "@dash/db";
import type { StoreOSCapabilities, StoreOSConnectionStatus } from "@dash/storeos-sdk";

type UpsertStoreOSConnectionInput = {
  capabilities?: StoreOSCapabilities;
  lastSyncedAt?: Date | null;
  status: StoreOSConnectionStatus;
  storeId: string;
  storeosConnectionId?: string | null;
};

export async function getStoreOSConnectionForStore(storeId: string) {
  return prisma.storeOSConnection.findUnique({
    where: {
      storeId
    }
  });
}

export async function upsertStoreOSConnectionForStore(input: UpsertStoreOSConnectionInput) {
  const data = {
    capabilities: toPrismaJson(input.capabilities ?? {}),
    lastSyncedAt: input.lastSyncedAt ?? null,
    platformType: "dash",
    status: input.status,
    storeosConnectionId: input.storeosConnectionId ?? null
  };

  return prisma.storeOSConnection.upsert({
    where: {
      storeId: input.storeId
    },
    create: {
      storeId: input.storeId,
      ...data
    },
    update: data
  });
}

export async function markStoreOSConnectionError(storeId: string) {
  return upsertStoreOSConnectionForStore({
    capabilities: {},
    status: "error",
    storeId,
    storeosConnectionId: null
  });
}

export async function ensurePendingStoreOSConnection(storeId: string) {
  return prisma.storeOSConnection.upsert({
    where: {
      storeId
    },
    create: {
      capabilities: {},
      platformType: "dash",
      status: "pending",
      storeId,
      storeosConnectionId: null
    },
    update: {}
  });
}

function toPrismaJson(value: StoreOSCapabilities) {
  return value as Prisma.InputJsonValue;
}
