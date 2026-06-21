import { CatalogManagementPlaceholder } from "../../../components/dashboard/catalog-management-placeholder";
import { requireStore } from "../../../modules/stores/queries";

export default async function BrandsPage() {
  const store = await requireStore();
  return <CatalogManagementPlaceholder baseHref="/dashboard/brands" mode="all" pluralLabel="Brands" singularLabel="Brand" storeSlug={store.slug} />;
}
