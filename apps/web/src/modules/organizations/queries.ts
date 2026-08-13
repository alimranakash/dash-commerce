import { prisma } from "@dash/db";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";

/**
 * Returns the organization exactly as before, plus the caller's membership
 * `role` alongside it. Purely additive — `Organization` has no `role` column of
 * its own, so existing callers that read `id`/`name`/`slug` are unaffected.
 */
export async function getCurrentOrganization() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId: user.id
    },
    include: {
      organization: true
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  if (!membership) {
    return null;
  }

  return {
    ...membership.organization,
    role: membership.role
  };
}

export async function requireOrganization() {
  const organization = await getCurrentOrganization();

  if (!organization) {
    redirect("/dashboard");
  }

  return organization;
}
