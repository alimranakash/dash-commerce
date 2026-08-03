import { prisma } from "@dash/db";
import type { UpdateCategoryInput } from "./category.schema";
import { ensureCategoryImageSchema } from "./category-image-schema";

type CategoryWriteData = {
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  parentId?: string | null;
};

export async function getCategoriesForStore(storeId: string) {
  await ensureCategoryImageSchema();

  return prisma.category.findMany({
    where: {
      storeId
    },
    include: {
      parent: true,
      children: true
    },
    orderBy: {
      name: "asc"
    }
  });
}

export async function getCategoryByIdForStore(storeId: string, categoryId: string) {
  await ensureCategoryImageSchema();

  return prisma.category.findFirst({
    where: {
      id: categoryId,
      storeId
    }
  });
}

export async function isCategorySlugAvailable(storeId: string, slug: string, ignoreCategoryId?: string) {
  await ensureCategoryImageSchema();

  const where = ignoreCategoryId
    ? {
        storeId,
        slug,
        id: {
          not: ignoreCategoryId
        }
      }
    : {
        storeId,
        slug
      };

  const category = await prisma.category.findFirst({
    where,
    select: {
      id: true
    }
  });

  return !category;
}

export async function createCategoryRecord(storeId: string, data: CategoryWriteData) {
  await ensureCategoryImageSchema();

  const categoryData: Parameters<typeof prisma.category.create>[0]["data"] = {
    storeId,
    name: data.name,
    slug: data.slug
  };

  if (data.description) {
    categoryData.description = data.description;
  }

  if (data.imageUrl !== undefined) {
    categoryData.imageUrl = data.imageUrl;
  }

  if (data.parentId) {
    categoryData.parentId = data.parentId;
  }

  return prisma.category.create({
    data: categoryData
  });
}

export async function updateCategoryRecord(
  storeId: string,
  categoryId: string,
  data: UpdateCategoryInput
) {
  await ensureCategoryImageSchema();

  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      storeId
    },
    select: {
      id: true
    }
  });

  if (!category) {
    return null;
  }

  const categoryData: Parameters<typeof prisma.category.update>[0]["data"] = {};

  if (data.name !== undefined) categoryData.name = data.name;
  if (data.slug !== undefined) categoryData.slug = data.slug;
  if (data.description !== undefined) categoryData.description = data.description;
  if (data.imageUrl !== undefined) categoryData.imageUrl = data.imageUrl;
  if (data.parentId !== undefined) categoryData.parentId = data.parentId;

  return prisma.category.update({
    where: {
      id: categoryId
    },
    data: categoryData
  });
}

export async function deleteCategoryRecord(storeId: string, categoryId: string) {
  await ensureCategoryImageSchema();

  return prisma.category.deleteMany({
    where: {
      id: categoryId,
      storeId
    }
  });
}
