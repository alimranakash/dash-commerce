"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { canCreateProduct } from "../billing/subscription-limits";
import { createCategory } from "../categories/category.service";
import { uploadMediaAsset } from "../media/media.service";
import { requireStore } from "../stores/queries";
import {
  archiveProduct,
  bulkUpdateProductStatus,
  createProduct,
  deleteProductPermanently,
  updateProduct,
  updateProductStatus
} from "./product.service";
import type { CreateProductInput, UpdateProductInput } from "./product.schema";
import {
  createProductTaxonomyItem,
  setProductCatalogSelections,
  type ProductTaxonomyType
} from "./product-taxonomy.service";
import {
  setProductVariantConfiguration,
  type ProductAttributeInput,
  type ProductVariantInput
} from "./product-variants.service";

export type ProductActionState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export async function createProductAction(input: CreateProductInput) {
  const store = await requireStore();
  await assertCanCreateProduct(store.id);
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
    const payload = await productPayloadFromFormData(store.id, formData);

    await assertCanCreateProduct(store.id);
    const product = await createProduct(store.id, payload.input);
    await setProductCatalogSelections({
      brandIds: payload.brandIds,
      categoryIds: payload.categoryIds,
      productId: product.id,
      storeId: store.id,
      tagIds: payload.tagIds
    });
    await setProductVariantConfiguration({
      attributes: payload.attributes,
      productId: product.id,
      storeId: store.id,
      variants: payload.variants
    });
  } catch (error) {
    return productErrorState(error);
  }

  revalidatePath("/dashboard/products");
  redirect("/dashboard/products?created=1");
}

async function assertCanCreateProduct(storeId: string) {
  if (!(await canCreateProduct(storeId))) {
    throw new Error("Product limit reached for your current plan.");
  }
}

export async function updateProductFormAction(
  productId: string,
  _state: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const store = await requireStore();

  try {
    const payload = await productPayloadFromFormData(store.id, formData);
    const product = await updateProduct(store.id, productId, payload.input);

    if (!product) {
      return {
        status: "error",
        message: "Product not found."
      };
    }

    await setProductCatalogSelections({
      brandIds: payload.brandIds,
      categoryIds: payload.categoryIds,
      productId: product.id,
      storeId: store.id,
      tagIds: payload.tagIds
    });
    await setProductVariantConfiguration({
      attributes: payload.attributes,
      productId: product.id,
      storeId: store.id,
      variants: payload.variants
    });
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

export async function restoreProductFormAction(productId: string) {
  const store = await requireStore();

  await updateProductStatus(store.id, productId, "DRAFT");

  revalidatePath("/dashboard/products");
  redirect("/dashboard/products?restored=1");
}

export async function deleteProductPermanentlyFormAction(productId: string) {
  const store = await requireStore();

  try {
    await deleteProductPermanently(store.id, productId);
  } catch {
    revalidatePath("/dashboard/products");
    redirect("/dashboard/products?deleteError=1&status=trash");
  }

  revalidatePath("/dashboard/products");
  redirect("/dashboard/products?permanentlyDeleted=1&status=trash");
}

type ProductFormPayload = {
  attributes: ProductAttributeInput[];
  brandIds: string[];
  categoryIds: string[];
  input: CreateProductInput;
  tagIds: string[];
  variants: ProductVariantInput[];
};

async function productPayloadFromFormData(storeId: string, formData: FormData): Promise<ProductFormPayload> {
  const categoryIds = getValues(formData, "categoryIds");
  const variants = await productVariantsFromFormData(storeId, formData);
  const images = (
    await Promise.all([
      resolveProductImage(storeId, formData, "mainImageUrl", "mainImageFile", 0),
      resolveProductImage(storeId, formData, "galleryImageUrl0", "galleryImageFile0", 1),
      resolveProductImage(storeId, formData, "galleryImageUrl1", "galleryImageFile1", 2),
      resolveProductImage(storeId, formData, "galleryImageUrl2", "galleryImageFile2", 3)
    ])
  ).filter((image): image is { position: number; url: string } => Boolean(image));

  return {
    attributes: productAttributesFromFormData(formData),
    brandIds: getValues(formData, "brandIds"),
    categoryIds,
    input: {
      title: getValue(formData, "title"),
      slug: optionalValue(formData, "slug"),
      shortDescription: nullableValue(formData, "shortDescription"),
      description: nullableValue(formData, "description"),
      sku: nullableValue(formData, "sku"),
      price: getValue(formData, "price"),
      compareAtPrice: nullableValue(formData, "compareAtPrice"),
      costPrice: nullableValue(formData, "costPrice"),
      stockQuantity: Number(getValue(formData, "stockQuantity") || 0),
      lowStockThreshold: Number(getValue(formData, "lowStockThreshold") || 0),
      categoryId: categoryIds[0] ?? null,
      status: getValue(formData, "status") as CreateProductInput["status"],
      visibility: getValue(formData, "visibility") as CreateProductInput["visibility"],
      images
    },
    tagIds: getValues(formData, "tagIds"),
    variants
  };
}

function productAttributesFromFormData(formData: FormData): ProductAttributeInput[] {
  const parsed = parseJsonArray(formData, "productAttributesJson");

  return parsed.map((attribute, position) => {
    const item = attribute as Record<string, unknown>;
    const values = Array.isArray(item.values) ? item.values : [];
    const id = stringValue(item.id);

    return {
      ...(id ? { id } : {}),
      name: stringValue(item.name) ?? "",
      position,
      values: values.map((value, valuePosition) => {
        const valueItem = value as Record<string, unknown>;
        const valueId = stringValue(valueItem.id);

        return {
          ...(valueId ? { id: valueId } : {}),
          name: stringValue(valueItem.name) ?? "",
          position: valuePosition
        };
      }).filter((value) => value.name.trim().length > 0)
    };
  }).filter((attribute) => attribute.name.trim().length > 0 && attribute.values.length > 0);
}

async function productVariantsFromFormData(storeId: string, formData: FormData): Promise<ProductVariantInput[]> {
  const parsed = parseJsonArray(formData, "productVariantsJson");
  const variants: ProductVariantInput[] = [];
  const signatures = new Set<string>();

  for (const [index, value] of parsed.entries()) {
    const item = value as Record<string, unknown>;
    const options = recordValue(item.options);
    const signature = stringValue(item.optionSignature) || signatureForOptions(options);

    if (!signature || signatures.has(signature)) {
      continue;
    }

    signatures.add(signature);

    variants.push({
      barcode: stringValue(item.barcode),
      compareAtPrice: stringValue(item.compareAtPrice),
      continueSelling: Boolean(item.continueSelling),
      costPrice: stringValue(item.costPrice),
      dimensions: stringValue(item.dimensions),
      imageUrl: await resolveVariantImage(storeId, formData, index, stringValue(item.imageUrl)),
      lowStockThreshold: numberValue(item.lowStockThreshold),
      optionSignature: signature,
      options,
      price: stringValue(item.price) || getValue(formData, "price") || "0",
      shippingClass: stringValue(item.shippingClass),
      sku: stringValue(item.sku),
      status: item.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
      stockQuantity: numberValue(item.stockQuantity),
      taxClass: stringValue(item.taxClass),
      title: stringValue(item.title) || Object.values(options).join(" / "),
      weight: stringValue(item.weight)
    });
  }

  return variants;
}

async function resolveVariantImage(storeId: string, formData: FormData, index: number, fallbackUrl: string | null | undefined) {
  const file = formData.get(`variantImageFile${index}`);

  if (file instanceof File && file.size > 0) {
    const asset = await uploadMediaAsset({
      alt: getValue(formData, "title") || "Variant image",
      file,
      storeId,
      usageType: "PRODUCT"
    });

    return asset.url;
  }

  const explicitUrl = getValue(formData, `variantImageUrl${index}`);

  return explicitUrl || fallbackUrl || null;
}

function parseJsonArray(formData: FormData, key: string) {
  const raw = getValue(formData, key);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function signatureForOptions(options: Record<string, string>) {
  return Object.entries(options)
    .map(([key, value]) => `${key}:${value}`)
    .join("|")
    .toLowerCase();
}

function recordValue(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, entryValue]) => [key, String(entryValue ?? "").trim()])
      .filter(([, entryValue]) => entryValue)
  );
}

function stringValue(value: unknown) {
  const text = String(value ?? "").trim();

  return text || null;
}

function numberValue(value: unknown) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

async function resolveProductImage(
  storeId: string,
  formData: FormData,
  valueField: string,
  fileField: string,
  position: number
) {
  const file = formData.get(fileField);

  if (file instanceof File && file.size > 0) {
    const asset = await uploadMediaAsset({
      alt: getValue(formData, "title") || "Product image",
      file,
      storeId,
      usageType: "PRODUCT"
    });

    return {
      position,
      url: asset.url
    };
  }

  const url = getValue(formData, valueField);

  return url ? { position, url } : null;
}

function getValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalValue(formData: FormData, key: string) {
  const value = getValue(formData, key);

  return value || undefined;
}

function nullableValue(formData: FormData, key: string) {
  return getValue(formData, key) || null;
}

function getValues(formData: FormData, key: string) {
  return Array.from(new Set(formData.getAll(key).map((value) => String(value).trim()).filter(Boolean)));
}

function productErrorState(error: unknown): ProductActionState {
  if (error instanceof ZodError) {
    return {
      status: "error",
      message: "Please fix the highlighted product fields.",
      fieldErrors: Object.fromEntries(
        error.issues.map((issue) => [
          issue.path[0] === "images" ? "images" : String(issue.path[0] ?? "form"),
          issue.message
        ])
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

export async function quickCreateProductCategoryAction(name: string) {
  const store = await requireStore();
  const categoryName = name.trim();

  if (categoryName.length < 2) {
    return {
      error: "Category name is required.",
      ok: false as const
    };
  }

  try {
    const category = await createCategory(store.id, {
      description: null,
      imageUrl: null,
      name: categoryName,
      parentId: null,
      slug: undefined
    });

    revalidatePath("/dashboard/products");

    return {
      category: {
        id: category.id,
        name: category.name
      },
      ok: true as const
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Category could not be created.",
      ok: false as const
    };
  }
}

export async function quickCreateProductTagAction(name: string) {
  return quickCreateProductTaxonomyAction("TAG", name);
}

export async function quickCreateProductBrandAction(name: string) {
  return quickCreateProductTaxonomyAction("BRAND", name);
}

async function quickCreateProductTaxonomyAction(type: ProductTaxonomyType, name: string) {
  const store = await requireStore();
  const itemName = name.trim();

  if (itemName.length < 2) {
    return {
      error: `${type === "TAG" ? "Tag" : "Brand"} name is required.`,
      ok: false as const
    };
  }

  try {
    const item = await createProductTaxonomyItem(store.id, type, itemName);

    revalidatePath(type === "TAG" ? "/dashboard/tags" : "/dashboard/brands");
    revalidatePath("/dashboard/products");

    return {
      item: {
        id: item?.id ?? "",
        name: item?.name ?? itemName
      },
      ok: true as const
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : `${type === "TAG" ? "Tag" : "Brand"} could not be created.`,
      ok: false as const
    };
  }
}

export async function archiveProductAction(productId: string) {
  const store = await requireStore();
  const product = await archiveProduct(store.id, productId);

  revalidatePath("/dashboard");

  return product;
}

export async function updateProductStatusAction(productId: string, status: string) {
  const store = await requireStore();

  try {
    await updateProductStatus(store.id, productId, status);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/products");
    return { ok: true as const };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Product status update failed.",
      ok: false as const
    };
  }
}

export async function bulkUpdateProductStatusAction(productIds: string[], status: string) {
  const store = await requireStore();

  try {
    await bulkUpdateProductStatus(store.id, productIds, status);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/products");
    return { ok: true as const };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Bulk status update failed.",
      ok: false as const
    };
  }
}
