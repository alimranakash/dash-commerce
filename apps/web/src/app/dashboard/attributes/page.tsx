import { ProductTaxonomyManagement } from "../../../modules/products/components/product-taxonomy-management";
import { getProductTaxonomyItems } from "../../../modules/products/product-taxonomy.service";
import { requireStore } from "../../../modules/stores/queries";

type AttributesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AttributesPage({ searchParams }: AttributesPageProps) {
  const store = await requireStore();
  const items = await getProductTaxonomyItems(store.id, "ATTRIBUTE");

  return (
    <ProductTaxonomyManagement
      items={items}
      message={getMessage(await searchParams, "Attribute")}
      pluralLabel="Attributes"
      singularLabel="Attribute"
      storeSlug={store.slug}
      type="ATTRIBUTE"
    />
  );
}

function getMessage(searchParams: Record<string, string | string[] | undefined>, label: string) {
  if (searchParams.created) return `${label} created.`;
  if (searchParams.deleted) return `${label} deleted.`;
  return null;
}
