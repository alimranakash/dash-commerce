import { ProductTaxonomyPlaceholder } from "../../../../components/dashboard/product-taxonomy-placeholder";
import { requireStore } from "../../../../modules/stores/queries";

export default async function BrandsPage() { const store = await requireStore(); return <ProductTaxonomyPlaceholder storeSlug={store.slug} title="Brands" />; }
