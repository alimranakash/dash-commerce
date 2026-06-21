import { CatalogManagementPlaceholder } from "../../../components/dashboard/catalog-management-placeholder";
import { requireStore } from "../../../modules/stores/queries";

export default async function TagsPage() {
  const store = await requireStore();
  return <CatalogManagementPlaceholder baseHref="/dashboard/tags" mode="all" pluralLabel="Tags" singularLabel="Tag" storeSlug={store.slug} />;
}
