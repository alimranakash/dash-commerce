"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { errorForLog } from "../notifications/notifications.redact";
import { requireStore } from "../stores/queries";
import { assignMissingBarcodes } from "./barcode.service";

export type AssignBarcodesResult =
  | {
      assigned: number;
      productBarcodes: Record<string, string>;
      status: "ok";
      variantBarcodes: Record<string, string>;
    }
  | { message: string; status: "error" };

/**
 * Called by the label page just before it prints, so every label leaves the
 * printer carrying a code the sale form can already find. Ordinary catalogue
 * work, open to any team member as editing a product is.
 *
 * Deliberately does not revalidate the label page itself: a refresh would
 * re-read the catalogue under a seller mid-selection, and the page lays the
 * returned codes over its own list instead.
 */
export async function assignMissingBarcodesAction(request: {
  productIds: string[];
  variantIds: string[];
}): Promise<AssignBarcodesResult> {
  const store = await requireStore();

  try {
    const result = await assignMissingBarcodes(store.id, {
      productIds: idList(request?.productIds),
      variantIds: idList(request?.variantIds)
    });

    if (result.assigned > 0) {
      revalidatePath("/dashboard/products");
    }

    return { ...result, status: "ok" };
  } catch (error) {
    if (error instanceof ZodError) {
      return { message: error.issues[0]?.message ?? "Choose the products to print.", status: "error" };
    }

    console.error(`[barcodes] assigning barcodes failed: ${errorForLog(error)}`);

    return {
      message: "Barcodes could not be assigned, so nothing was printed. Try again.",
      status: "error"
    };
  }
}

function idList(value: unknown) {
  return Array.isArray(value) ? value.map((id) => String(id)) : [];
}
