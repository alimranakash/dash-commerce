import { CatalogManagementPlaceholder } from "../../../../components/dashboard/catalog-management-placeholder";
import { requireStore } from "../../../../modules/stores/queries";

export default async function CreateTagPage() {
  const store = await requireStore();
  return <CatalogManagementPlaceholder baseHref="/dashboard/tags" mode="create" pluralLabel="Tags" singularLabel="Tag" storeSlug={store.slug} />;
}
