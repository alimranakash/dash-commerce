import { SearchDiscoveryManagement } from "../../../../modules/search/components/search-discovery-management";
import { findStoreProductsForBoosting } from "../../../../modules/search/search-admin.repository";
import { getSearchDiscoveryOverview } from "../../../../modules/search/search-admin.service";
import { requireStore } from "../../../../modules/stores/queries";

type SearchDiscoveryPageProps = {
  searchParams: Promise<{
    error?: string;
    status?: string;
  }>;
};

const statusMessages: Record<string, string> = {
  "boost-removed": "Pin removed.",
  "boost-saved": "Product pinned.",
  "redirect-removed": "Redirect deleted.",
  "redirect-saved": "Redirect saved.",
  "synonym-removed": "Synonym group deleted.",
  "synonym-saved": "Synonym group saved."
};

export default async function SearchDiscoveryPage({ searchParams }: SearchDiscoveryPageProps) {
  const store = await requireStore();
  const { error, status } = await searchParams;
  const [overview, boostableProducts] = await Promise.all([
    getSearchDiscoveryOverview(store.id),
    findStoreProductsForBoosting(store.id)
  ]);

  return (
    <SearchDiscoveryManagement
      boostableProducts={boostableProducts}
      error={error ?? null}
      message={status ? (statusMessages[status] ?? null) : null}
      overview={overview}
      storeSlug={store.slug}
    />
  );
}
