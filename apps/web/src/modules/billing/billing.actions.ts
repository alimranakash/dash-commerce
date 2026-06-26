"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requirePlatformAdmin } from "../admin/admin.auth";
import { requireStore } from "../stores/queries";
import {
  submitManualSubscriptionPayment,
  updateBillingSettings
} from "./billing.service";
import type { BillingSettingsInput, SubmitManualPaymentInput } from "./billing.schema";

export type BillingActionState = {
  fieldErrors?: Record<string, string>;
  message?: string;
  status: "idle" | "error";
};

export async function submitManualPaymentAction(
  _state: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  const store = await requireStore();

  try {
    await submitManualSubscriptionPayment(store, manualPaymentFromFormData(formData));
  } catch (error) {
    return billingErrorState(error, "Please fix the highlighted payment fields.");
  }

  revalidatePath("/dashboard/billing");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/subscriptions");
  redirect("/dashboard/billing?payment=pending");
}

export async function updateBillingSettingsAction(
  _state: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  await requirePlatformAdmin();

  try {
    await updateBillingSettings(billingSettingsFromFormData(formData));
  } catch (error) {
    return billingErrorState(error, "Please fix the highlighted billing settings.");
  }

  revalidatePath("/admin/payments/settings");
  revalidatePath("/dashboard/billing");
  redirect("/admin/payments/settings?updated=1");
}

function manualPaymentFromFormData(formData: FormData): SubmitManualPaymentInput {
  return {
    amount: Number(getValue(formData, "amount") || 0),
    billingCycle: getValue(formData, "billingCycle") as SubmitManualPaymentInput["billingCycle"],
    paymentMethod: getValue(formData, "paymentMethod") as SubmitManualPaymentInput["paymentMethod"],
    paymentNote: optionalValue(formData, "paymentNote"),
    paymentReference: getValue(formData, "paymentReference"),
    planId: getValue(formData, "planId"),
    senderNumber: getValue(formData, "senderNumber")
  };
}

function billingSettingsFromFormData(formData: FormData): BillingSettingsInput {
  return {
    bankAccountDetails: optionalValue(formData, "bankAccountDetails"),
    bkashAccountType: optionalValue(formData, "bkashAccountType"),
    bkashNumber: optionalValue(formData, "bkashNumber"),
    nagadAccountType: optionalValue(formData, "nagadAccountType"),
    nagadNumber: optionalValue(formData, "nagadNumber"),
    paymentInstructions: optionalValue(formData, "paymentInstructions"),
    rocketAccountType: optionalValue(formData, "rocketAccountType"),
    rocketNumber: optionalValue(formData, "rocketNumber")
  };
}

function getValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalValue(formData: FormData, key: string) {
  return getValue(formData, key) || undefined;
}

function billingErrorState(error: unknown, fallbackMessage: string): BillingActionState {
  if (error instanceof ZodError) {
    return {
      fieldErrors: Object.fromEntries(
        error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message])
      ),
      message: fallbackMessage,
      status: "error"
    };
  }

  return {
    message: error instanceof Error ? error.message : "Billing operation failed.",
    status: "error"
  };
}
