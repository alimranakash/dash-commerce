import { hasPlanFeature } from "../../billing/subscription-limits";
import { storefrontBasePath } from "../../storefront/base-path";
import {
  getSalesNotificationFeed,
  getSalesNotificationSettings
} from "../sales-notifications.service";
import { SalesNotificationFeed } from "./sales-notification-feed";

/**
 * Whether this shop shows sales notifications, decided on the server.
 *
 * Mounted once from the storefront layout so the queue is not restarted by every
 * navigation — a shopper moving from a category to a product keeps their place
 * in it rather than being met with the first card again.
 *
 * The reads are ordered by cost, matching `ShoppingAgentDock`: this runs on
 * every storefront page of every shop and almost all of them have the widget
 * off, so one settings row settles it before the plan lookup and the feed query
 * happen at all. A shop that has not switched it on renders nothing — no
 * markup, no client bundle beyond this server component.
 *
 * The plan is re-checked here rather than trusted from the stored `enabled`. A
 * store that lapses stops showing the widget the next time a page renders, which
 * is the same rule every other entitled surface follows.
 */
export async function SalesNotificationDock({ store }: { store: { id: string; slug: string } }) {
  const settings = await getSalesNotificationSettings(store.id);

  if (!settings.enabled) {
    return null;
  }

  if (!(await hasPlanFeature(store.id, "sales_notifications"))) {
    return null;
  }

  const basePath = await storefrontBasePath(store.slug);
  const events = await getSalesNotificationFeed({
    basePath,
    settings,
    storeId: store.id
  });

  // A shop with no orders in the window shows nothing. There is deliberately no
  // fallback content: the only thing this widget is allowed to say is what
  // actually happened.
  if (events.length === 0) {
    return null;
  }

  return (
    <SalesNotificationFeed
      displaySeconds={settings.displaySeconds}
      events={events}
      gapSeconds={settings.gapSeconds}
      initialDelaySeconds={settings.initialDelaySeconds}
      loopFeed={settings.loopFeed}
      maxPerSession={settings.maxPerSession}
      position={settings.position}
      showOnMobile={settings.showOnMobile}
      showTimeAgo={settings.showTimeAgo}
      storeSlug={store.slug}
    />
  );
}
