import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "../../../lib/auth";
import { createOnboardingWorkspace } from "../../../modules/onboarding/service";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        error: "Authentication is required."
      },
      {
        status: 401
      }
    );
  }

  try {
    const workspace = await createOnboardingWorkspace(user.id, await request.json());

    return NextResponse.json(
      {
        workspace
      },
      {
        status: 201
      }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: error.issues[0]?.message ?? "Invalid onboarding details."
        },
        {
          status: 400
        }
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Workspace setup failed."
      },
      {
        status: 400
      }
    );
  }
}
