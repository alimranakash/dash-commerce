import { z } from "zod";
import type { FreeShippingRule } from "./free-shipping.render";

/**
 * The Free Shipping Bar — one threshold, and the places it is announced.
 *
 * The settings split cleanly in two, and the split is the feature:
 *
 * - **The rule** (`enabled`, `threshold`, `zoneIds`) is a *shipping* setting. It
 *   changes what the shop charges, so it is enforced by `createCheckoutOrder`
 *   and it is not gated by a plan — every store has to be able to decide what it
 *   bills for delivery.
 * - **The bar** (`barEnabled` and the placement flags) is only how the rule is
 *   announced. It cannot announce one that does not exist — `freeShippingProgress`
 *   returns null without a live rule — which is the whole reason this module
 *   replaced the display-only settings that came before it.
 */

/** Where the bar may appear. The cart is where it converts; the rest is reach. */
export const FREE_SHIPPING_SURFACES = ["cart", "mini_cart", "product"] as const;
export type FreeShippingSurface = (typeof FREE_SHIPPING_SURFACES)[number];

export type FreeShippingSettings = {
  /** Whether the progress bar is shown at all. */
  barEnabled: boolean;
  /** The line shown once the shopper has earned it. */
  barSuccessText: string;
  /** The line shown while they are short. `{amount}` is the shortfall. */
  barText: string;
  /** Whether checkout actually waives the delivery charge. */
  enabled: boolean;
  /** Which surfaces the bar appears on. Never empty while the bar is on. */
  surfaces: FreeShippingSurface[];
  /** The qualifying cart subtotal, in the store's currency. */
  threshold: number;
  /** Shipping zones the offer covers. Empty means every zone. */
  zoneIds: string[];
};

/**
 * What a shop gets before anyone touches the form.
 *
 * **Off.** This is the one default in the module that is not a style choice: the
 * settings it replaces shipped `freeShippingEnabled: true` at 250, so every
 * store on this platform is currently promising a discount its checkout does
 * not give. Seeding the new rule from that number would fix the lie by making
 * every shop start paying for delivery they never agreed to absorb — the
 * migration has to turn the *promise* off, never turn the *payment* on. A seller
 * who wants the offer sets a threshold and switches it on, and then it is true.
 */
export const FREE_SHIPPING_DEFAULTS: FreeShippingSettings = {
  barEnabled: true,
  barSuccessText: "You have earned free shipping.",
  barText: "Add {amount} more to get FREE shipping",
  enabled: false,
  surfaces: ["cart", "mini_cart"],
  threshold: 0,
  zoneIds: []
};

export const freeShippingSettingsSchema = z
  .object({
    barEnabled: z.boolean(),
    barSuccessText: z.string().trim().max(120),
    barText: z.string().trim().max(120),
    enabled: z.boolean(),
    surfaces: z.array(z.enum(FREE_SHIPPING_SURFACES)).transform((values) => [...new Set(values)]),
    // Two decimals, and no larger than any real cart. `0` means "no order-value
    // route" — see the refinement below.
    threshold: z.coerce.number().min(0).max(10_000_000),
    zoneIds: z
      .array(z.string().trim().min(1).max(64))
      .max(50)
      .transform((values) => [...new Set(values)])
  })
  .superRefine((value, ctx) => {
    // A threshold of zero while the rule is on is deliberately allowed: it is
    // the "only these products" configuration, where nothing is earned by cart
    // value and everything is earned by what is in the basket. What is refused
    // is a *negative* one, which the number field cannot express anyway.

    // `barEnabled` with no rule is deliberately *allowed*, and it is not a way
    // to lie: it is a preference — "show the bar when there is something to
    // show" — and `freeShippingProgress` returns null without a live rule, so
    // nothing renders either way. Refusing it here would only mean a seller
    // switching free shipping off had to remember to switch the bar off too,
    // and then back on again when they returned. The guard that matters is in
    // the pure function, not in the form.
    if (value.barEnabled && value.surfaces.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Choose at least one place for the bar to appear.",
        path: ["surfaces"]
      });
    }
  });

export type FreeShippingSettingsInput = z.infer<typeof freeShippingSettingsSchema>;

/** The rule half, as the pure functions and checkout take it. */
export function toFreeShippingRule(settings: FreeShippingSettings): FreeShippingRule {
  return {
    enabled: settings.enabled,
    threshold: settings.threshold,
    zoneIds: settings.zoneIds
  };
}

/**
 * The bar as the browser receives it.
 *
 * Already resolved: the threshold has been checked against the cart, the
 * sentence has been chosen and the shortfall formatted in the shop's currency.
 * A shop with no rule sends null and renders nothing.
 */
export type FreeShippingBarView = {
  message: string;
  percent: number;
  qualifies: boolean;
};
