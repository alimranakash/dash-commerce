import { CartPage } from "../../../../modules/cart/components/cart-page";
import { getCart } from "../../../../modules/cart/cart.service";
import { StorefrontFooter } from "../../../../modules/storefront/components/storefront-footer";
import { StorefrontHeader } from "../../../../modules/storefront/components/storefront-header";
import { normalizeAdvancedSettings } from "../../../../modules/storefront/customization";
import { requireStorefrontBySlug } from "../../../../modules/storefront/resolver";
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

  return (
    <main className="sf-page">
      <StorefrontHeader store={store} />
      <CartPage
        cart={cart}
        currency={store.currency}
        feedback={feedback}
        settings={advancedSettings.cartPage}
        store={store}
      />
      <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
    </main>
  );
}
