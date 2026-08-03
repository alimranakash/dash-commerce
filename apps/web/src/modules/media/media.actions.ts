"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStore } from "../stores/queries";
import { deleteMediaAsset, uploadMediaAsset } from "./media.service";
import { uploadMediaSchema } from "./media.schema";

export type MediaUploadActionState = {
  message?: string;
  status: "idle" | "error";
};

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
