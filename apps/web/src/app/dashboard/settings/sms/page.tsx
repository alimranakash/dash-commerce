import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { FeatureGate } from "../../../../modules/billing/components/feature-gate";
import { getSmsAllowance } from "../../../../modules/billing/subscription-limits";
import { StoreSmsSettings } from "../../../../modules/notifications/components/store-sms-settings";
import {
  saveStoreMessagingAction,
  sendStoreTestSmsAction
} from "../../../../modules/notifications/store-messaging.actions";
import { getStoreMessagingView } from "../../../../modules/notifications/store-messaging.service";
import { requireStore } from "../../../../modules/stores/queries";

export default async function StoreSmsSettingsPage() {
  const store = await requireStore();
  const [settings, usage] = await Promise.all([
    getStoreMessagingView(store.id),
    getSmsAllowance(store.id)
  ]);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Settings</p>
            <span className="flex flex-wrap items-center gap-2">
              <h1>SMS</h1>
              <FeatureGate feature="sms_notifications" storeId={store.id} />
            </span>
            <p className="auth-copy">
              Choose when your store texts its customers. Your plan sets how many messages you
              get each month.
            </p>
          </div>
        </div>

        <StoreSmsSettings
          saveAction={saveStoreMessagingAction}
          settings={settings}
          testAction={sendStoreTestSmsAction}
          usage={usage}
        />
      </section>
    </DashboardShell>
  );
}
