import { ProductTaxonomyManagement } from "../../../modules/products/components/product-taxonomy-management";
import { getProductTaxonomyItems } from "../../../modules/products/product-taxonomy.service";
import { requireStore } from "../../../modules/stores/queries";

type TagsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TagsPage({ searchParams }: TagsPageProps) {
  const store = await requireStore();
  const items = await getProductTaxonomyItems(store.id, "TAG");

  return (
    <ProductTaxonomyManagement
      items={items}
      message={getMessage(await searchParams, "Tag")}
      pluralLabel="Tags"
      singularLabel="Tag"
      storeSlug={store.slug}
      type="TAG"
    />
  );
}

function getMessage(searchParams: Record<string, string | string[] | undefined>, label: string) {
  if (searchParams.created) return `${label} created.`;
  if (searchParams.deleted) return `${label} deleted.`;
  return null;
}
