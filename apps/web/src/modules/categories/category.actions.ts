"use server";

import { revalidatePath } from "next/cache";
import { requireStore } from "../stores/queries";
import { createCategory, updateCategory } from "./category.service";
import type { CreateCategoryInput, UpdateCategoryInput } from "./category.schema";

export async function createCategoryAction(input: CreateCategoryInput) {
  const store = await requireStore();
  const category = await createCategory(store.id, input);

  revalidatePath("/dashboard");

  return category;
}

export async function updateCategoryAction(categoryId: string, input: UpdateCategoryInput) {
  const store = await requireStore();
  const category = await updateCategory(store.id, categoryId, input);

  revalidatePath("/dashboard");

  return category;
}
