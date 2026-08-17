import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { MarketingSettingsForm } from "../../../../modules/marketing/components/marketing-settings-form";
import {
  sendGa4TestEventAction,
  sendMetaTestEventAction,
  updateMarketingSettingsFormAction
} from "../../../../modules/marketing/marketing.actions";
import { getMarketingSettingsView } from "../../../../modules/marketing/marketing.service";
import { getStoreAccess } from "../../../../modules/stores/queries";

export default async function MarketingSettingsPage() {
  const access = await getStoreAccess();
  const settings = await getMarketingSettingsView(access.store.id);

  return (
    <DashboardShell storeSlug={access.store.slug}>
      <section className="resource-page max-w-none">
        <div>
          <h1 className="m-0 text-[1.65rem] font-semibold leading-tight">Marketing / Analytics</h1>
          <p className="mt-2 text-sm text-[#737582]">
            Connect analytics and ad platforms by ID. We generate the official snippet for each one,
            so you never have to paste a script tag.
          </p>
          {!access.canManage ? (
            <p className="mt-3 rounded-lg border border-[#f4e6d8] bg-[#fffaf4] px-4 py-3 text-sm text-[#8a6134]">
              You can view these settings, but only the store owner or an admin can change them.
            </p>
          ) : null}
        </div>
        <MarketingSettingsForm
          action={updateMarketingSettingsFormAction}
          canManage={access.canManage}
          onSendGa4TestEvent={sendGa4TestEventAction}
          onSendMetaTestEvent={sendMetaTestEventAction}
          settings={settings}
        />
      </section>
    </DashboardShell>
  );
}
