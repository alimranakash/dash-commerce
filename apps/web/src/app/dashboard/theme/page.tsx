import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { ThemeSettingsForm } from "../../../modules/settings/components/theme-settings-form";
import { updateThemeSettingsFormAction } from "../../../modules/settings/settings.actions";
import { getThemeSettings } from "../../../modules/settings/settings.service";
import { requireStore } from "../../../modules/stores/queries";

type ThemePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ThemePage({ searchParams }: ThemePageProps) {
  const store = await requireStore();
  const settings = await getThemeSettings(store.id);
  const message = (await searchParams).updated ? "Theme settings updated." : null;

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Theme</p>
            <h1>Storefront theme</h1>
            <p className="auth-copy">Customize the public storefront hero, announcement, and colors.</p>
          </div>
        </div>
        {message ? <p className="success-message">{message}</p> : null}
        <div className="dashboard-shell">
          <ThemeSettingsForm action={updateThemeSettingsFormAction} settings={settings} />
        </div>
      </section>
    </DashboardShell>
  );
}
