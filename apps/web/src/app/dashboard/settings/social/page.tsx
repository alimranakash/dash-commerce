import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { SocialSettingsForm } from "../../../../modules/settings/components/social-settings-form";
import { requireStore } from "../../../../modules/stores/queries";

export default async function SocialSettingsPage() {
  const store = await requireStore();
  const appUrl = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <div>
          <h1 className="m-0 text-[1.65rem] font-semibold leading-tight">Social Login &amp; Social Media Settings</h1>
          <p className="mt-2 text-sm text-[#737582]">Configure social login providers and social profile links for your store.</p>
        </div>
        <SocialSettingsForm redirectBaseUrl={appUrl} />
      </section>
    </DashboardShell>
  );
}
