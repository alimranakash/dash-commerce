import { StorefrontPlaceholderPage } from "../../../../modules/storefront/themes/default/components/storefront-placeholder-page";
import { requireStorefrontBySlug } from "../../../../modules/storefront/resolver";

type StorefrontAccountPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function StorefrontAccountPage({ params }: StorefrontAccountPageProps) {
  const { slug } = await params;
  const store = await requireStorefrontBySlug(slug);

  return (
    <StorefrontPlaceholderPage
      description="Customer account routing is ready. Authentication and customer self-service screens will be added later."
      store={store}
      title="Account"
    />
  );
}
