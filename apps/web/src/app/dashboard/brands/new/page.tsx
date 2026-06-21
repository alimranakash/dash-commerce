import { CatalogManagementPlaceholder } from "../../../../components/dashboard/catalog-management-placeholder";
import { requireStore } from "../../../../modules/stores/queries";

export default async function CreateBrandPage() {
  const store = await requireStore();
  return <CatalogManagementPlaceholder baseHref="/dashboard/brands" mode="create" pluralLabel="Brands" singularLabel="Brand" storeSlug={store.slug} />;
}
