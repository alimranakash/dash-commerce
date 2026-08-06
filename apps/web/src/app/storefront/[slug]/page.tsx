import { StorefrontFooter } from "../../../modules/storefront/components/storefront-footer";
import { StorefrontHeader } from "../../../modules/storefront/components/storefront-header";
import type { StorefrontAdvancedSettings } from "../../../modules/storefront/customization";
import {
  getStorefrontHomeData,
  requireStorefrontBySlug
} from "../../../modules/storefront/resolver";
import {
  getStorefrontTemplateForStore,
  resolveStorefrontPreviewTemplateId
} from "../../../modules/storefront/templates/registry";
import { getStorefrontThemeSettings } from "../../../modules/storefront/themes/theme.service";

type StorefrontPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StorefrontPage({ params, searchParams }: StorefrontPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const resolvedStore = await requireStorefrontBySlug(slug);
  const previewTemplateId = resolveStorefrontPreviewTemplateId(query.previewTemplate);
  // The dashboard template library previews a template without applying it, so
  // the override is swapped in on the loaded store. Header, homepage sections,
  // and footer all read the template off the store, which keeps one override
  // point for the whole page.
  const store = previewTemplateId
    ? { ...resolvedStore, activeTemplate: previewTemplateId }
    : resolvedStore;
  const primaryDomain = store.domains.find((domain) => domain.isPrimary) ?? store.domains[0];
  const settings = await getStorefrontThemeSettings(store.id);
  // Each homepage row shows its own "Products shown" count, so the pools have
  // to be fetched deep enough for the largest of them.
  const homeData = await getStorefrontHomeData(store.id, homeProductsTake(settings.advancedSettings));
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

function homeProductsTake(advancedSettings: StorefrontAdvancedSettings) {
  const sections = advancedSettings.productSections;
  const tabbed = advancedSettings.tabbedProductShowcase;

  return Math.max(
    sections.featured.count,
    sections.bestSellers.count,
    sections.newArrivals.count,
    sections.trending.count,
    tabbed.productsPerTab,
    ...tabbed.tabs.map((tab) => tab.productCount)
  );
}
