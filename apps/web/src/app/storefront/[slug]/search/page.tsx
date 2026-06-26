import { StorefrontPlaceholderPage } from "../../../../modules/storefront/themes/default/components/storefront-placeholder-page";
import { requireStorefrontBySlug } from "../../../../modules/storefront/resolver";

type StorefrontSearchPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function StorefrontSearchPage({ params }: StorefrontSearchPageProps) {
  const { slug } = await params;
  const store = await requireStorefrontBySlug(slug);

  return (
    <StorefrontPlaceholderPage
      description="Search routing is ready. Product search UI and indexing will be connected in a later storefront phase."
      store={store}
      title="Search"
    />
  );
}
