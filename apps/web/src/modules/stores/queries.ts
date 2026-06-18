import { prisma } from "@dash/db";
import { redirect } from "next/navigation";
import { getCurrentOrganization } from "../organizations/queries";

export async function getCurrentStore() {
  const organization = await getCurrentOrganization();

  if (!organization) {
    return null;
  }

  return prisma.store.findFirst({
    where: {
      organizationId: organization.id
    },
    include: {
      domains: {
        orderBy: [
          {
            isPrimary: "desc"
          },
          {
            createdAt: "asc"
          }
        ]
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  });
}

export async function requireStore() {
  const store = await getCurrentStore();

  if (!store) {
    redirect("/dashboard");
  }

  return store;
}
