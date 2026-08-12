import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { CourierActivityLog } from "../../../../modules/courier/components/courier-activity-log";
import { CourierSettingsCards } from "../../../../modules/courier/components/courier-settings-cards";
import { listCourierAccountViews } from "../../../../modules/courier/courier-accounts.service";
import { isCourierEncryptionConfigured } from "../../../../modules/courier/courier-credentials";
import { getCourierActivity } from "../../../../modules/courier/courier.service";
import { requireStore } from "../../../../modules/stores/queries";

export default async function CourierSettingsPage() {
  const store = await requireStore();
  const [accounts, activity] = await Promise.all([
    listCourierAccountViews(store.id),
    getCourierActivity(store.id)
  ]);
  const configured = accounts.filter((account) => account.hasCredentials).length;

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <div>
          <h1 className="m-0 text-[1.65rem] font-semibold leading-tight">Courier API Setup</h1>
          <p className="mt-2 text-sm text-[#737582]">
            Connect a courier to book parcels and track deliveries from your orders. Credentials are
            encrypted before they are stored and are never shown back to you — only the last four
            characters, so you can tell which key is saved.
          </p>
          {configured === 0 ? (
            <p className="mt-3 rounded-lg border border-[#e5e0f7] bg-[#f7f4ff] px-4 py-3 text-sm text-[#655d78]">
              No courier is connected yet. Add your Steadfast API key and secret below, use{" "}
              <strong>Test connection</strong> to confirm they work, then enable it — the{" "}
              <strong>Send to courier</strong> button on an order becomes live straight away.
            </p>
          ) : null}
        </div>
        <CourierSettingsCards accounts={accounts} encryptionReady={isCourierEncryptionConfigured()} />
        <CourierActivityLog entries={activity} />
      </section>
    </DashboardShell>
  );
}
