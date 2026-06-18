import { createUniqueSlug } from "../../lib/slug";
import {
  createCategoryRecord,
  getCategoriesForStore,
  getCategoryByIdForStore,
  isCategorySlugAvailable,
  updateCategoryRecord
} from "./category.repository";
import {
  createCategorySchema,
  updateCategorySchema,
  type CreateCategoryInput,
  type UpdateCategoryInput
} from "./category.schema";

export { getCategoriesForStore };
export { getCategoryByIdForStore };

export async function createCategory(storeId: string, input: CreateCategoryInput) {
  const data = createCategorySchema.parse(input);
  const slug = data.slug
    ? await assertCategorySlugAvailable(storeId, data.slug)
    : await createUniqueSlug(data.name, (candidate) => isCategorySlugAvailable(storeId, candidate));

  if (data.parentId) {
    await assertParentBelongsToStore(storeId, data.parentId);
  }

  return createCategoryRecord(storeId, {
    name: data.name,
    slug,
    ...optionalCategoryFields(data)
  });
}

export async function updateCategory(
  storeId: string,
  categoryId: string,
  input: UpdateCategoryInput
) {
  const existingCategory = await getCategoryByIdForStore(storeId, categoryId);

  if (!existingCategory) {
    return null;
  }

  const data = updateCategorySchema.parse(input);

  if (data.slug) {
    await assertCategorySlugAvailable(storeId, data.slug, categoryId);
  }

  if (data.parentId) {
    if (data.parentId === categoryId) {
      throw new Error("A category cannot be its own parent.");
    }

    await assertParentBelongsToStore(storeId, data.parentId);
  }

  return updateCategoryRecord(storeId, categoryId, optionalCategoryFields(data));
}

async function assertCategorySlugAvailable(storeId: string, slug: string, ignoreCategoryId?: string) {
  if (!(await isCategorySlugAvailable(storeId, slug, ignoreCategoryId))) {
    throw new Error("A category with this slug already exists.");
  }

  return slug;
}

async function assertParentBelongsToStore(storeId: string, parentId: string) {
  const parent = await getCategoryByIdForStore(storeId, parentId);

  if (!parent) {
    throw new Error("Parent category not found for this store.");
  }
}

function optionalCategoryFields(value: object) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  );
}
