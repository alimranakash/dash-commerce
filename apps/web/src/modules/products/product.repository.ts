import { prisma } from "@dash/db";
import type { CreateProductInput, UpdateProductInput } from "./product.schema";
import type { ProductStatus, ProductVisibility } from "./product.types";

type ProductWriteData = {
  title: string;
  slug: string;
  price: string;
  stockQuantity: number;
  lowStockThreshold: number;
  status: ProductStatus;
  visibility: ProductVisibility;
  description?: string;
  shortDescription?: string;
  sku?: string;
  compareAtPrice?: string;
  costPrice?: string;
  categoryId?: string;
};

type ProductUpdateData = Partial<ProductWriteData>;

export async function getProductsForStore(storeId: string) {
  return prisma.product.findMany({
    where: {
      storeId
    },
    include: {
      category: true,
      images: {
        orderBy: {
          position: "asc"
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

export async function getProductByIdForStore(storeId: string, productId: string) {
  return prisma.product.findFirst({
    where: {
      id: productId,
      storeId
    },
    include: {
      category: true,
      images: {
        orderBy: {
          position: "asc"
        }
      }
    }
  });
}

export async function isProductSlugAvailable(storeId: string, slug: string, ignoreProductId?: string) {
  const where = ignoreProductId
    ? {
        storeId,
        slug,
        id: {
          not: ignoreProductId
        }
      }
    : {
        storeId,
        slug
      };

  const product = await prisma.product.findFirst({
    where,
    select: {
      id: true
    }
  });

  return !product;
}

export async function isProductSkuAvailable(storeId: string, sku: string, ignoreProductId?: string) {
  const where = ignoreProductId
    ? {
        storeId,
        sku,
        id: {
          not: ignoreProductId
        }
      }
    : {
        storeId,
        sku
      };

  const product = await prisma.product.findFirst({
    where,
    select: {
      id: true
    }
  });

  return !product;
}

export async function createProductRecord(
  storeId: string,
  data: ProductWriteData,
  images: CreateProductInput["images"]
) {
  const productData = buildProductCreateData(storeId, data, images);

  return prisma.product.create({
    data: productData,
    include: {
      category: true,
      images: {
        orderBy: {
          position: "asc"
        }
      }
    }
  });
}

export async function updateProductRecord(
  storeId: string,
  productId: string,
  data: ProductUpdateData,
  images?: UpdateProductInput["images"]
) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: {
        id: productId,
        storeId
      },
      select: {
        id: true
      }
    });

    if (!product) {
      return null;
    }

    if (images) {
      await tx.productImage.deleteMany({
        where: {
          productId
        }
      });
    }

    const updateData = buildProductUpdateData(data, images);

    return tx.product.update({
      where: {
        id: productId
      },
      data: updateData,
      include: {
        category: true,
        images: {
          orderBy: {
            position: "asc"
          }
        }
      }
    });
  });
}

export async function archiveProductRecord(storeId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      storeId
    },
    select: {
      id: true
    }
  });

  if (!product) {
    return null;
  }

  return prisma.product.update({
    where: {
      id: productId
    },
    data: {
      status: "ARCHIVED",
      visibility: "HIDDEN"
    }
  });
}

export async function updateProductStatusRecord(
  storeId: string,
  productId: string,
  status: ProductStatus
) {
  return prisma.product.updateMany({
    where: {
      id: productId,
      storeId
    },
    data: statusData(status)
  });
}

export async function bulkUpdateProductStatusRecord(
  storeId: string,
  productIds: string[],
  status: ProductStatus
) {
  return prisma.product.updateMany({
    where: {
      id: {
        in: productIds
      },
      storeId
    },
    data: statusData(status)
  });
}

function statusData(status: ProductStatus) {
  return {
    status,
    visibility: status === "ACTIVE" ? ("PUBLIC" as const) : ("HIDDEN" as const)
  };
}

function buildProductCreateData(
  storeId: string,
  data: ProductWriteData,
  images: CreateProductInput["images"]
): Parameters<typeof prisma.product.create>[0]["data"] {
  const productData: Parameters<typeof prisma.product.create>[0]["data"] = {
    storeId,
    title: data.title,
    slug: data.slug,
    price: data.price,
    stockQuantity: data.stockQuantity,
    lowStockThreshold: data.lowStockThreshold,
    status: data.status,
    visibility: data.visibility,
    images: {
      create: images.map(formatImageInput)
    }
  };

  if (data.description) {
    productData.description = data.description;
  }

  if (data.shortDescription) {
    productData.shortDescription = data.shortDescription;
  }

  if (data.sku) {
    productData.sku = data.sku;
  }

  if (data.compareAtPrice) {
    productData.compareAtPrice = data.compareAtPrice;
  }

  if (data.costPrice) {
    productData.costPrice = data.costPrice;
  }

  if (data.categoryId) {
    productData.categoryId = data.categoryId;
  }

  return productData;
}

function buildProductUpdateData(
  data: ProductUpdateData,
  images?: UpdateProductInput["images"]
): Parameters<typeof prisma.product.update>[0]["data"] {
  const productData: Parameters<typeof prisma.product.update>[0]["data"] = {};

  if (data.title !== undefined) productData.title = data.title;
  if (data.slug !== undefined) productData.slug = data.slug;
  if (data.description !== undefined) productData.description = data.description;
  if (data.shortDescription !== undefined) productData.shortDescription = data.shortDescription;
  if (data.sku !== undefined) productData.sku = data.sku;
  if (data.price !== undefined) productData.price = data.price;
  if (data.compareAtPrice !== undefined) productData.compareAtPrice = data.compareAtPrice;
  if (data.costPrice !== undefined) productData.costPrice = data.costPrice;
  if (data.stockQuantity !== undefined) productData.stockQuantity = data.stockQuantity;
  if (data.lowStockThreshold !== undefined) {
    productData.lowStockThreshold = data.lowStockThreshold;
  }
  if (data.status !== undefined) productData.status = data.status;
  if (data.visibility !== undefined) productData.visibility = data.visibility;
  if (data.categoryId !== undefined) productData.categoryId = data.categoryId;
  if (images) {
    productData.images = {
      create: images.map(formatImageInput)
    };
  }

  return productData;
}

function formatImageInput(image: CreateProductInput["images"][number]) {
  return {
    url: image.url,
    alt: image.alt ?? null,
    position: image.position
  };
}
