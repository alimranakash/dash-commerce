import { cache } from "react";
import { normalizeAdvancedSettings } from "../storefront/customization";
import { getStorefrontBySlug, getStorefrontProductBySlug } from "../storefront/resolver";
import { getStorefrontThemeSettings } from "../storefront/themes/theme.service";
import { buildQuickViewProduct, buildQuickViewView } from "./quick-view.render";
import type { QuickViewProduct, QuickViewView } from "./quick-view.types";

/**
 * Quick View: the reads behind the modal.
 *
 * Two entry points, and neither of them is a second catalogue.
 *
 * `resolveQuickView` answers "is this shop running Quick View, and how", once
 * per request — `cache()` for the same reason `resolveNotificationBar` uses it:
 * the layout asks, and asking again anywhere else costs nothing.
 *
 * `getQuickViewProduct` answers "which product, exactly as the storefront would
 * show it". It goes through `getStorefrontProductBySlug`, which is the resolver's
 * own read and carries `publicProductWhere`, so a DRAFT or HIDDEN product can no
 * more be quick-viewed than linked, and one belonging to another store cannot be
 * reached by naming its slug on this one. There is no path here that takes a
 * product id, and none that takes a `storeId`: the store is the slug the shopper
 * was already browsing, which is exactly what visiting that storefront would
 * have read.
 */

/**
 * The seller's Quick View for this store, or null when it is off.
 *
 * Not plan-gated, deliberately. Quick View publishes nothing a shopper could not
 * already reach — it is a second way to read a product the shop already lists,
 * from the same row the product page reads — so gating it would be charging for
 * the placement of a button rather than for a capability. It sits with the other
 * storefront display settings, and follows their shape.
 */
export const resolveQuickView = cache(async function resolveQuickView(
  storeId: string
): Promise<QuickViewView | null> {
  const settings = await getStorefrontThemeSettings(storeId);

  return buildQuickViewView(normalizeAdvancedSettings(settings.advancedSettings));
});

/**
 * One product for the modal, or null.
 *
 * The seller's switch is re-checked here rather than trusted from the page that
 * asked. A shopper's tab can outlive the setting that opened it, and a URL is
 * not proof of an entitlement — the same discipline the notification bar applies
 * when it re-reads the plan on every render. A shop that has switched Quick View
 * off since the grid rendered answers nothing.
 */
export async function getQuickViewProduct(
  storeSlug: string,
  productSlug: string
): Promise<QuickViewProduct | null> {
  const store = await getStorefrontBySlug(storeSlug);

  if (!store) {
    return null;
  }

  const [view, settings] = await Promise.all([
    resolveQuickView(store.id),
    getStorefrontThemeSettings(store.id)
  ]);

  if (!view) {
    return null;
  }

  const product = await getStorefrontProductBySlug(store.id, productSlug);

  if (!product) {
    return null;
  }

  const advanced = normalizeAdvancedSettings(settings.advancedSettings);

  return buildQuickViewProduct({
    currency: store.currency,
    descriptionLength: advanced.quickView.descriptionLength,
    product,
    storeId: store.id,
    // An empty list when the seller has switched the selector off, rather than a
    // list the modal renders nothing for: the payload should not carry options
    // this shop is not offering here.
    variants: view.variantEnabled ? product.variantConfiguration.variants : []
  });
}
