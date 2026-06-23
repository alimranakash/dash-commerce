import { prisma } from "@dash/db";
import type { CreateSupplierInput, UpdateSupplierInput } from "./supplier.schema";

export async function getSuppliersForOrganization(organizationId: string, search?: string) {
  const query = search?.trim();

  return prisma.supplier.findMany({
    where: {
      organizationId,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { companyName: { contains: query, mode: "insensitive" } },
              { phone: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } }
            ]
          }
        : {})
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

export async function getSupplierByIdForOrganization(organizationId: string, supplierId: string) {
  return prisma.supplier.findFirst({
    where: {
      id: supplierId,
      organizationId
    }
  });
}

export async function createSupplierRecord(organizationId: string, data: CreateSupplierInput) {
  return prisma.supplier.create({
    data: {
      organizationId,
      name: data.name,
      phone: data.phone,
      status: data.status,
      ...optionalSupplierFields(data)
    }
  });
}

export async function updateSupplierRecord(
  organizationId: string,
  supplierId: string,
  data: UpdateSupplierInput
) {
  const supplier = await prisma.supplier.findFirst({
    where: {
      id: supplierId,
      organizationId
    },
    select: {
      id: true
    }
  });

  if (!supplier) {
    return null;
  }

  return prisma.supplier.update({
    where: {
      id: supplierId
    },
    data: optionalSupplierFields(data)
  });
}

export async function deleteSupplierRecord(organizationId: string, supplierId: string) {
  return prisma.supplier.deleteMany({
    where: {
      id: supplierId,
      organizationId
    }
  });
}

function optionalSupplierFields(data: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  );
}
