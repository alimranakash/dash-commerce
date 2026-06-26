import { StorefrontPlaceholderPage } from "../../../../modules/storefront/themes/default/components/storefront-placeholder-page";
import { requireStorefrontByDomain } from "../../../../modules/storefront/resolver";

type StorefrontDomainPageProps = {
  params: Promise<{
    domain: string;
    path?: string[];
  }>;
};

export default async function StorefrontDomainPage({ params }: StorefrontDomainPageProps) {
  const { domain, path = [] } = await params;
  const store = await requireStorefrontByDomain(decodeURIComponent(domain));
  const routeLabel = path.length ? `/${path.join("/")}` : "/";

  return (
    <StorefrontPlaceholderPage
      description="Custom domain routing is ready. This domain resolves to the tenant store and can render any active storefront theme."
      store={store}
      title={`Custom domain route ${routeLabel}`}
    />
  );
}
