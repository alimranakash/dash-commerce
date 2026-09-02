import { NotificationBarSlot } from "../../../../modules/notification-bar/components/notification-bar-slot";
import { CartPage } from "../../../../modules/cart/components/cart-page";
import { getCart } from "../../../../modules/cart/cart.service";
import { toCartCrossSellProduct } from "../../../../modules/cart/cart-cross-sell";
import { priceCartBundles } from "../../../../modules/merchandising/bundle.service";
import { StorefrontFooter } from "../../../../modules/storefront/components/storefront-footer";
import { StorefrontHeader } from "../../../../modules/storefront/components/storefront-header";
import { normalizeAdvancedSettings } from "../../../../modules/storefront/customization";
import {
  getCartCrossSellRail,
  requireStorefrontBySlug
} from "../../../../modules/storefront/resolver";
import { getStorefrontThemeSettings } from "../../../../modules/storefront/themes/theme.service";

type StorefrontCartPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    added?: string;
    cartError?: string;
    cleared?: string;
    removed?: string;
    updated?: string;
  }>;
};

export default async function StorefrontCartPage({
  params,
  searchParams
}: StorefrontCartPageProps) {
  const { slug } = await params;
  const feedback = await searchParams;
  const store = await requireStorefrontBySlug(slug);
  const primaryDomain = store.domains.find((domain) => domain.isPrimary) ?? store.domains[0];
  const [cart, themeSettings] = await Promise.all([
    getCart(store.id),
    getStorefrontThemeSettings(store.id)
  ]);
  const advancedSettings = normalizeAdvancedSettings(themeSettings.advancedSettings);
  // Rendered with the page rather than fetched after it: this one is on screen
  // the moment the cart is, so a rail that popped in late would move the
  // checkout button under the shopper's thumb.
  const bundles = await priceCartBundles(
    store.id,
    cart.items.map((item) => ({
      lineId: item.lineId,
      price: item.price,
      productId: item.productId,
      quantity: item.quantity
    }))
  );
  const crossSell = await getCartCrossSellRail({
    cartProductIds: cart.items.map((item) => item.productId),
    storeId: store.id,
    take: 4
  });

  return (
    <main className="sf-page">
      <StorefrontHeader store={store} />
      <NotificationBarSlot anchor="top" store={store} surface="other" />
      <CartPage
        bundles={bundles.applied}
        cart={cart}
        crossSell={crossSell.map(toCartCrossSellProduct)}
        currency={store.currency}
        feedback={feedback}
        settings={advancedSettings.cartPage}
        store={store}
      />
      <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
    </main>
  );
}
