import { createUniqueSlug } from "../../lib/slug";
import { getCategoryByIdForStore } from "../categories/category.repository";
import {
  archiveProductRecord,
  createProductRecord,
  getProductByIdForStore,
  getProductsForStore,
  isProductSkuAvailable,
  isProductSlugAvailable,
  updateProductRecord
} from "./product.repository";
import {
  createProductSchema,
  updateProductSchema,
  type CreateProductInput,
  type UpdateProductInput
} from "./product.schema";

export { getProductByIdForStore, getProductsForStore };

export async function createProduct(storeId: string, input: CreateProductInput) {
  const data = createProductSchema.parse(input);
  const slug = data.slug
    ? await assertProductSlugAvailable(storeId, data.slug)
    : await createUniqueSlug(data.title, (candidate) => isProductSlugAvailable(storeId, candidate));

  if (data.sku && !(await isProductSkuAvailable(storeId, data.sku))) {
    throw new Error("A product with this SKU already exists.");
  }

  if (data.categoryId) {
    await assertCategoryBelongsToStore(storeId, data.categoryId);
  }

  const { images, ...productData } = data;

  return createProductRecord(
    storeId,
    {
      title: productData.title,
      slug,
      price: productData.price,
      stockQuantity: productData.stockQuantity,
      lowStockThreshold: productData.lowStockThreshold,
      status: productData.status,
      visibility: productData.visibility,
      ...optionalProductFields(productData)
    },
    images
  );
}

export async function updateProduct(
  storeId: string,
  productId: string,
  input: UpdateProductInput
) {
  const existingProduct = await getProductByIdForStore(storeId, productId);

  if (!existingProduct) {
    return null;
  }

  const data = updateProductSchema.parse(input);

  if (data.slug) {
    await assertProductSlugAvailable(storeId, data.slug, productId);
  }

  if (data.sku && !(await isProductSkuAvailable(storeId, data.sku, productId))) {
    throw new Error("A product with this SKU already exists.");
  }

  if (data.categoryId) {
    await assertCategoryBelongsToStore(storeId, data.categoryId);
  }

  const { images, ...productData } = data;

  return updateProductRecord(storeId, productId, optionalProductFields(productData), images);
}

export async function archiveProduct(storeId: string, productId: string) {
  return archiveProductRecord(storeId, productId);
}

async function assertProductSlugAvailable(storeId: string, slug: string, ignoreProductId?: string) {
  if (!(await isProductSlugAvailable(storeId, slug, ignoreProductId))) {
    throw new Error("A product with this slug already exists.");
  }

  return slug;
}

async function assertCategoryBelongsToStore(storeId: string, categoryId: string) {
  const category = await getCategoryByIdForStore(storeId, categoryId);

  if (!category) {
    throw new Error("Category not found for this store.");
  }
}

function optionalProductFields(value: object) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  );
}
