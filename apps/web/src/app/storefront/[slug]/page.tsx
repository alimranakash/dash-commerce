import { StorefrontFooter } from "../../../modules/storefront/components/storefront-footer";
import { StorefrontHeader } from "../../../modules/storefront/components/storefront-header";
import {
  getStorefrontHomeData,
  requireStorefrontBySlug
} from "../../../modules/storefront/resolver";
import { getStorefrontTemplateForStore } from "../../../modules/storefront/templates/registry";
import { getStorefrontThemeSettings } from "../../../modules/storefront/themes/theme.service";

type StorefrontPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function StorefrontPage({ params }: StorefrontPageProps) {
  const { slug } = await params;
  const store = await requireStorefrontBySlug(slug);
  const primaryDomain = store.domains.find((domain) => domain.isPrimary) ?? store.domains[0];
  const homeData = await getStorefrontHomeData(store.id);
  const settings = await getStorefrontThemeSettings(store.id);
  const template = getStorefrontTemplateForStore(store);
  const HomepageSections = template.components.HomepageSections;

  return (
    <main className="sf-page" data-storefront-template={template.id}>
      <StorefrontHeader store={store} />
      <HomepageSections homeData={homeData} primaryDomain={primaryDomain?.domain} settings={settings} store={store} />
      <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
    </main>
  );
}
