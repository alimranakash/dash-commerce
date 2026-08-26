import { storefrontBasePath } from "../../storefront/base-path";
import Link from "next/link";
import type { StorefrontCartPageSettings } from "../../storefront/customization";
import type { AppliedBundle } from "../../merchandising/bundle-pricing";
import type { Cart } from "../cart.types";
import type { CartCrossSellProduct } from "../cart-cross-sell";
import { CartCrossSell } from "./cart-cross-sell";
import { CartSummary } from "./cart-summary";
import { CartTable } from "./cart-table";
import { EmptyCart } from "./empty-cart";
import { ShippingProgress } from "./shipping-progress";

type CartPageFeedback = {
  added?: string;
  cartError?: string;
  cleared?: string;
  removed?: string;
  updated?: string;
};

type CartPageProps = {
  /** What the cart's own contents already earned, before checkout. */
  bundles: AppliedBundle[];
  cart: Cart;
  /** Empty when the cart is empty, or when nothing sensible pairs with it. */
  crossSell: CartCrossSellProduct[];
  currency: string;
  feedback: CartPageFeedback;
  settings: StorefrontCartPageSettings;
  store: {
    id: string;
    name: string;
    slug: string;
  };
};

export async function CartPage({
  bundles,
  cart,
  crossSell,
  currency,
  feedback,
  settings,
  store
}: CartPageProps) {
  const basePath = await storefrontBasePath(store.slug);
  const itemLabel = cart.totals.itemCount === 1 ? "1 item" : `${cart.totals.itemCount} items`;
  const continueHref = storefrontHref(basePath, settings.continueShoppingLink);
  const checkoutHref = `${basePath}/checkout`;
  const shopHref = storefrontHref(basePath, settings.freeShippingCtaLink);
  const isEmpty = cart.items.length === 0;

  return (
    <section className={`general-cart-page general-cart-page-${settings.widthMode}`} aria-labelledby="cart-title">
      <div className="general-cart-inner">
        {settings.breadcrumbEnabled ? (
          <nav className="general-cart-breadcrumb" aria-label="Breadcrumb">
            <Link href={basePath || "/"}>Home</Link>
            <span aria-hidden="true">&gt;</span>
            <span>Shopping Cart</span>
          </nav>
        ) : null}

        <div className="general-cart-title-row">
          <h1 id="cart-title">Cart</h1>
          <span>{itemLabel}</span>
        </div>

        {feedback.cartError ? <p className="sf-alert">{feedback.cartError}</p> : null}
        {feedback.added ? <p className="sf-success">Product added to cart.</p> : null}
        {feedback.updated ? <p className="sf-success">Cart quantity updated.</p> : null}
        {feedback.removed ? <p className="sf-success">Product removed from cart.</p> : null}
        {feedback.cleared ? <p className="sf-success">Cart cleared.</p> : null}

        {settings.freeShippingEnabled && !isEmpty ? (
          <ShippingProgress
            amount={settings.freeShippingAmount}
            ctaHref={shopHref}
            ctaText={settings.freeShippingCtaText}
            currency={currency}
            subtotal={cart.totals.subtotal}
            text={settings.freeShippingText}
          />
        ) : null}

        {isEmpty ? (
          <EmptyCart continueHref={continueHref} />
        ) : (
          <>
            <CartTable
              cart={cart}
              currency={currency}
              showBrand={settings.showBrand}
              showRemoveButton={settings.showRemoveButton}
              showVariant={settings.showVariant}
              storeId={store.id}
              storeName={store.name}
              storeSlug={store.slug}
            />
            <CartSummary
              bundles={bundles}
              cart={cart}
              checkoutHref={checkoutHref}
              currency={currency}
              settings={settings}
              storeSlug={store.slug}
            />
            <CartCrossSell
              currency={currency}
              layout="page"
              products={crossSell}
              storeId={store.id}
              storeSlug={store.slug}
            />
          </>
        )}
      </div>
    </section>
  );
}

function storefrontHref(basePath: string, value: string) {
  if (value.startsWith("http")) {
    return value;
  }

  if (basePath && value.startsWith(basePath)) {
    return value;
  }

  if (value === "/") {
    return basePath || "/";
  }

  return `${basePath}${value.startsWith("/") ? value : `/${value}`}`;
}
