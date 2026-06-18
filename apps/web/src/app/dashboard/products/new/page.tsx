import Link from "next/link";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { getCategoriesForStore } from "../../../../modules/categories/category.service";
import { ProductForm } from "../../../../modules/products/components/product-form";
import { createProductFormAction } from "../../../../modules/products/product.actions";
import { requireStore } from "../../../../modules/stores/queries";

export default async function NewProductPage() {
  const store = await requireStore();
  const categories = await getCategoriesForStore(store.id);

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
          categories={categories.map((category) => ({
            id: category.id,
            name: category.name
          }))}
          submitLabel="Create product"
        />
      </section>
    </DashboardShell>
  );
}
