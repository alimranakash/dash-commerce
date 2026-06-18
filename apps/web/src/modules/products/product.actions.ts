"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireStore } from "../stores/queries";
import { archiveProduct, createProduct, updateProduct } from "./product.service";
import type { CreateProductInput, UpdateProductInput } from "./product.schema";

export type ProductActionState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export async function createProductAction(input: CreateProductInput) {
  const store = await requireStore();
  const product = await createProduct(store.id, input);

  revalidatePath("/dashboard");

  return product;
}

export async function createProductFormAction(
  _state: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const store = await requireStore();

  try {
    await createProduct(store.id, productInputFromFormData(formData));
  } catch (error) {
    return productErrorState(error);
  }

  revalidatePath("/dashboard/products");
  redirect("/dashboard/products?created=1");
}

export async function updateProductFormAction(
  productId: string,
  _state: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const store = await requireStore();

  try {
    const product = await updateProduct(store.id, productId, productInputFromFormData(formData));

    if (!product) {
      return {
        status: "error",
        message: "Product not found."
      };
    }
  } catch (error) {
    return productErrorState(error);
  }

  revalidatePath("/dashboard/products");
  redirect("/dashboard/products?updated=1");
}

export async function archiveProductFormAction(productId: string) {
  const store = await requireStore();
  await archiveProduct(store.id, productId);

  revalidatePath("/dashboard/products");
  redirect("/dashboard/products?archived=1");
}

function productInputFromFormData(formData: FormData): CreateProductInput {
  const imageUrls = getValue(formData, "imageUrls")
    .split(/\r?\n/)
    .map((url) => url.trim())
    .filter(Boolean);

  return {
    title: getValue(formData, "title"),
    slug: optionalValue(formData, "slug"),
    shortDescription: optionalValue(formData, "shortDescription"),
    description: optionalValue(formData, "description"),
    sku: optionalValue(formData, "sku"),
    price: getValue(formData, "price"),
    compareAtPrice: optionalValue(formData, "compareAtPrice"),
    costPrice: optionalValue(formData, "costPrice"),
    stockQuantity: Number(getValue(formData, "stockQuantity") || 0),
    lowStockThreshold: Number(getValue(formData, "lowStockThreshold") || 0),
    categoryId: optionalValue(formData, "categoryId"),
    status: getValue(formData, "status") as CreateProductInput["status"],
    visibility: getValue(formData, "visibility") as CreateProductInput["visibility"],
    images: imageUrls.map((url, position) => ({
      url,
      position
    }))
  };
}

function getValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalValue(formData: FormData, key: string) {
  const value = getValue(formData, key);

  return value || undefined;
}

function productErrorState(error: unknown): ProductActionState {
  if (error instanceof ZodError) {
    return {
      status: "error",
      message: "Please fix the highlighted product fields.",
      fieldErrors: Object.fromEntries(
        error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message])
      )
    };
  }

  return {
    status: "error",
    message: error instanceof Error ? error.message : "Product operation failed."
  };
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
