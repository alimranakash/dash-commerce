import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { CourierSettingsCards } from "../../../../modules/courier/components/courier-settings-cards";
import { listCourierAccountViews } from "../../../../modules/courier/courier-accounts.service";
import { isCourierEncryptionConfigured } from "../../../../modules/courier/courier-credentials";
import { requireStore } from "../../../../modules/stores/queries";

export default async function CourierSettingsPage() {
  const store = await requireStore();
  const accounts = await listCourierAccountViews(store.id);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <div>
          <h1 className="m-0 text-[1.65rem] font-semibold leading-tight">Courier API Setup</h1>
          <p className="mt-2 text-sm text-[#737582]">
            Credentials are encrypted before they are stored and are never shown back to you — only
            the last four characters, so you can tell which key is saved.
          </p>
        </div>
        <CourierSettingsCards accounts={accounts} encryptionReady={isCourierEncryptionConfigured()} />
      </section>
    </DashboardShell>
  );
}
