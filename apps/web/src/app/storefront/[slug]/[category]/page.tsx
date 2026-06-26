import { StorefrontPlaceholderPage } from "../../../../modules/storefront/themes/default/components/storefront-placeholder-page";
import { requireStorefrontBySlug } from "../../../../modules/storefront/resolver";

type StorefrontCategoryPageProps = {
  params: Promise<{
    category: string;
    slug: string;
  }>;
};

export default async function StorefrontCategoryPage({ params }: StorefrontCategoryPageProps) {
  const { category, slug } = await params;
  const store = await requireStorefrontBySlug(slug);
  const categoryName = decodeURIComponent(category).replace(/-/g, " ");

  return (
    <StorefrontPlaceholderPage
      description="Category routing is ready. Category product collections will be connected in a later storefront phase."
      store={store}
      title={categoryName}
    />
  );
}
