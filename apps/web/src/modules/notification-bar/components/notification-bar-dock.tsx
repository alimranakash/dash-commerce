import { resolveNotificationBar } from "../notification-bar.service";
import { NotificationBar } from "./notification-bar";

/**
 * The overlay half of the bar, mounted once from the storefront layout.
 *
 * An overlay is pinned to the viewport, so mounting it here rather than per page
 * is what lets it survive a shopper moving from a category to a product: a bar
 * remounted on every navigation would replay its entrance on every click and
 * reopen for someone who had just closed it.
 *
 * It is also why an overlay is **shop-wide** and takes no part in the surface
 * settings. "Only on the home page" is not a coherent thing to ask of something
 * that follows the shopper around, and the layout has no way to know which page
 * it is wrapping in any case. A seller who wants the bar on particular pages
 * chooses inline display, and `NotificationBarSlot` answers instead — this
 * returns null for those, so the two can never both render.
 *
 * Everything else — the seller's switch, the plan re-check, the schedule, the
 * headline — is settled by `resolveNotificationBar`, shared with the slots so
 * the two cannot disagree. A shop with no bar renders nothing: no markup, no
 * client bundle beyond this server component.
 */
export async function NotificationBarDock({ store }: { store: { id: string; slug: string } }) {
  const bar = await resolveNotificationBar(store);

  if (!bar || bar.display !== "overlay") {
    return null;
  }

  return <NotificationBar bar={bar} storeSlug={store.slug} />;
}
