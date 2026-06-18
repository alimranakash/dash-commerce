import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { updateCategory } from "../../../../modules/categories/category.service";
import { getCurrentStore } from "../../../../modules/stores/queries";

type CategoryRouteContext = {
  params: Promise<{
    categoryId: string;
  }>;
};

export async function PATCH(request: Request, { params }: CategoryRouteContext) {
  const store = await getCurrentStore();

  if (!store) {
    return unauthorizedStoreResponse();
  }

  try {
    const { categoryId } = await params;
    const category = await updateCategory(store.id, categoryId, await request.json());

    if (!category) {
      return NextResponse.json(
        {
          error: "Category not found."
        },
        {
          status: 404
        }
      );
    }

    return NextResponse.json({
      category
    });
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
