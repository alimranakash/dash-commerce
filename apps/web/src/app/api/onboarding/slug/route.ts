import { NextResponse } from "next/server";
import { checkStoreSlugAvailability } from "../../../../modules/onboarding/service";

/**
 * Unauthenticated on purpose: it is called from the registration form, where
 * the account has been verified but no session exists yet. It reveals nothing
 * private — every store slug is already a public subdomain.
 */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug") ?? "";

  return NextResponse.json(await checkStoreSlugAvailability(slug));
}
