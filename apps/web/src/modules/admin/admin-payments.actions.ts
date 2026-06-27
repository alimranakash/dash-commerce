"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "./admin.auth";
import { markPaymentFailed, markPaymentPaid } from "./admin-payments.service";

export async function markPaymentPaidAction(paymentId: string) {
  await requirePlatformAdmin();

  try {
    await markPaymentPaid(paymentId);
    revalidatePath("/admin/payments");
    revalidatePath("/admin/subscriptions");
    return {
      message: "Payment approved successfully.",
      ok: true as const
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Payment approval failed.",
      ok: false as const
    };
  }
}

export async function markPaymentFailedAction(paymentId: string) {
  await requirePlatformAdmin();

  try {
    await markPaymentFailed(paymentId);
    revalidatePath("/admin/payments");
    revalidatePath("/admin/subscriptions");
    return {
      message: "Payment rejected successfully.",
      ok: true as const
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Payment rejection failed.",
      ok: false as const
    };
  }
}
