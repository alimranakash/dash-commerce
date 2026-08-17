"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { PlanFeatureError, hasPlanFeature, requirePlanFeature } from "../billing/subscription-limits";
import type { GatedResult, PlanFeatureKey } from "../billing/plan-features";
import { requireStore } from "../stores/queries";
import {
  archiveExpense,
  createExpense,
  createExpenseCategory,
  deleteExpenseCategory,
  updateExpense,
  updateExpenseCategory
} from "./expense.service";
import type { CreateExpenseInput, ExpenseCategoryInput } from "./expense.schema";

export type ExpenseActionState = {
  lockedFeature?: PlanFeatureKey;
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export async function createExpenseFormAction(
  _state: ExpenseActionState,
  formData: FormData
): Promise<ExpenseActionState> {
  const store = await requireStore();

  try {
    await requirePlanFeature(store.id, "expenses");
    await createExpense(contextFromStore(store), expenseInputFromFormData(formData));
  } catch (error) {
    return expenseErrorState(error);
  }

  revalidatePath("/dashboard/expenses");
  redirect("/dashboard/expenses?created=1");
}

export async function updateExpenseFormAction(
  expenseId: string,
  _state: ExpenseActionState,
  formData: FormData
): Promise<ExpenseActionState> {
  const store = await requireStore();

  try {
    await requirePlanFeature(store.id, "expenses");
    const expense = await updateExpense(contextFromStore(store), expenseId, expenseInputFromFormData(formData));

    if (!expense) {
      return { message: "Expense not found.", status: "error" };
    }
  } catch (error) {
    return expenseErrorState(error);
  }

  revalidatePath("/dashboard/expenses");
  revalidatePath(`/dashboard/expenses/${expenseId}`);
  redirect(`/dashboard/expenses/${expenseId}?updated=1`);
}

export async function archiveExpenseAction(expenseId: string): Promise<GatedResult> {
  const store = await requireStore();

  if (!(await hasPlanFeature(store.id, "expenses"))) {
    return { lockedFeature: "expenses" };
  }

  await archiveExpense(contextFromStore(store), expenseId);

  revalidatePath("/dashboard/expenses");
  revalidatePath(`/dashboard/expenses/${expenseId}`);
  redirect("/dashboard/expenses?archived=1");
}

export async function createExpenseCategoryFormAction(
  _state: ExpenseActionState,
  formData: FormData
): Promise<ExpenseActionState> {
  const store = await requireStore();

  try {
    await requirePlanFeature(store.id, "expenses");
    await createExpenseCategory(store.organizationId, categoryInputFromFormData(formData));
  } catch (error) {
    return expenseErrorState(error);
  }

  revalidatePath("/dashboard/expenses/categories");
  redirect("/dashboard/expenses/categories?created=1");
}

export async function updateExpenseCategoryFormAction(
  categoryId: string,
  _state: ExpenseActionState,
  formData: FormData
): Promise<ExpenseActionState> {
  const store = await requireStore();

  try {
    await requirePlanFeature(store.id, "expenses");
    const category = await updateExpenseCategory(store.organizationId, categoryId, categoryInputFromFormData(formData));

    if (!category) {
      return { message: "Expense category not found.", status: "error" };
    }
  } catch (error) {
    return expenseErrorState(error);
  }

  revalidatePath("/dashboard/expenses/categories");
  redirect("/dashboard/expenses/categories?updated=1");
}

export async function deleteExpenseCategoryAction(categoryId: string): Promise<GatedResult> {
  const store = await requireStore();

  // Outside the try: that catch means "category still in use", and a plan block
  // must not be reported as that.
  if (!(await hasPlanFeature(store.id, "expenses"))) {
    return { lockedFeature: "expenses" };
  }

  try {
    await deleteExpenseCategory(store.organizationId, categoryId);
  } catch {
    redirect("/dashboard/expenses/categories?blocked=1");
  }

  revalidatePath("/dashboard/expenses/categories");
  redirect("/dashboard/expenses/categories?deleted=1");
}

function expenseInputFromFormData(formData: FormData): CreateExpenseInput {
  return {
    amount: stringValue(formData.get("amount")),
    attachmentUrl: optionalValue(formData.get("attachmentUrl")),
    categoryId: stringValue(formData.get("categoryId")),
    expenseDate: stringValue(formData.get("expenseDate")),
    notes: optionalValue(formData.get("notes")),
    paymentMethod: stringValue(formData.get("paymentMethod")) as CreateExpenseInput["paymentMethod"],
    reference: optionalValue(formData.get("reference")),
    status: stringValue(formData.get("status")) as CreateExpenseInput["status"],
    title: stringValue(formData.get("title"))
  };
}

function categoryInputFromFormData(formData: FormData): ExpenseCategoryInput {
  return {
    color: stringValue(formData.get("color")) || "#7C3AED",
    icon: stringValue(formData.get("icon")) || "receipt",
    name: stringValue(formData.get("name"))
  };
}

function contextFromStore(store: { id: string; organizationId: string }) {
  return {
    organizationId: store.organizationId,
    storeId: store.id
  };
}

function stringValue(value: FormDataEntryValue | null | undefined) {
  return String(value ?? "").trim();
}

function optionalValue(value: FormDataEntryValue | null | undefined) {
  const next = stringValue(value);
  return next || undefined;
}

function expenseErrorState(error: unknown): ExpenseActionState {
  if (error instanceof ZodError) {
    return {
      fieldErrors: Object.fromEntries(
        error.issues.map((issue) => [issue.path.length ? String(issue.path[0]) : "form", issue.message])
      ),
      message: "Please fix the highlighted fields.",
      status: "error"
    };
  }

  return {
    message: error instanceof Error ? error.message : "Expense operation failed.",
    status: "error",
    ...(error instanceof PlanFeatureError ? { lockedFeature: error.featureKey } : {})
  };
}
