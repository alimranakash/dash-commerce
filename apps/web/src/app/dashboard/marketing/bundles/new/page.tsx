import { DashboardShell } from "../../../../../components/dashboard/dashboard-shell";
import { BundleForm } from "../../../../../modules/merchandising/components/bundle-form";
import { createBundleFormAction } from "../../../../../modules/merchandising/bundle.actions";
import { getBundleProducts } from "../../../../../modules/merchandising/bundle.service";
import { requireStore } from "../../../../../modules/stores/queries";

export default async function NewBundlePage() {
  const store = await requireStore();
  const products = await getBundleProducts(store.id);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <BundleForm
          action={createBundleFormAction}
          cancelHref="/dashboard/marketing/bundles"
          currency={store.currency}
          heading="New bundle"
          products={products}
          submitLabel="Create bundle"
        />
      </section>
    </DashboardShell>
  );
}
