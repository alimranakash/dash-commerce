import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
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
            <h1>SMS</h1>
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
