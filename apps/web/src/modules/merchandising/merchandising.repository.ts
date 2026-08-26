import { prisma, type Prisma } from "@dash/db";
import type { ProductRelationType } from "./merchandising.schema";

/** What a storefront product card needs, matching the storefront read layer. */
const storefrontProductInclude = {
  category: true,
  images: {
    orderBy: {
      position: "asc"
    }
  }
} satisfies Prisma.ProductInclude;

/** The light product shape the seller-side pickers render. */
const relationProductSelect = {
  id: true,
  images: {
    orderBy: {
      position: "asc"
    },
    select: {
      url: true
    },
    take: 1
  },
  price: true,
  sku: true,
  status: true,
  title: true
} satisfies Prisma.ProductSelect;

export type ProductRelationWriteRow = {
  position: number;
  relatedProductId: string;
  type: ProductRelationType;
};

/** Everything paired *out of* one product, for the product editor. */
export async function getProductRelationsWithProducts(storeId: string, productId: string) {
  return prisma.productRelation.findMany({
    where: {
      productId,
      storeId
    },
    orderBy: [{ type: "asc" }, { position: "asc" }],
    select: {
      position: true,
      relatedProduct: {
        select: relationProductSelect
      },
      type: true
    }
  });
}

/**
 * The same pairings, filtered to what a shopper is allowed to see.
 *
 * A seller can pair a draft or hidden product — that is a catalogue decision,
 * not a storefront one — so the visibility filter belongs here rather than at
 * write time, where it would silently delete a pairing the seller still wants.
 */
export async function getPublicProductRelations(storeId: string, productId: string) {
  return prisma.productRelation.findMany({
    where: {
      productId,
      relatedProduct: {
        status: "ACTIVE",
        storeId,
        visibility: "PUBLIC"
      },
      storeId
    },
    orderBy: [{ type: "asc" }, { position: "asc" }],
    include: {
      relatedProduct: {
        include: storefrontProductInclude
      }
    }
  });
}

/**
 * Replace every pairing leaving this product in one transaction.
 *
 * The editor always posts the complete list, so a partial write would leave the
 * product carrying pairings the seller has just removed.
 */
export async function replaceProductRelations(input: {
  productId: string;
  rows: ProductRelationWriteRow[];
  storeId: string;
}) {
  await prisma.$transaction(async (tx) => {
    await tx.productRelation.deleteMany({
      where: {
        productId: input.productId,
        storeId: input.storeId
      }
    });

    if (input.rows.length === 0) {
      return;
    }

    await tx.productRelation.createMany({
      data: input.rows.map((row) => ({
        position: row.position,
        productId: input.productId,
        relatedProductId: row.relatedProductId,
        storeId: input.storeId,
        type: row.type
      }))
    });
  });
}

/** Which of these ids actually belong to this store. */
export async function getExistingProductIds(storeId: string, productIds: string[]) {
  if (productIds.length === 0) {
    return new Set<string>();
  }

  const rows = await prisma.product.findMany({
    where: {
      id: {
        in: productIds
      },
      storeId
    },
    select: {
      id: true
    }
  });

  return new Set(rows.map((row) => row.id));
}

/**
 * Everything the seller may pair with, for the editor's picker.
 *
 * Archived products are excluded — pairing one would put a dead card on the
 * storefront. Drafts and hidden products stay: sellers routinely line an
 * accessory up before publishing it.
 *
 * Like the order form's product list, this loads the catalogue in one go and
 * lets the client filter it. A store large enough for that to hurt needs a
 * search endpoint here first.
 */
export async function getRelationCandidateProducts(storeId: string) {
  return prisma.product.findMany({
    where: {
      status: {
        not: "ARCHIVED"
      },
      storeId
    },
    orderBy: {
      title: "asc"
    },
    select: relationProductSelect
  });
}

export type CoPurchaseCount = {
  orderCount: number;
  relatedProductId: string;
};

/**
 * The products that turned up in the same orders as this one, most often first.
 *
 * Counted over distinct orders rather than lines: a product bought in two sizes
 * is two lines of one order, and that is still one shopper deciding to buy the
 * pair. Cancelled orders are excluded the same way the best-seller pool
 * excludes them.
 *
 * Nothing here filters on product visibility. The same counts feed the
 * storefront rail, which may only show public products, and the seller's
 * editor, which is allowed to pair a draft — so both callers hydrate the ids
 * through their own filter instead of this query picking one for them.
 *
 * Prisma cannot express the self-join, so this is raw SQL against the schema
 * named in DATABASE_URL.
 */
export async function getCoPurchasedProductIds(input: {
  minOrders: number;
  productId: string;
  since: Date;
  storeId: string;
  take: number;
}) {
  return prisma.$queryRawUnsafe<CoPurchaseCount[]>(
    `
    SELECT other."productId" AS "relatedProductId",
           COUNT(DISTINCT line."orderId")::int AS "orderCount"
    FROM ${tableName("OrderItem")} line
    INNER JOIN ${tableName("Order")} ord ON ord."id" = line."orderId"
    INNER JOIN ${tableName("OrderItem")} other
      ON other."orderId" = line."orderId"
     AND other."productId" IS NOT NULL
     AND other."productId" <> line."productId"
    WHERE line."productId" = $1
      AND ord."storeId" = $2
      AND ord."status" <> 'CANCELLED'
      AND ord."createdAt" >= $3
    GROUP BY other."productId"
    HAVING COUNT(DISTINCT line."orderId") >= $4
    ORDER BY "orderCount" DESC, other."productId" ASC
    LIMIT $5
  `,
    input.productId,
    input.storeId,
    input.since,
    input.minOrders,
    input.take
  );
}

/** Hydrates co-purchase ids for a storefront rail. */
export async function getPublicProductsByIds(storeId: string, productIds: string[]) {
  if (productIds.length === 0) {
    return [];
  }

  return prisma.product.findMany({
    where: {
      id: {
        in: productIds
      },
      status: "ACTIVE",
      storeId,
      visibility: "PUBLIC"
    },
    include: storefrontProductInclude
  });
}

/** Hydrates co-purchase ids for the seller's picker, drafts included. */
export async function getCandidateProductsByIds(storeId: string, productIds: string[]) {
  if (productIds.length === 0) {
    return [];
  }

  return prisma.product.findMany({
    where: {
      id: {
        in: productIds
      },
      status: {
        not: "ARCHIVED"
      },
      storeId
    },
    select: relationProductSelect
  });
}

/**
 * The schema the connection string points at, re-derived here the way every
 * other raw-SQL path in this app derives it.
 */
function getDatabaseSchemaName() {
  const fallbackSchema = "public";
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    return fallbackSchema;
  }

  try {
    const schema = new URL(connectionString).searchParams.get("schema") ?? fallbackSchema;

    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(schema) ? schema : fallbackSchema;
  } catch {
    return fallbackSchema;
  }
}

function tableName(name: string) {
  const schema = getDatabaseSchemaName().replace(/"/g, '""');
  const table = name.replace(/"/g, '""');

  return `"${schema}"."${table}"`;
}

/**
 * Cross-sell candidates as storefront cards, filtered to what a one-tap Add
 * button can honestly do.
 *
 * Products with options are left out because the rail has nowhere to ask which
 * size, and out-of-stock ones because an Add button that fails is worse than a
 * shorter rail. Pre-orders go with them: the compact card has no room for the
 * ships-on date that makes a pre-order fair to sell.
 */
export async function getAddableStorefrontProductsByIds(storeId: string, productIds: string[]) {
  if (productIds.length === 0) {
    return [];
  }

  return prisma.product.findMany({
    where: {
      id: {
        in: productIds
      },
      status: "ACTIVE",
      stockQuantity: {
        gt: 0
      },
      storeId,
      variants: {
        none: {}
      },
      visibility: "PUBLIC"
    },
    include: storefrontProductInclude
  });
}
