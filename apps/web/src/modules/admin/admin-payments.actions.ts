"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "./admin.auth";
import { markPaymentFailed, markPaymentPaid } from "./admin-payments.service";

export async function markPaymentPaidAction(paymentId: string) {
  await requirePlatformAdmin();
  await markPaymentPaid(paymentId);
  revalidatePath("/admin/payments");
}

export async function markPaymentFailedAction(paymentId: string) {
  await requirePlatformAdmin();
  await markPaymentFailed(paymentId);
  revalidatePath("/admin/payments");
}
