import Link from "next/link";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { getCategoriesForStore } from "../../../../modules/categories/category.service";
import { getPlatformRootDomain } from "../../../../lib/host-routing";
import {
  emptyProductRelationSelections,
  getProductRelationCandidates
} from "../../../../modules/merchandising/merchandising.service";
import { ProductForm } from "../../../../modules/products/components/product-form";
import { createProductFormAction } from "../../../../modules/products/product.actions";
import { getProductTaxonomyItems } from "../../../../modules/products/product-taxonomy.service";
import { requireStore } from "../../../../modules/stores/queries";

export default async function NewProductPage() {
  const store = await requireStore();
  const [categories, tags, brands, relationCandidates] = await Promise.all([
    getCategoriesForStore(store.id),
    getProductTaxonomyItems(store.id, "TAG"),
    getProductTaxonomyItems(store.id, "BRAND"),
    getProductRelationCandidates(store.id)
  ]);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Catalog</p>
            <h1>New product</h1>
            <p className="auth-copy">Create a draft product with pricing, inventory, and images.</p>
          </div>
          <Link className="secondary link-button" href="/dashboard/products">
            Back
          </Link>
        </div>
        <ProductForm
          action={createProductFormAction}
          brands={brands.map((brand) => ({
            id: brand.id,
            name: brand.name
          }))}
          categories={categories.map((category) => ({
            id: category.id,
            name: category.name
          }))}
          currency={store.currency}
          platformDomain={getPlatformRootDomain()}
          relationCandidates={relationCandidates}
          relationSelections={emptyProductRelationSelections()}
          relationSuggestions={[]}
          storeSlug={store.slug}
          submitLabel="Create product"
          tags={tags.map((tag) => ({
            id: tag.id,
            name: tag.name
          }))}
        />
      </section>
    </DashboardShell>
  );
}
