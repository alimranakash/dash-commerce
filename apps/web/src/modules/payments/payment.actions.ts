"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireStoreManager } from "../stores/queries";
import { paymentMethodTypes, type PaymentMethodInput } from "./payment.schema";
import { updatePaymentMethods } from "./payment.service";

export type PaymentSettingsActionState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export async function updatePaymentSettingsFormAction(
  _state: PaymentSettingsActionState,
  formData: FormData
): Promise<PaymentSettingsActionState> {
  let storeSlug: string;

  try {
    // Which payment methods a customer sees at checkout is a store-level
    // decision, so this is manager-only. The guard throws rather than
    // redirecting, hence its place inside the `try`.
    const { store } = await requireStoreManager();

    storeSlug = store.slug;
    await updatePaymentMethods(store.id, {
      methods: paymentMethodTypes.map((type, sortOrder) =>
        methodFromFormData(formData, type, sortOrder)
      )
    });
  } catch (error) {
    return paymentErrorState(error);
  }

  revalidatePath("/dashboard/payments");
  revalidatePath(`/s/${storeSlug}/checkout`);
  redirect("/dashboard/payments?updated=1");
}

function methodFromFormData(
  formData: FormData,
  type: PaymentMethodInput["type"],
  sortOrder: number
): PaymentMethodInput {
  return {
    type,
    name: getValue(formData, `${type}.name`),
    description: getValue(formData, `${type}.description`),
    instructions: getValue(formData, `${type}.instructions`),
    accountNumber: getValue(formData, `${type}.accountNumber`),
    accountType: getValue(formData, `${type}.accountType`),
    isEnabled: formData.get(`${type}.isEnabled`) === "on",
    sortOrder
  };
}

function getValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function paymentErrorState(error: unknown): PaymentSettingsActionState {
  if (error instanceof ZodError) {
    return {
      status: "error",
      message: "Please fix the highlighted payment settings.",
      fieldErrors: Object.fromEntries(
        error.issues.map((issue) => [fieldErrorKey(issue.path), issue.message])
      )
    };
  }

  return {
    status: "error",
    message: error instanceof Error ? error.message : "Payment settings update failed."
  };
}

// Zod reports `methods.<index>.<field>`, while the form keys its fields by payment
// method type (`methods.<TYPE>.<field>`).
function fieldErrorKey(path: ReadonlyArray<PropertyKey>) {
  const [root, index, ...rest] = path;

  if (root === "methods" && typeof index === "number" && paymentMethodTypes[index]) {
    return ["methods", paymentMethodTypes[index], ...rest.map(String)].join(".");
  }

  return path.map(String).join(".");
}
