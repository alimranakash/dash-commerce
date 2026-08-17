import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { DomainSettings } from "../../../../modules/domains/components/domain-settings";
import {
  addCustomDomainAction,
  removeCustomDomainAction,
  setPrimaryDomainAction,
  verifyCustomDomainAction
} from "../../../../modules/domains/domains.actions";
import { getStoreDomainsView } from "../../../../modules/domains/domains.service";
import { getStoreAccess } from "../../../../modules/stores/queries";

export default async function DomainSettingsPage() {
  const access = await getStoreAccess();
  // No platform-admin bypass here: this is the seller dashboard, so the store's
  // own plan decides, exactly as the write path does.
  const view = await getStoreDomainsView({
    storeId: access.store.id
  });

  return (
    <DashboardShell storeSlug={access.store.slug}>
      <section className="resource-page max-w-none">
        <div>
          <h1 className="m-0 text-[1.65rem] font-semibold leading-tight">Domains</h1>
          <p className="mt-2 text-sm text-[#737582]">
            Point a domain you own at your storefront, so customers see your own address instead of
            the built-in one. Nothing else changes — your dashboard and orders stay exactly where
            they are.
          </p>
          {!access.canManage ? (
            <p className="mt-3 rounded-lg border border-[#f4e6d8] bg-[#fffaf4] px-4 py-3 text-sm text-[#8a6134]">
              You can view these settings, but only the store owner or an admin can change them.
            </p>
          ) : null}
        </div>
        <DomainSettings
          addAction={addCustomDomainAction}
          canManage={access.canManage}
          removeAction={removeCustomDomainAction}
          setPrimaryAction={setPrimaryDomainAction}
          verifyAction={verifyCustomDomainAction}
          view={view}
        />
      </section>
    </DashboardShell>
  );
}
