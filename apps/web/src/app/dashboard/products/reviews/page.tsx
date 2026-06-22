import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { ProductReviewsPanel } from "../../../../modules/reviews/components/product-reviews-panel";
import { requireStore } from "../../../../modules/stores/queries";

type ProductReviewsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProductReviewsPage({ searchParams }: ProductReviewsPageProps) {
  const store = await requireStore();
  const params = await searchParams;

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="catalog-page-heading"><h1>Product Reviews</h1></div>
        <ProductReviewsPanel search={singleValue(params.search).trim()} />
      </section>
    </DashboardShell>
  );
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
