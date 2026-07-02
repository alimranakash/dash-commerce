import type { StorefrontStore } from "../storefront.types";
import { getCart } from "../../cart/cart.service";
import { DefaultStorefrontHeader } from "../themes/default/components/default-storefront-header";
import { getStorefrontThemeSettings } from "../themes/theme.service";

type StorefrontHeaderProps = {
  store: StorefrontStore;
};

export async function StorefrontHeader({ store }: StorefrontHeaderProps) {
  const [settings, cart] = await Promise.all([
    getStorefrontThemeSettings(store.id),
    getCart(store.id)
  ]);

  return (
    <DefaultStorefrontHeader
      announcementText={settings.announcementText}
      advancedSettings={settings.advancedSettings}
      cart={cart}
      currency={store.currency}
      logoUrl={settings.logoUrl}
      storeId={store.id}
      storeName={store.name}
      storeSlug={store.slug}
      templateId={store.activeTemplate}
    />
  );
}
