import Link from "next/link";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { storeSubdomain } from "../../../../lib/host-routing";
import { SalesNotificationsConsole } from "../../../../modules/sales-notifications/components/sales-notifications-console";
import { saveSalesNotificationsAction } from "../../../../modules/sales-notifications/sales-notifications.actions";
import {
  getSalesNotificationCapability,
  getSalesNotificationPreviewSample,
  getSalesNotificationSettings
} from "../../../../modules/sales-notifications/sales-notifications.service";
import { getStoreAccess } from "../../../../modules/stores/queries";

/**
 * Dashboard → Marketing → Sales Notifications.
 *
 * Under Marketing rather than Storefront: this is something the shop says to a
 * shopper to move them, which is the same errand as an order bump or a coupon,
 * and it is read by the person who came to the dashboard to sell more rather
 * than the one who came to change a colour.
 *
 * `getStoreAccess()` rather than `requireStore()`, matching the other pages that
 * publish something: a member may read whether the widget is live, while the
 * switch is a manager's and `saveSalesNotificationsAction` refuses anyone else.
 *
 * The settings row is read once here and handed to `getSalesNotificationCapability`
 * so the page does not ask the same question twice.
 */
export default async function SalesNotificationsPage() {
  const access = await getStoreAccess();
  const settings = await getSalesNotificationSettings(access.store.id);
  const [capability, sample] = await Promise.all([
    getSalesNotificationCapability(access.store.id, settings),
    getSalesNotificationPreviewSample(access.store.id)
  ]);

  return (
    <DashboardShell storeSlug={access.store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Marketing</p>
            <h1>Sales notifications</h1>
            <p className="auth-copy">
              A small card in the corner of your shop showing what other people have just bought.
              Every one is a real order — there is no way to invent one here, which is what makes a
              shopper believe the last one they saw.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link className="secondary link-button" href="/dashboard/marketing">
              Back
            </Link>
          </div>
        </div>

        <SalesNotificationsConsole
          action={saveSalesNotificationsAction}
          canManage={access.canManage}
          capability={capability}
          sample={sample}
          settings={settings}
          storefrontUrl={`https://${storeSubdomain(access.store.slug)}`}
        />
      </section>
    </DashboardShell>
  );
}
