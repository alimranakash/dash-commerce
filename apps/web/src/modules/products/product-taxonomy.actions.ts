"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStore } from "../stores/queries";
import {
  createProductTaxonomyItem,
  deleteProductTaxonomyItem,
  type ProductTaxonomyType
} from "./product-taxonomy.service";

export async function createProductTaxonomyFormAction(type: ProductTaxonomyType, formData: FormData) {
  const store = await requireStore();
  const name = String(formData.get("name") ?? "").trim();

  await createProductTaxonomyItem(store.id, type, name);

  const path = taxonomyPath(type);
  revalidatePath(path);
  redirect(`${path}?created=1`);
}

export async function deleteProductTaxonomyFormAction(type: ProductTaxonomyType, itemId: string) {
  const store = await requireStore();

  await deleteProductTaxonomyItem(store.id, type, itemId);

  const path = taxonomyPath(type);
  revalidatePath(path);
  redirect(`${path}?deleted=1`);
}

function taxonomyPath(type: ProductTaxonomyType) {
  if (type === "TAG") return "/dashboard/tags";

  return type === "ATTRIBUTE" ? "/dashboard/attributes" : "/dashboard/brands";
}
