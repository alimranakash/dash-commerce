"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireStore } from "../stores/queries";
import { CouponError, createCoupon, deleteCoupon, setCouponStatus, updateCoupon } from "./coupon.service";
import type { CouponFormInput } from "./coupon.schema";

export type CouponActionState = {
  fieldErrors?: Record<string, string>;
  message?: string;
  status: "error" | "idle";
};

export async function createCouponFormAction(
  _state: CouponActionState,
  formData: FormData
): Promise<CouponActionState> {
  const store = await requireStore();

  try {
    await createCoupon(store.id, couponInputFromFormData(formData));
  } catch (error) {
    return couponErrorState(error);
  }

  revalidatePath("/dashboard/coupons");
  redirect("/dashboard/coupons?created=1");
}

export async function updateCouponFormAction(
  couponId: string,
  _state: CouponActionState,
  formData: FormData
): Promise<CouponActionState> {
  const store = await requireStore();

  try {
    const coupon = await updateCoupon(store.id, couponId, couponInputFromFormData(formData));

    if (!coupon) {
      return { message: "Coupon not found.", status: "error" };
    }
  } catch (error) {
    return couponErrorState(error);
  }

  revalidatePath("/dashboard/coupons");
  revalidatePath(`/dashboard/coupons/${couponId}`);
  redirect(`/dashboard/coupons/${couponId}?updated=1`);
}

export async function deleteCouponAction(couponId: string): Promise<CouponActionState> {
  const store = await requireStore();

  try {
    const coupon = await deleteCoupon(store.id, couponId);

    if (!coupon) {
      return { message: "Coupon not found.", status: "error" };
    }
  } catch (error) {
    // A used coupon refuses deletion with an explanation worth showing, so this
    // returns rather than redirecting to a generic `?blocked=1`.
    return couponErrorState(error);
  }

  revalidatePath("/dashboard/coupons");
  redirect("/dashboard/coupons?deleted=1");
}

export async function setCouponStatusAction(couponId: string, status: "ACTIVE" | "INACTIVE") {
  const store = await requireStore();

  await setCouponStatus(store.id, couponId, status);

  revalidatePath("/dashboard/coupons");
  revalidatePath(`/dashboard/coupons/${couponId}`);
}

function couponInputFromFormData(formData: FormData): CouponFormInput {
  return {
    code: stringValue(formData.get("code")),
    description: optionalValue(formData.get("description")),
    discountType: stringValue(formData.get("discountType")) as CouponFormInput["discountType"],
    discountValue: stringValue(formData.get("discountValue")) || "0",
    expiresAt: optionalValue(formData.get("expiresAt")),
    maxDiscountAmount: optionalValue(formData.get("maxDiscountAmount")),
    maxSubtotal: optionalValue(formData.get("maxSubtotal")),
    minSubtotal: optionalValue(formData.get("minSubtotal")),
    name: stringValue(formData.get("name")),
    startsAt: optionalValue(formData.get("startsAt")),
    status: stringValue(formData.get("status")) as CouponFormInput["status"],
    usageLimitPerCustomer: optionalValue(formData.get("usageLimitPerCustomer")),
    usageLimitTotal: optionalValue(formData.get("usageLimitTotal"))
  };
}

function stringValue(value: FormDataEntryValue | null | undefined) {
  return String(value ?? "").trim();
}

function optionalValue(value: FormDataEntryValue | null | undefined) {
  const next = stringValue(value);
  return next || undefined;
}

function couponErrorState(error: unknown): CouponActionState {
  if (error instanceof ZodError) {
    return {
      fieldErrors: Object.fromEntries(
        error.issues.map((issue) => [
          issue.path.length ? String(issue.path[0]) : "form",
          issue.message
        ])
      ),
      message: "Please fix the highlighted fields.",
      status: "error"
    };
  }

  if (error instanceof CouponError) {
    return {
      fieldErrors: { [error.field]: error.message },
      message: error.message,
      status: "error"
    };
  }

  return {
    message: error instanceof Error ? error.message : "Coupon operation failed.",
    status: "error"
  };
}
