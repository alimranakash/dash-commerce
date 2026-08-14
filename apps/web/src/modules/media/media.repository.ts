import { prisma } from "@dash/db";

type CreateMediaAssetInput = {
  alt?: string;
  filename: string;
  key: string;
  mimeType: string;
  size: number;
  storeId: string;
  usageType?: string;
  url: string;
};

export async function createMediaAssetRecord(input: CreateMediaAssetInput) {
  return prisma.mediaAsset.create({
    data: {
      alt: input.alt ?? null,
      filename: input.filename,
      key: input.key,
      mimeType: input.mimeType,
      size: input.size,
      storeId: input.storeId,
      usageType: input.usageType ?? null,
      url: input.url
    }
  });
}

type ListMediaAssetsRecordInput = {
  cursor?: string;
  mimeTypes?: string[];
  search?: string;
  storeId: string;
  take: number;
  usageType?: string;
};

export async function listMediaAssetsRecord(input: ListMediaAssetsRecordInput) {
  return prisma.mediaAsset.findMany({
    where: {
      storeId: input.storeId,
      ...(input.mimeTypes ? { mimeType: { in: input.mimeTypes } } : {}),
      ...(input.usageType ? { usageType: input.usageType } : {}),
      ...(input.search
        ? {
            OR: [
              { filename: { contains: input.search, mode: "insensitive" as const } },
              { alt: { contains: input.search, mode: "insensitive" as const } }
            ]
          }
        : {})
    },
    // `id` has to take part in the ordering for the cursor to be stable when
    // several assets share a createdAt timestamp.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: input.take,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {})
  });
}

export async function getMediaAssetsForStoreRecord(storeId: string) {
  return prisma.mediaAsset.findMany({
    where: {
      storeId
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

export async function getMediaAssetForStoreRecord(storeId: string, assetId: string) {
  return prisma.mediaAsset.findFirst({
    where: {
      id: assetId,
      storeId
    }
  });
}

export async function deleteMediaAssetForStoreRecord(storeId: string, assetId: string) {
  return prisma.mediaAsset.deleteMany({
    where: {
      id: assetId,
      storeId
    }
  });
}
