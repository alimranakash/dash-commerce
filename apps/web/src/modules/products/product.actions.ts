"use server";

import { revalidatePath } from "next/cache";
import { requireStore } from "../stores/queries";
import { archiveProduct, createProduct, updateProduct } from "./product.service";
import type { CreateProductInput, UpdateProductInput } from "./product.schema";

export async function createProductAction(input: CreateProductInput) {
  const store = await requireStore();
  const product = await createProduct(store.id, input);

  revalidatePath("/dashboard");

  return product;
}

export async function updateProductAction(productId: string, input: UpdateProductInput) {
  const store = await requireStore();
  const product = await updateProduct(store.id, productId, input);

  revalidatePath("/dashboard");

  return product;
}

export async function archiveProductAction(productId: string) {
  const store = await requireStore();
  const product = await archiveProduct(store.id, productId);

  revalidatePath("/dashboard");

  return product;
}
