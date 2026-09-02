import { Check, Truck } from "lucide-react";
import Link from "next/link";
import type { FreeShippingBarView } from "../../free-shipping/free-shipping.schema";

/**
 * The free-shipping progress bar.
 *
 * Purely presentational, and that is the fix behind it. It used to be handed a
 * *display* threshold out of the theme settings — `cartPage.freeShippingAmount`,
 * on by default at 250 — and work out the shortfall itself, while
 * `createCheckoutOrder` charged the full delivery rate regardless. The number on
 * this bar and the number the shopper was billed had nothing to do with each
 * other. It now renders a `FreeShippingBarView` the server resolved through the
 * same functions checkout charges by.
 *
 * The two states are drawn as two different things on purpose, because they are:
 *
 * - **Short** is a task. A van icon, the shortfall in the sentence, and a track
 *   that is visibly part-filled — the shopper is being asked to do something and
 *   shown how far along they are.
 * - **Earned** is a receipt. The icon becomes a tick, the track fills and stops
 *   being the point, and the line reads as confirmation. A finished progress bar
 *   that still looks like a progress bar leaves people wondering whether they
 *   actually got it, which is the one question this component exists to answer.
 */
export function ShippingProgress({
  bar,
  ctaHref,
  ctaText
}: {
  bar: FreeShippingBarView;
  ctaHref: string;
  ctaText: string;
}) {
  const state = bar.qualifies ? "true" : "false";

  return (
    <div className="general-cart-shipping" data-qualified={state}>
      <div className="general-cart-shipping-row">
        <span aria-hidden="true" className="general-cart-shipping-icon">
          {bar.qualifies ? <Check /> : <Truck />}
        </span>
        {/* Polite rather than silent: the sentence changes as the shopper adds
          items, and "you have earned free shipping" is the one moment in a cart
          worth telling a screen-reader user about without them going to look. */}
        <p aria-live="polite">{bar.message}</p>
        {ctaText ? (
          <Link className="general-cart-shipping-cta" href={ctaHref}>
            {ctaText}
          </Link>
        ) : null}
      </div>
      {/* Hidden once earned: a full track adds nothing to a sentence that
        already says it is done, and keeping it invites a second look to check. */}
      {bar.qualifies ? null : (
        <div aria-hidden="true" className="general-cart-shipping-track" data-qualified={state}>
          <span style={{ width: `${bar.percent}%` }} />
        </div>
      )}
    </div>
  );
}
