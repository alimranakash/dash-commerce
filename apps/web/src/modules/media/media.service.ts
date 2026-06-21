import {
  createMediaAssetRecord,
  deleteMediaAssetForStoreRecord,
  getMediaAssetForStoreRecord,
  getMediaAssetsForStoreRecord
} from "./media.repository";
import type { MediaUsageType } from "./media.schema";
import { deleteStoredMediaFile, saveMediaFile } from "./storage";
import type { UploadMediaFileInput } from "./media.types";

const maxUploadSize = 5 * 1024 * 1024;
const rasterMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const svgMimeType = "image/svg+xml";

export async function getMediaAssetsForStore(storeId: string) {
  return getMediaAssetsForStoreRecord(storeId);
}

export async function getMediaPickerAssets(storeId: string) {
  const assets = await getMediaAssetsForStoreRecord(storeId);

  return assets.map((asset) => ({
    alt: asset.alt,
    filename: asset.filename,
    id: asset.id,
    url: asset.url,
    usageType: asset.usageType
  }));
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

  if (file.size > maxUploadSize) {
    throw new Error("Image must be 5MB or smaller.");
  }

  if (rasterMimeTypes.has(file.type)) {
    return;
  }

  if (file.type === svgMimeType && (usageType === "LOGO" || usageType === "FAVICON")) {
    await validateSvg(file);
    return;
  }

  throw new Error("Use JPG, PNG, or WebP images. SVG is only allowed for logo or favicon uploads.");
}

async function validateSvg(file: File) {
  const text = await file.text();
  const unsafePattern = /<script|on\w+\s*=|javascript:|data:|<foreignObject/i;

  if (unsafePattern.test(text)) {
    throw new Error("SVG contains unsafe markup.");
  }
}
