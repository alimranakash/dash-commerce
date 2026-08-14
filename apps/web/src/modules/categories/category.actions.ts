"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireStore } from "../stores/queries";
import { createCategory, deleteCategory, updateCategory } from "./category.service";
import type { CreateCategoryInput, UpdateCategoryInput } from "./category.schema";

export type CategoryActionState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export async function createCategoryAction(input: CreateCategoryInput) {
  const store = await requireStore();
  const category = await createCategory(store.id, input);

  revalidatePath("/dashboard");

  return category;
}

export async function createCategoryFormAction(
  _state: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const store = await requireStore();

  try {
    await createCategory(store.id, categoryInputFromFormData(formData));
  } catch (error) {
    return categoryErrorState(error);
  }

  revalidatePath("/dashboard/categories");
  redirect("/dashboard/categories?created=1");
}

export async function updateCategoryFormAction(
  categoryId: string,
  _state: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const store = await requireStore();

  try {
    const category = await updateCategory(store.id, categoryId, categoryInputFromFormData(formData));

    if (!category) {
      return {
        status: "error",
        message: "Category not found."
      };
    }
  } catch (error) {
    return categoryErrorState(error);
  }

  revalidatePath("/dashboard/categories");
  redirect("/dashboard/categories?updated=1");
}

export async function deleteCategoryFormAction(categoryId: string) {
  const store = await requireStore();
  await deleteCategory(store.id, categoryId);

  revalidatePath("/dashboard/categories");
  redirect("/dashboard/categories?deleted=1");
}

// The media picker uploads before the form is submitted, so the image arrives
// here as a library URL and there is no file part to resolve.
function categoryInputFromFormData(formData: FormData): CreateCategoryInput {
  return {
    name: getValue(formData, "name"),
    slug: optionalValue(formData, "slug"),
    description: getValue(formData, "description") || null,
    imageUrl: getValue(formData, "imageUrl") || null,
    parentId: getValue(formData, "parentId") || null
  };
}

function getValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalValue(formData: FormData, key: string) {
  const value = getValue(formData, key);

  return value || undefined;
}

function categoryErrorState(error: unknown): CategoryActionState {
  if (error instanceof ZodError) {
    return {
      status: "error",
      message: "Please fix the highlighted category fields.",
      fieldErrors: Object.fromEntries(
        error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message])
      )
    };
  }

  return {
    status: "error",
    message: error instanceof Error ? error.message : "Category operation failed."
  };
}

export async function updateCategoryAction(categoryId: string, input: UpdateCategoryInput) {
  const store = await requireStore();
  const category = await updateCategory(store.id, categoryId, input);

  revalidatePath("/dashboard");

  return category;
}
