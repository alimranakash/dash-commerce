import {
  createMediaAssetRecord,
  deleteMediaAssetForStoreRecord,
  getMediaAssetForStoreRecord,
  getMediaAssetsForStoreRecord,
  listMediaAssetsRecord
} from "./media.repository";
import {
  allowedMimeTypesForUsage,
  listMediaAssetsSchema,
  maxMediaUploadSize,
  mediaMimeRuleMessage,
  mediaSvgMimeType,
  type ListMediaAssetsInput,
  type MediaUsageType
} from "./media.schema";
import { deleteStoredMediaFile, saveMediaFile } from "./storage";
import type { MediaPickerAsset, MediaPickerPage, UploadMediaFileInput } from "./media.types";

export async function getMediaAssetsForStore(storeId: string) {
  return getMediaAssetsForStoreRecord(storeId);
}

export async function getMediaPickerAssets(storeId: string) {
  const assets = await getMediaAssetsForStoreRecord(storeId);

  return assets.map(toPickerAsset);
}

export async function listMediaAssets(
  storeId: string,
  input: ListMediaAssetsInput
): Promise<MediaPickerPage> {
  const query = listMediaAssetsSchema.parse(input);
  const rows = await listMediaAssetsRecord({
    mimeTypes: allowedMimeTypesForUsage(query.context),
    storeId,
    // One extra row tells us whether another page exists without a count query.
    take: query.take + 1,
    ...(query.cursor ? { cursor: query.cursor } : {}),
    ...(query.search ? { search: query.search } : {}),
    ...(query.usageType ? { usageType: query.usageType } : {})
  });
  const hasMore = rows.length > query.take;
  const assets = (hasMore ? rows.slice(0, query.take) : rows).map(toPickerAsset);

  return {
    assets,
    nextCursor: hasMore ? (assets[assets.length - 1]?.id ?? null) : null
  };
}

function toPickerAsset(asset: {
  alt: string | null;
  filename: string;
  id: string;
  mimeType: string;
  url: string;
  usageType: string | null;
}): MediaPickerAsset {
  return {
    alt: asset.alt,
    filename: asset.filename,
    id: asset.id,
    mimeType: asset.mimeType,
    url: asset.url,
    usageType: asset.usageType
  };
}

export async function uploadMediaAsset(input: UploadMediaFileInput) {
  await validateUpload(input.file, input.usageType);

  const buffer = Buffer.from(await input.file.arrayBuffer());
  const stored = await saveMediaFile({
    buffer,
    filename: input.file.name,
    mimeType: input.file.type,
    storeId: input.storeId
  });

  return createMediaAssetRecord({
    ...(input.alt ? { alt: input.alt } : {}),
    filename: input.file.name,
    key: stored.key,
    mimeType: input.file.type,
    size: input.file.size,
    storeId: input.storeId,
    usageType: input.usageType,
    url: stored.url
  });
}

export async function deleteMediaAsset(storeId: string, assetId: string) {
  const asset = await getMediaAssetForStoreRecord(storeId, assetId);

  if (!asset) {
    throw new Error("Media asset not found.");
  }

  await deleteStoredMediaFile(asset.key);
  await deleteMediaAssetForStoreRecord(storeId, assetId);
}

async function validateUpload(file: File, usageType: MediaUsageType) {
  if (!file || file.size === 0) {
    throw new Error("Choose an image to upload.");
  }

  if (file.size > maxMediaUploadSize) {
    throw new Error("Image must be 5MB or smaller.");
  }

  if (!allowedMimeTypesForUsage(usageType).includes(file.type)) {
    throw new Error(mediaMimeRuleMessage);
  }

  if (file.type === mediaSvgMimeType) {
    await validateSvg(file);
  }
}

async function validateSvg(file: File) {
  const text = await file.text();
  const unsafePattern = /<script|on\w+\s*=|javascript:|data:|<foreignObject/i;

  if (unsafePattern.test(text)) {
    throw new Error("SVG contains unsafe markup.");
  }
}
