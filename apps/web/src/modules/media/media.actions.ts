"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStore } from "../stores/queries";
import { deleteMediaAsset, listMediaAssets, uploadMediaAsset } from "./media.service";
import { uploadMediaSchema, type ListMediaAssetsInput } from "./media.schema";
import type { MediaPickerAsset, MediaPickerPage } from "./media.types";

export type MediaUploadActionState = {
  message?: string;
  status: "idle" | "error";
};

export type MediaUploadResult =
  | { asset: MediaPickerAsset; status: "success" }
  | { message: string; status: "error" };

/** Read side of the media picker: store-scoped, paged, and mime-filtered. */
export async function listMediaAssetsAction(input: ListMediaAssetsInput): Promise<MediaPickerPage> {
  const store = await requireStore();

  return listMediaAssets(store.id, input);
}

/**
 * Upload straight from the picker modal. Unlike `uploadMediaFormAction` this
 * returns the created asset instead of redirecting, so the modal can drop it
 * into the grid and select it without leaving the page.
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

export async function uploadMediaFormAction(
  state: MediaUploadActionState,
  formData: FormData
): Promise<MediaUploadActionState> {
  void state;

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

    await uploadMediaAsset({
      ...(data.alt ? { alt: data.alt } : {}),
      file,
      storeId: store.id,
      usageType: data.usageType
    });
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Upload failed.",
      status: "error"
    };
  }

  revalidateMediaPaths();
  redirect("/dashboard/media?uploaded=1");
}

export async function deleteMediaFormAction(assetId: string) {
  const store = await requireStore();

  await deleteMediaAsset(store.id, assetId);
  revalidateMediaPaths();
  redirect("/dashboard/media?deleted=1");
}

function revalidateMediaPaths() {
  revalidatePath("/dashboard/media");
  revalidatePath("/dashboard/products/new");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/theme");
  revalidatePath("/dashboard/storefront/themes");
}

function getValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}
