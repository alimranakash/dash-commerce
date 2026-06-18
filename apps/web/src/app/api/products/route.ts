import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentStore } from "../../../modules/stores/queries";
import { createProduct, getProductsForStore } from "../../../modules/products/product.service";

export async function GET() {
  const store = await getCurrentStore();

  if (!store) {
    return unauthorizedStoreResponse();
  }

  const products = await getProductsForStore(store.id);

  return NextResponse.json({
    products
  });
}

export async function POST(request: Request) {
  const store = await getCurrentStore();

  if (!store) {
    return unauthorizedStoreResponse();
  }

  try {
    const product = await createProduct(store.id, await request.json());

    return NextResponse.json(
      {
        product
      },
      {
        status: 201
      }
    );
  } catch (error) {
    return productErrorResponse(error);
  }
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
