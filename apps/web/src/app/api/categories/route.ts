import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createCategory, getCategoriesForStore } from "../../../modules/categories/category.service";
import { getCurrentStore } from "../../../modules/stores/queries";

export async function GET() {
  const store = await getCurrentStore();

  if (!store) {
    return unauthorizedStoreResponse();
  }

  const categories = await getCategoriesForStore(store.id);

  return NextResponse.json({
    categories
  });
}

export async function POST(request: Request) {
  const store = await getCurrentStore();

  if (!store) {
    return unauthorizedStoreResponse();
  }

  try {
    const category = await createCategory(store.id, await request.json());

    return NextResponse.json(
      {
        category
      },
      {
        status: 201
      }
    );
  } catch (error) {
    return categoryErrorResponse(error);
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

function categoryErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: error.issues[0]?.message ?? "Invalid category details."
      },
      {
        status: 400
      }
    );
  }

  return NextResponse.json(
    {
      error: error instanceof Error ? error.message : "Category operation failed."
    },
    {
      status: 400
    }
  );
}
