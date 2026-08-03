"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireStore } from "../stores/queries";
import { createSupplier, deleteSupplier, updateSupplier } from "./supplier.service";
import type { CreateSupplierInput } from "./supplier.schema";

export type SupplierActionState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export async function createSupplierFormAction(
  _state: SupplierActionState,
  formData: FormData
): Promise<SupplierActionState> {
  const store = await requireStore();

  try {
    await createSupplier(store.organizationId, supplierInputFromFormData(formData));
  } catch (error) {
    return supplierErrorState(error);
  }

  revalidatePath("/dashboard/suppliers");
  redirect("/dashboard/suppliers?created=1");
}

export async function updateSupplierFormAction(
  supplierId: string,
  _state: SupplierActionState,
  formData: FormData
): Promise<SupplierActionState> {
  const store = await requireStore();

  try {
    const supplier = await updateSupplier(store.organizationId, supplierId, supplierInputFromFormData(formData));

    if (!supplier) {
      return {
        status: "error",
        message: "Supplier not found."
      };
    }
  } catch (error) {
    return supplierErrorState(error);
  }

  revalidatePath("/dashboard/suppliers");
  revalidatePath(`/dashboard/suppliers/${supplierId}`);
  redirect("/dashboard/suppliers?updated=1");
}

export async function deleteSupplierFormAction(supplierId: string) {
  const store = await requireStore();

  try {
    await deleteSupplier(store.organizationId, supplierId);
  } catch {
    redirect("/dashboard/suppliers?blocked=1");
  }

  revalidatePath("/dashboard/suppliers");
  redirect("/dashboard/suppliers?deleted=1");
}

function supplierInputFromFormData(formData: FormData): CreateSupplierInput {
  return {
    name: getValue(formData, "name"),
    companyName: optionalValue(formData, "companyName"),
    phone: getValue(formData, "phone"),
    email: optionalValue(formData, "email"),
    address: optionalValue(formData, "address"),
    notes: optionalValue(formData, "notes"),
    status: getValue(formData, "status") === "INACTIVE" ? "INACTIVE" : "ACTIVE"
  };
}

function getValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalValue(formData: FormData, key: string) {
  const value = getValue(formData, key);

  return value || undefined;
}

function supplierErrorState(error: unknown): SupplierActionState {
  if (error instanceof ZodError) {
    return {
      status: "error",
      message: "Please fix the highlighted supplier fields.",
      fieldErrors: Object.fromEntries(
        error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message])
      )
    };
  }

  return {
    status: "error",
    message: error instanceof Error ? error.message : "Supplier operation failed."
  };
}
