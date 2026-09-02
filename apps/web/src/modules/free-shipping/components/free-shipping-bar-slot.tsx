import { ShippingProgress } from "../../cart/components/shipping-progress";
import { getCart } from "../../cart/cart.service";
import { storefrontBasePath } from "../../storefront/base-path";
import { cartEarnsFreeShipping, getFreeShippingBar } from "../free-shipping.service";
import type { FreeShippingSurface } from "../free-shipping.schema";

/**
 * The free-shipping bar, outside the cart.
 *
 * The product page is where it earns most, and it has two things to say there.
 * For an ordinary product it is the usual progress line — "add ৳320 more for
 * free delivery" beside the buy button, at the moment a second item is still on
 * the table. For a product the seller flagged, it says so **before the shopper
 * has added anything**, because "buy this and delivery is on us" is the offer,
 * and an offer that only appears once the thing is already in the basket has
 * missed the decision it was meant to influence.
 *
 * That is why an empty cart is not automatically nothing here: it is nothing for
 * an ordinary product, and the earned line for a flagged one.
 */
export async function FreeShippingBarSlot({
  productId,
  store,
  surface
}: {
  /** The product being viewed, when there is one. Its own flag is enough. */
  productId?: string | undefined;
  store: { currency: string; id: string; slug: string };
  surface: FreeShippingSurface;
}) {
  const cart = await getCart(store.id);
  // The product on the page counts alongside the cart, so the offer is visible
  // at the point of decision rather than only after it has been taken.
  const earns = await cartEarnsFreeShipping(store.id, [
    ...cart.items.map((item) => item.productId),
    ...(productId ? [productId] : [])
  ]);

  if (cart.items.length === 0 && !earns) {
    return null;
  }

  const bar = await getFreeShippingBar({
    currency: store.currency,
    hasFreeShippingProduct: earns,
    storeId: store.id,
    subtotal: cart.totals.subtotal,
    surface
  });

  if (!bar) {
    return null;
  }

  const basePath = await storefrontBasePath(store.slug);

  return (
    <div className="sf-free-shipping-slot" data-qualified={bar.qualifies ? "true" : "false"}>
      {/* No call to action here: on a product page the shopper is already
        looking at the thing that would close the gap, and a "Shop now" link
        beside Add to Cart competes with it. */}
      <ShippingProgress bar={bar} ctaHref={`${basePath}/products`} ctaText="" />
    </div>
  );
}
