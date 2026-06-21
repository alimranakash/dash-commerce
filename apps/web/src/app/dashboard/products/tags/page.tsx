import { ProductTaxonomyPlaceholder } from "../../../../components/dashboard/product-taxonomy-placeholder";
import { requireStore } from "../../../../modules/stores/queries";

export default async function TagsPage() { const store = await requireStore(); return <ProductTaxonomyPlaceholder storeSlug={store.slug} title="Tags" />; }
