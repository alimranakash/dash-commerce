"use server";

import { revalidatePath } from "next/cache";
import { requireStore } from "../../stores/queries";
import { storefrontTemplateRegistry } from "./registry";
import { updateStoreActiveTemplate } from "./template-store";

export type ApplyStorefrontTemplateResult =
  | { ok: true; templateId: string }
  | { error: string; ok: false };

export async function applyStorefrontTemplateAction(
  templateId: string
): Promise<ApplyStorefrontTemplateResult> {
  const store = await requireStore();

  const templateExists = Object.values(storefrontTemplateRegistry).some((template) => template.id === templateId);

  if (!templateExists) {
    return {
      error: "Selected template is not available.",
      ok: false
    };
  }

  await updateStoreActiveTemplate(store.id, templateId);

  revalidateTemplatePaths(store.slug);

  return {
    ok: true,
    templateId
  };
}

function revalidateTemplatePaths(storeSlug: string) {
  revalidatePath("/dashboard/theme");
  revalidatePath(`/s/${storeSlug}`);
  revalidatePath(`/s/${storeSlug}/categories`);
  revalidatePath(`/s/${storeSlug}/products`);
  revalidatePath(`/s/${storeSlug}/search`);
}
