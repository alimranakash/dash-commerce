import type { StorefrontStore } from "../storefront.types";
import { DefaultStorefrontHeader } from "../themes/default/components/default-storefront-header";
import { getStorefrontThemeSettings } from "../themes/theme.service";

type StorefrontHeaderProps = {
  store: StorefrontStore;
};

export async function StorefrontHeader({ store }: StorefrontHeaderProps) {
  const settings = await getStorefrontThemeSettings(store.id);

  return (
    <DefaultStorefrontHeader
      announcementText={settings.announcementText}
      advancedSettings={settings.advancedSettings}
      cartCount={0}
      logoUrl={settings.logoUrl}
      storeName={store.name}
      storeSlug={store.slug}
      templateId={store.activeTemplate}
    />
  );
}
