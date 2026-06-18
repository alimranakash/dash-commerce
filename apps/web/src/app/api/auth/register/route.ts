import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { registerUser } from "../../../../modules/auth/service";

export async function POST(request: Request) {
  try {
    const user = await registerUser(await request.json());

    return NextResponse.json(
      {
        user
      },
      {
        status: 201
      }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: error.issues[0]?.message ?? "Invalid registration details."
        },
        {
          status: 400
        }
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Registration failed."
      },
      {
        status: 400
      }
    );
  }
}
