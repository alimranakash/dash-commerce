import type { Cart } from "../../../cart/cart.types";
import {
  DEFAULT_STOREFRONT_ADVANCED_SETTINGS,
  type StorefrontAdvancedSettings
} from "../../customization";
import { FashionStorefrontHeader } from "../fashion-default/fashion-header";

type BeautyHeaderProps = {
  advancedSettings: StorefrontAdvancedSettings;
  announcementText: string | null;
  cart: Cart;
  currency: string;
  logoUrl: string | null;
  storeId: string;
  storeName: string;
  storeSlug: string;
};

// Beauty Default renders the Fashion Default header shell so both templates share
// one implementation and one set of `fashion-header-*` styles. Only the nav data
// is beauty's: the anchors point at the beauty homepage section ids.
const beautyMenuItems = [
  { label: "SHOP", url: "/products" },
  { label: "CATEGORIES", url: "#beauty-categories" },
  { label: "BEST SELLERS", url: "#beauty-best-sellers" },
  // Every anchor here has to match a section id the homepage actually renders,
  // or the link scrolls nowhere.
  { label: "CURATED", url: "#beauty-curated" },
  { label: "NEW ARRIVALS", url: "#beauty-new-arrivals" }
];

export function BeautyStorefrontHeader({ advancedSettings, ...rest }: BeautyHeaderProps) {
  return (
    <FashionStorefrontHeader
      {...rest}
      advancedSettings={withBeautyMenu(advancedSettings)}
      templateId="beauty-default"
    />
  );
}

// The shared header swaps in its own fallback nav whenever the seller has left the
// menu untouched, so beauty has to substitute its items before handing settings over
// or the fashion fallback (and its fashion-only anchors) would win.
function withBeautyMenu(settings: StorefrontAdvancedSettings): StorefrontAdvancedSettings {
  const isDefaultMenu = settings.header.menuItems.every(
    (item, index) =>
      item.label === DEFAULT_STOREFRONT_ADVANCED_SETTINGS.header.menuItems[index]?.label
  );

  if (!isDefaultMenu) {
    return settings;
  }

  return {
    ...settings,
    header: {
      ...settings.header,
      menuItems: beautyMenuItems
    }
  };
}
