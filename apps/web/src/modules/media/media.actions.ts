"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStore } from "../stores/queries";
import { deleteMediaAsset, listMediaAssets, uploadMediaAsset } from "./media.service";
import { uploadMediaSchema, type ListMediaAssetsInput } from "./media.schema";
import type { MediaPickerAsset, MediaPickerPage } from "./media.types";

export type MediaUploadResult =
  | { asset: MediaPickerAsset; status: "success" }
  | { message: string; status: "error" };

/** Read side of the media picker: store-scoped, paged, and mime-filtered. */
export async function listMediaAssetsAction(input: ListMediaAssetsInput): Promise<MediaPickerPage> {
  const store = await requireStore();

  return listMediaAssets(store.id, input);
}

/**
 * The single upload entry point, shared by the picker modal and the library
 * page: it returns the created asset instead of redirecting, so the caller can
 * drop it into a grid without leaving the page.
 */
export async function uploadMediaAction(formData: FormData): Promise<MediaUploadResult> {
  const store = await requireStore();

  try {
    const data = uploadMediaSchema.parse({
      alt: getValue(formData, "alt"),
      usageType: getValue(formData, "usageType") || "GENERAL"
    });
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new Error("Choose an image to upload.");
    }

    const asset = await uploadMediaAsset({
      ...(data.alt ? { alt: data.alt } : {}),
      file,
      storeId: store.id,
      usageType: data.usageType
    });

    return {
      asset: {
        alt: asset.alt,
        filename: asset.filename,
        id: asset.id,
        mimeType: asset.mimeType,
        url: asset.url,
        usageType: asset.usageType
      },
      status: "success"
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Upload failed.",
      status: "error"
    };
  }
}

export async function deleteMediaFormAction(assetId: string) {
  const store = await requireStore();

  await deleteMediaAsset(store.id, assetId);
  revalidatePath("/dashboard/media");
  redirect("/dashboard/media?deleted=1");
}

function getValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}
