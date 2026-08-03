import {
  createSupplierRecord,
  deleteSupplierRecord,
  getSupplierByIdForOrganization,
  getSuppliersForOrganization,
  supplierHasPurchases,
  updateSupplierRecord
} from "./supplier.repository";
import {
  createSupplierSchema,
  updateSupplierSchema,
  type CreateSupplierInput,
  type UpdateSupplierInput
} from "./supplier.schema";

export { getSupplierByIdForOrganization, getSuppliersForOrganization };

export async function createSupplier(organizationId: string, input: CreateSupplierInput) {
  const data = createSupplierSchema.parse(input);

  return createSupplierRecord(organizationId, data);
}

export async function updateSupplier(
  organizationId: string,
  supplierId: string,
  input: UpdateSupplierInput
) {
  const data = updateSupplierSchema.parse(input);

  return updateSupplierRecord(organizationId, supplierId, data);
}

export async function deleteSupplier(organizationId: string, supplierId: string) {
  if (await supplierHasPurchases(organizationId, supplierId)) {
    throw new Error("This supplier has purchases and cannot be deleted.");
  }

  const result = await deleteSupplierRecord(organizationId, supplierId);

  return result.count > 0;
}
