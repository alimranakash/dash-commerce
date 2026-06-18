import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentStore } from "../../../../modules/stores/queries";
import {
  archiveProduct,
  getProductByIdForStore,
  updateProduct
} from "../../../../modules/products/product.service";

type ProductRouteContext = {
  params: Promise<{
    productId: string;
  }>;
};

export async function GET(_request: Request, { params }: ProductRouteContext) {
  const store = await getCurrentStore();

  if (!store) {
    return unauthorizedStoreResponse();
  }

  const { productId } = await params;
  const product = await getProductByIdForStore(store.id, productId);

  if (!product) {
    return notFoundResponse();
  }

  return NextResponse.json({
    product
  });
}

export async function PATCH(request: Request, { params }: ProductRouteContext) {
  const store = await getCurrentStore();

  if (!store) {
    return unauthorizedStoreResponse();
  }

  try {
    const { productId } = await params;
    const product = await updateProduct(store.id, productId, await request.json());

    if (!product) {
      return notFoundResponse();
    }

    return NextResponse.json({
      product
    });
  } catch (error) {
    return productErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: ProductRouteContext) {
  const store = await getCurrentStore();

  if (!store) {
    return unauthorizedStoreResponse();
  }

  const { productId } = await params;
  const product = await archiveProduct(store.id, productId);

  if (!product) {
    return notFoundResponse();
  }

  return NextResponse.json({
    product
  });
}

function unauthorizedStoreResponse() {
  return NextResponse.json(
    {
      error: "A store is required."
    },
    {
      status: 401
    }
  );
}

function notFoundResponse() {
  return NextResponse.json(
    {
      error: "Product not found."
    },
    {
      status: 404
    }
  );
}

function productErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: error.issues[0]?.message ?? "Invalid product details."
      },
      {
        status: 400
      }
    );
  }

  return NextResponse.json(
    {
      error: error instanceof Error ? error.message : "Product operation failed."
    },
    {
      status: 400
    }
  );
}
