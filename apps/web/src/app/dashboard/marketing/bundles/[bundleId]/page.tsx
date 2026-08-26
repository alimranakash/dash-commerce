import { notFound } from "next/navigation";
import { DashboardShell } from "../../../../../components/dashboard/dashboard-shell";
import { BundleForm } from "../../../../../modules/merchandising/components/bundle-form";
import { updateBundleFormAction } from "../../../../../modules/merchandising/bundle.actions";
import { getBundle, getBundleProducts } from "../../../../../modules/merchandising/bundle.service";
import { requireStore } from "../../../../../modules/stores/queries";

type EditBundlePageProps = {
  params: Promise<{ bundleId: string }>;
};

export default async function EditBundlePage({ params }: EditBundlePageProps) {
  const store = await requireStore();
  const { bundleId } = await params;
  const [bundle, products] = await Promise.all([
    getBundle(store.id, bundleId),
    getBundleProducts(store.id)
  ]);

  if (!bundle) {
    notFound();
  }

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <BundleForm
          action={updateBundleFormAction.bind(null, bundle.id)}
          bundle={bundle}
          cancelHref="/dashboard/marketing/bundles"
          currency={store.currency}
          heading="Edit bundle"
          products={products}
          submitLabel="Save bundle"
        />
      </section>
    </DashboardShell>
  );
}
