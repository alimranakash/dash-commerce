import { CatalogManagementPlaceholder } from "../../../../components/dashboard/catalog-management-placeholder";
import { requireStore } from "../../../../modules/stores/queries";

export default async function CreateAttributePage() {
  const store = await requireStore();
  return <CatalogManagementPlaceholder baseHref="/dashboard/attributes" mode="create" pluralLabel="Attributes" singularLabel="Attribute" storeSlug={store.slug} />;
}
