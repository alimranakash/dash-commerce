import type { StorefrontStore } from "../storefront.types";
import { getCart } from "../../cart/cart.service";
import {
  cartEarnsFreeShipping,
  getFreeShippingBar
} from "../../free-shipping/free-shipping.service";
import { BeautyStorefrontHeader } from "../templates/beauty-default/beauty-header";
import { ElectronicsStorefrontHeader } from "../templates/electronics-default/electronics-header";
import { getElectronicsHeaderData } from "../templates/electronics-default/electronics-header-data";
import { FashionStorefrontHeader } from "../templates/fashion-default/fashion-header";
import { DefaultStorefrontHeader } from "../themes/default/components/default-storefront-header";
import { getStorefrontThemeSettings } from "../themes/theme.service";

type StorefrontHeaderProps = {
  store: StorefrontStore;
};

export async function StorefrontHeader({ store }: StorefrontHeaderProps) {
  const [settings, cart, electronicsHeaderData] = await Promise.all([
    getStorefrontThemeSettings(store.id),
    getCart(store.id),
    store.activeTemplate === "electronics-default"
      ? getElectronicsHeaderData(store.id)
      : Promise.resolve({ brands: [], categories: [] })
  ]);
  // One read for whichever header renders, from the store's real rule. The
  // mini cart is a client component, so this is the only place that can ask.
  const freeShippingBar = await getFreeShippingBar({
    currency: store.currency,
    hasFreeShippingProduct: await cartEarnsFreeShipping(
      store.id,
      cart.items.map((item) => item.productId)
    ),
    storeId: store.id,
    subtotal: cart.totals.subtotal,
    surface: "mini_cart"
  });

  if (store.activeTemplate === "fashion-default") {
    return (
      <FashionStorefrontHeader
        announcementText={settings.announcementText}
        advancedSettings={settings.advancedSettings}
        cart={cart}
        currency={store.currency}
        freeShippingBar={freeShippingBar}
        logoUrl={settings.logoUrl}
        storeId={store.id}
        storeName={store.name}
        storeSlug={store.slug}
        templateId={store.activeTemplate}
      />
    );
  }

  if (store.activeTemplate === "beauty-default") {
    return (
      <BeautyStorefrontHeader
        announcementText={settings.announcementText}
        advancedSettings={settings.advancedSettings}
        cart={cart}
        currency={store.currency}
        freeShippingBar={freeShippingBar}
        logoUrl={settings.logoUrl}
        storeId={store.id}
        storeName={store.name}
        storeSlug={store.slug}
      />
    );
  }

  if (store.activeTemplate === "electronics-default") {
    return (
      <ElectronicsStorefrontHeader
        announcementText={settings.announcementText}
        advancedSettings={settings.advancedSettings}
        brands={electronicsHeaderData.brands}
        cart={cart}
        categories={electronicsHeaderData.categories}
        currency={store.currency}
        freeShippingBar={freeShippingBar}
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
      freeShippingBar={freeShippingBar}
      logoUrl={settings.logoUrl}
      storeId={store.id}
      storeName={store.name}
      storeSlug={store.slug}
      templateId={store.activeTemplate}
    />
  );
}
