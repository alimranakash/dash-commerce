import { StorefrontPlaceholderPage } from "../../../../modules/storefront/themes/default/components/storefront-placeholder-page";
import { requireStorefrontBySlug } from "../../../../modules/storefront/resolver";

type StorefrontOrdersPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function StorefrontOrdersPage({ params }: StorefrontOrdersPageProps) {
  const { slug } = await params;
  const store = await requireStorefrontBySlug(slug);

  return (
    <StorefrontPlaceholderPage
      description="Customer order history routing is ready. Secure order lookup will be connected in a later phase."
      store={store}
      title="Orders"
    />
  );
}
