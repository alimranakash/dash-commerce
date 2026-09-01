"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireStore } from "../stores/queries";
import {
  applyProductContent,
  generateProductContent,
  ProductContentAiLockedError,
  ProductContentNotFoundError,
  type ProductContentView
} from "./product-content.service";
import type {
  ApplyProductContentInput,
  GenerateProductContentInput,
  ProductContentDraft
} from "./product-content.schema";

export type GenerateProductContentResult =
  | {
      draft: ProductContentDraft;
      ok: true;
    }
  | {
      error: string;
      /** True when the plan is the reason, so the editor can link to Billing. */
      locked: boolean;
      ok: false;
    };

export type ApplyProductContentResult =
  | {
      content: ProductContentView;
      ok: true;
    }
  | {
      error: string;
      ok: false;
    };

/**
 * Write a draft for one product, for whichever fields the seller ticked.
 *
 * `requireStore()` rather than `requireStoreManager()`: writing product copy is
 * ordinary catalogue work, the same authority the product editor itself needs,
 * and the same guard `product.actions.ts` uses. The store comes from the
 * session, so `productId` is the only thing the browser supplies and it is
 * matched against that store before anything is read — a product id from
 * another tenant resolves to nothing.
 *
 * Nothing is persisted, so nothing is revalidated. The draft goes back to the
 * editor for the seller to read and change before any of it becomes content.
 */
export async function generateProductContentAction(
  input: GenerateProductContentInput
): Promise<GenerateProductContentResult> {
  const store = await requireStore();

  try {
    return {
      draft: await generateProductContent(store.id, input),
      ok: true
    };
  } catch (error) {
    return {
      error: errorMessage(error),
      locked: error instanceof ProductContentAiLockedError,
      ok: false
    };
  }
}

/**
 * Save the fields the seller approved.
 *
 * Deliberately not plan-gated. Generating copy is the paid capability; keeping
 * a product's own title, description and SEO fields is not, and a store whose
 * plan lapses must still be able to edit what it already has.
 */
export async function applyProductContentAction(
  input: ApplyProductContentInput
): Promise<ApplyProductContentResult> {
  const store = await requireStore();

  try {
    const content = await applyProductContent(store.id, input);

    revalidatePath("/dashboard/products");
    revalidatePath(`/dashboard/products/${content.productId}/content`);
    revalidatePath(`/dashboard/products/${content.productId}/edit`);

    return {
      content,
      ok: true
    };
  } catch (error) {
    return {
      error: errorMessage(error),
      ok: false
    };
  }
}

function errorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Please check the content you are saving.";
  }

  if (
    error instanceof ProductContentNotFoundError ||
    error instanceof ProductContentAiLockedError
  ) {
    return error.message;
  }

  return error instanceof Error ? error.message : "Product content request failed.";
}
