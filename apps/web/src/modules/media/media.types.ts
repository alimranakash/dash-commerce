import type { MediaUsageType } from "./media.schema";

export type MediaAssetListItem = {
  alt: string | null;
  createdAt: Date;
  filename: string;
  height: number | null;
  id: string;
  mimeType: string;
  size: number;
  url: string;
  usageType: string | null;
  width: number | null;
};

export type MediaPickerAsset = {
  alt: string | null;
  filename: string;
  id: string;
  url: string;
  usageType: string | null;
};

export type StoredMediaFile = {
  key: string;
  url: string;
};

export type UploadMediaFileInput = {
  alt?: string;
  file: File;
  storeId: string;
  usageType: MediaUsageType;
};
