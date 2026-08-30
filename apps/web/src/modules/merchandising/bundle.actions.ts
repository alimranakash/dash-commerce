"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requirePlanFeature } from "../billing/subscription-limits";
import { requireStore } from "../stores/queries";
import { deleteBundle, saveBundle, setBundleStatus } from "./bundle.service";
import type { BundleDiscountType, BundleStatus, BundleType } from "./bundle.schema";

export type BundleActionState = {
  fieldErrors?: Record<string, string>;
  message?: string;
  status: "error" | "idle";
};

/**
 * Bundles are a Starter feature. Authoring one is gated; deleting one and
 * switching one off are not, because a live bundle is a discounted price the
 * storefront is still honouring and a lapsed store has to be able to withdraw
 * it. Same line the coupon and blocklist gates draw.
 */
async function requireBundleFeature(storeId: string) {
  await requirePlanFeature(storeId, "bundles");
}

export async function createBundleFormAction(
  _state: BundleActionState,
  formData: FormData
): Promise<BundleActionState> {
  const store = await requireStore();

  try {
    await requireBundleFeature(store.id);
    await saveBundle(store.id, bundleInputFromFormData(formData));
  } catch (error) {
    return bundleErrorState(error);
  }

  revalidateBundles(store.slug);
  redirect("/dashboard/marketing/bundles?created=1");
}

export async function updateBundleFormAction(
  bundleId: string,
  _state: BundleActionState,
  formData: FormData
): Promise<BundleActionState> {
  const store = await requireStore();

  try {
    await requireBundleFeature(store.id);
    await saveBundle(store.id, bundleInputFromFormData(formData), bundleId);
  } catch (error) {
    return bundleErrorState(error);
  }

  revalidateBundles(store.slug);
  redirect(`/dashboard/marketing/bundles/${bundleId}?updated=1`);
}

export async function deleteBundleAction(bundleId: string): Promise<BundleActionState> {
  const store = await requireStore();

  try {
    await deleteBundle(store.id, bundleId);
  } catch (error) {
    return bundleErrorState(error);
  }

  revalidateBundles(store.slug);
  redirect("/dashboard/marketing/bundles?deleted=1");
}

export async function setBundleStatusAction(bundleId: string, status: string) {
  const store = await requireStore();

  try {
    // Withdrawing a bundle is always allowed; publishing one is authoring.
    if (status === "ACTIVE") {
      await requireBundleFeature(store.id);
    }

    await setBundleStatus(store.id, bundleId, status);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Bundle status could not be changed.",
      ok: false as const
    };
  }

  revalidateBundles(store.slug);

  return { ok: true as const };
}

/**
 * The storefront prices bundles on every cart and checkout render, so both have
 * to be let go of whenever a rule changes.
 */
function revalidateBundles(storeSlug: string) {
  revalidatePath("/dashboard/marketing/bundles");
  revalidatePath(`/s/${storeSlug}/cart`);
  revalidatePath(`/s/${storeSlug}/checkout`);
}

/**
 * The editor posts one row per product as three parallel fields, which is how
 * a plain form expresses a list. They are zipped back together here.
 */
function bundleInputFromFormData(formData: FormData) {
  const productIds = formData.getAll("itemProductId").map((value) => String(value).trim());
  const quantities = formData.getAll("itemQuantity").map((value) => Number(value) || 1);

  return {
    buyQuantity: Number(getValue(formData, "buyQuantity")) || 0,
    description: getValue(formData, "description"),
    discountType: getValue(formData, "discountType") as BundleDiscountType,
    discountValue: getValue(formData, "discountValue"),
    expiresAt: getValue(formData, "expiresAt") || null,
    getQuantity: Number(getValue(formData, "getQuantity")) || 0,
    items: productIds
      .map((productId, index) => ({ productId, quantity: quantities[index] ?? 1 }))
      .filter((item) => item.productId),
    name: getValue(formData, "name"),
    startsAt: getValue(formData, "startsAt") || null,
    status: getValue(formData, "status") as BundleStatus,
    type: getValue(formData, "type") as BundleType
  };
}

function getValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function bundleErrorState(error: unknown): BundleActionState {
  if (error instanceof ZodError) {
    return {
      fieldErrors: Object.fromEntries(
        error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message])
      ),
      message: "Please fix the highlighted fields.",
      status: "error"
    };
  }

  return {
    message: error instanceof Error ? error.message : "The bundle could not be saved.",
    status: "error"
  };
}
