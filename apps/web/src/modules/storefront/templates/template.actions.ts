"use server";

import { revalidatePath } from "next/cache";
import { StoreAccessError, requireStoreManager } from "../../stores/queries";
import { storefrontTemplateRegistry } from "./registry";
import { updateStoreActiveTemplate } from "./template-store";

export type ApplyStorefrontTemplateResult =
  | { ok: true; templateId: string }
  | { error: string; ok: false };

/**
 * Switching the template changes the storefront every customer sees, so it is
 * manager-only. This action reports failure as a value rather than throwing, so
 * the refusal is converted into one instead of escaping as an unhandled error.
 */
export async function applyStorefrontTemplateAction(
  templateId: string
): Promise<ApplyStorefrontTemplateResult> {
  let store: Awaited<ReturnType<typeof requireStoreManager>>["store"];

  try {
    ({ store } = await requireStoreManager());
  } catch (error) {
    return {
      error:
        error instanceof StoreAccessError
          ? error.message
          : "Could not apply that template. Try again.",
      ok: false
    };
  }

  const templateExists = Object.values(storefrontTemplateRegistry).some(
    (template) => template.id === templateId
  );

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
  revalidatePath("/dashboard/storefront/themes");
  // The internal route on purpose: /s/<slug> is what Next serves, and a
  // storefront hostname is a rewrite onto it. Revalidating the clean
  // address would quietly revalidate nothing.
  revalidatePath(`/s/${storeSlug}`);
  revalidatePath(`/s/${storeSlug}/categories`);
  revalidatePath(`/s/${storeSlug}/products`);
  revalidatePath(`/s/${storeSlug}/search`);
}
