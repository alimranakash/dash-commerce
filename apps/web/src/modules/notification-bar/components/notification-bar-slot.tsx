import { barAppearsAt } from "../notification-bar.render";
import { resolveNotificationBar } from "../notification-bar.service";
import type { NotificationBarAnchor, NotificationBarSurface } from "../notification-bar.schema";
import { NotificationBar } from "./notification-bar";

/**
 * One place a notification bar could go.
 *
 * Storefront pages and templates mark their anchors with this — `<NotificationBarSlot
 * anchor="below_cart" store={store} surface="product" />` — and all but at most
 * one of them render nothing. That is the design: the seller picks the spot in
 * the dashboard, and the page does not decide, does not branch, and does not
 * need to know what the seller chose.
 *
 * Cheap to scatter. `resolveNotificationBar` is wrapped in React's `cache()`, so
 * the four anchors on a product page share one settings read and one plan
 * lookup, and a shop with no bar pays for one query on the first slot and
 * nothing on the rest.
 *
 * A `data-nb-anchor` attribute is deliberately *not* emitted on the empty case:
 * an unrendered slot leaves no trace in the page source, so a competitor reading
 * the HTML learns nothing about where a shop would put an offer or whether one
 * is scheduled.
 */
export async function NotificationBarSlot({
  anchor,
  store,
  surface
}: {
  anchor: NotificationBarAnchor;
  store: { id: string; slug: string };
  surface: NotificationBarSurface;
}) {
  const bar = await resolveNotificationBar(store);

  if (!bar || !barAppearsAt(bar, surface, anchor)) {
    return null;
  }

  return <NotificationBar bar={bar} storeSlug={store.slug} />;
}
