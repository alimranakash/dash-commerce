import { prisma } from "@dash/db";
import {
  ensureProductTaxonomySchema,
  getProductTaxonomyItems
} from "../../../products/product-taxonomy.service";

export type ElectronicsHeaderCategory = {
  id: string;
  imageUrl: string | null;
  name: string;
  slug: string;
};

export type ElectronicsHeaderBrand = {
  categorySlugs: string[];
  id: string;
  name: string;
  slug: string;
};

type BrandCategoryRow = {
  brandId: string;
  categorySlug: string | null;
};

export async function getElectronicsHeaderData(storeId: string) {
  await ensureProductTaxonomySchema();

  const schema = databaseSchema();
  const [categories, brands, brandCategories] = await Promise.all([
    prisma.category.findMany({
      orderBy: {
        name: "asc"
      },
      select: {
        id: true,
        imageUrl: true,
        name: true,
        slug: true
      },
      where: {
        products: {
          some: {
            status: "ACTIVE",
            visibility: "PUBLIC"
          }
        },
        storeId
      }
    }),
    getProductTaxonomyItems(storeId, "BRAND"),
    prisma.$queryRawUnsafe<BrandCategoryRow[]>(
      `
        SELECT DISTINCT
          assignment."taxonomyId" AS "brandId",
          category."slug" AS "categorySlug"
        FROM ${schema}."ProductTaxonomyAssignment" assignment
        INNER JOIN ${schema}."Product" product ON product."id" = assignment."productId"
        LEFT JOIN ${schema}."Category" category ON category."id" = product."categoryId"
        WHERE assignment."storeId" = $1
          AND assignment."type" = 'BRAND'
          AND product."status" = 'ACTIVE'
          AND product."visibility" = 'PUBLIC'
      `,
      storeId
    )
  ]);

  const categorySlugsByBrand = new Map<string, Set<string>>();
  for (const row of brandCategories) {
    if (!row.categorySlug) {
      continue;
    }

    const slugs = categorySlugsByBrand.get(row.brandId) ?? new Set<string>();
    slugs.add(row.categorySlug);
    categorySlugsByBrand.set(row.brandId, slugs);
  }

  return {
    brands: brands.map((brand) => ({
      ...brand,
      categorySlugs: [...(categorySlugsByBrand.get(brand.id) ?? [])]
    })) satisfies ElectronicsHeaderBrand[],
    categories: categories satisfies ElectronicsHeaderCategory[]
  };
}

function databaseSchema() {
  const connectionString = process.env.DATABASE_URL;
  let schema = "public";

  if (connectionString) {
    try {
      schema = new URL(connectionString).searchParams.get("schema") ?? schema;
    } catch {
      schema = "public";
    }
  }

  return `"${schema.replaceAll('"', '""')}"`;
}
