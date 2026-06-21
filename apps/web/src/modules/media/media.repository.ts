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
