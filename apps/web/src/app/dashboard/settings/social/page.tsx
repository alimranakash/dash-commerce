import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { SocialSettingsForm } from "../../../../modules/settings/components/social-settings-form";
import { StoreSocialProfilesForm } from "../../../../modules/settings/components/store-social-profiles-form";
import { updateSocialProfilesFormAction } from "../../../../modules/settings/settings.actions";
import { getStoreSettings } from "../../../../modules/settings/settings.service";
import { requireStore } from "../../../../modules/stores/queries";

export default async function SocialSettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const store = await requireStore();
  const settings = await getStoreSettings(store.id);
  const params = await searchParams;
  const appUrl = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <div>
          <h1 className="m-0 text-[1.65rem] font-semibold leading-tight">Social Login &amp; Social Media Settings</h1>
          <p className="mt-2 text-sm text-[#737582]">Configure social login providers and social profile links for your store.</p>
        </div>
        {params.updated ? <p className="success-message">Social profiles updated.</p> : null}
        <SocialSettingsForm redirectBaseUrl={appUrl} />
        <div className="dashboard-shell"><StoreSocialProfilesForm action={updateSocialProfilesFormAction} settings={settings} /></div>
      </section>
    </DashboardShell>
  );
}
