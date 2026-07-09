import type { StorefrontStore } from "../storefront.types";
import { getCart } from "../../cart/cart.service";
import { ElectronicsStorefrontHeader } from "../templates/electronics-default/electronics-header";
import { FashionStorefrontHeader } from "../templates/fashion-default/fashion-header";
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

  if (store.activeTemplate === "fashion-default") {
    return (
      <FashionStorefrontHeader
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

  if (store.activeTemplate === "electronics-default") {
    return (
      <ElectronicsStorefrontHeader
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
