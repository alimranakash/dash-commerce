import { prisma } from "@dash/db";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";

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

  return membership?.organization ?? null;
}

export async function requireOrganization() {
  const organization = await getCurrentOrganization();

  if (!organization) {
    redirect("/dashboard");
  }

  return organization;
}
