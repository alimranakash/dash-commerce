import Link from "next/link";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { storeSubdomain } from "../../../../lib/host-routing";
import { NotificationBarConsole } from "../../../../modules/notification-bar/components/notification-bar-console";
import { saveNotificationBarAction } from "../../../../modules/notification-bar/notification-bar.actions";
import {
  getNotificationBarCapability,
  getNotificationBarSettings
} from "../../../../modules/notification-bar/notification-bar.service";
import { getStorefrontThemeSettings } from "../../../../modules/storefront/themes/theme.service";
import { getStoreAccess } from "../../../../modules/stores/queries";

/**
 * Dashboard → Marketing → Notification Bar.
 *
 * Under Marketing rather than Storefront, beside Sales Notifications: this is
 * something the shop says to move a shopper, which is the same errand as an
 * order bump or a coupon, and it is read by the person who came to the dashboard
 * to sell more rather than the one who came to change a colour.
 *
 * `getStoreAccess()` rather than `requireStore()`, matching the other pages that
 * publish something: a member may read whether the bar is live, while the switch
 * is a manager's and `saveNotificationBarAction` refuses anyone else.
 *
 * The settings row is read once here and handed to `getNotificationBarCapability`
 * so the page does not ask the same question twice.
 */
export default async function NotificationBarPage() {
  const access = await getStoreAccess();
  const settings = await getNotificationBarSettings(access.store.id);
  const [capability, theme] = await Promise.all([
    getNotificationBarCapability(access.store.id, settings),
    // So "your shop's colour" in the preview is this shop's colour rather than a
    // promise the panel makes and the storefront keeps differently.
    getStorefrontThemeSettings(access.store.id)
  ]);

  return (
    <DashboardShell storeSlug={access.store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Marketing</p>
            <h1>Notification bar</h1>
            <p className="auth-copy">
              Your best promotion is invisible if it is buried in the page. This is one line across
              your whole shop — with a countdown that runs to a real moment and takes the bar down
              with it, so you can never advertise a sale that has already finished.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link className="secondary link-button" href="/dashboard/marketing">
              Back
            </Link>
          </div>
        </div>

        <NotificationBarConsole
          action={saveNotificationBarAction}
          canManage={access.canManage}
          capability={capability}
          settings={settings}
          storePrimaryColor={theme.primaryColor}
          storefrontUrl={`https://${storeSubdomain(access.store.slug)}`}
        />
      </section>
    </DashboardShell>
  );
}
