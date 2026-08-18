import {
  createMediaAssetRecord,
  deleteMediaAssetForStoreRecord,
  getMediaAssetForStoreRecord,
  getMediaAssetsForStoreRecord,
  listMediaAssetsRecord
} from "./media.repository";
import { optimizeMediaUpload } from "./media-optimizer";
import {
  allowedMimeTypesForUsage,
  listMediaAssetsSchema,
  mediaMimeRuleMessage,
  mediaSizeErrorForUsage,
  mediaSvgMimeType,
  type ListMediaAssetsInput,
  type MediaUsageType
} from "./media.schema";
import { deleteStoredMediaFile, saveMediaFile } from "./storage";
import type { MediaPickerAsset, MediaPickerPage, UploadMediaFileInput } from "./media.types";

export async function getMediaAssetsForStore(storeId: string) {
  return getMediaAssetsForStoreRecord(storeId);
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
  height: number | null;
  id: string;
  mimeType: string;
  size: number;
  url: string;
  usageType: string | null;
  width: number | null;
}): MediaPickerAsset {
  return {
    alt: asset.alt,
    filename: asset.filename,
    height: asset.height,
    id: asset.id,
    mimeType: asset.mimeType,
    size: asset.size,
    url: asset.url,
    usageType: asset.usageType,
    width: asset.width
  };
}

export async function uploadMediaAsset(input: UploadMediaFileInput) {
  await validateUpload(input.file, input.usageType);

  const optimized = await optimizeUpload(input.file, input.usageType);
  const stored = await saveMediaFile({
    buffer: optimized.buffer,
    filename: optimized.filename,
    mimeType: optimized.mimeType,
    storeId: input.storeId
  });

  return createMediaAssetRecord({
    ...(input.alt ? { alt: input.alt } : {}),
    ...(optimized.height === null ? {} : { height: optimized.height }),
    ...(optimized.width === null ? {} : { width: optimized.width }),
    filename: optimized.filename,
    key: stored.key,
    mimeType: optimized.mimeType,
    size: optimized.size,
    storeId: input.storeId,
    usageType: input.usageType,
    url: stored.url
  });
}

/**
 * A decode failure here means the bytes are not the image the mime type claims,
 * so it is reported as a rejected upload rather than falling back to storing
 * whatever was sent.
 */
async function optimizeUpload(file: File, usageType: MediaUsageType) {
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    return await optimizeMediaUpload({
      buffer,
      filename: file.name,
      mimeType: file.type,
      usageType
    });
  } catch {
    throw new Error("That file could not be read as an image. Try a JPG, PNG, or WebP export.");
  }
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

  const sizeError = mediaSizeErrorForUsage(file.size, usageType);

  if (sizeError) {
    throw new Error(sizeError);
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
