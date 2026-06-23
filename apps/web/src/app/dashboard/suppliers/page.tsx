import { SupplierManagement } from "../../../modules/suppliers/components/supplier-management";
import { getSuppliersForOrganization } from "../../../modules/suppliers/supplier.service";
import { requireStore } from "../../../modules/stores/queries";

type SuppliersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SuppliersPage({ searchParams }: SuppliersPageProps) {
  const store = await requireStore();
  const params = await searchParams;
  const search = valueOf(params.search);
  const suppliers = await getSuppliersForOrganization(store.organizationId, search);
  const message = getSuppliersMessage(params);

  return (
    <SupplierManagement
      message={message}
      search={search}
      storeSlug={store.slug}
      suppliers={suppliers}
    />
  );
}

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function getSuppliersMessage(searchParams: Record<string, string | string[] | undefined>) {
  if (searchParams.created) return "Supplier created.";
  if (searchParams.updated) return "Supplier updated.";
  if (searchParams.deleted) return "Supplier deleted.";
  return null;
}
