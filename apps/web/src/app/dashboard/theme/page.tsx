import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { getMediaPickerAssets } from "../../../modules/media/media.service";
import { BrandAssetsForm } from "../../../modules/settings/components/brand-assets-form";
import { ThemeSettingsForm } from "../../../modules/settings/components/theme-settings-form";
import { updateBrandSettingsFormAction, updateThemeSettingsFormAction } from "../../../modules/settings/settings.actions";
import { getStoreSettings, getThemeSettings } from "../../../modules/settings/settings.service";
import { requireStore } from "../../../modules/stores/queries";

type ThemePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ThemePage({ searchParams }: ThemePageProps) {
  const store = await requireStore();
  const [settings, storeSettings, mediaAssets] = await Promise.all([
    getThemeSettings(store.id),
    getStoreSettings(store.id),
    getMediaPickerAssets(store.id)
  ]);
  const params = await searchParams;
  const message = params.updated ? "Theme settings updated." : params.brandingUpdated ? "Store branding updated." : null;

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Theme</p>
            <h1>Storefront theme</h1>
            <p className="auth-copy">Manage store branding, storefront hero content, and theme colors.</p>
          </div>
        </div>
        {message ? <p className="success-message">{message}</p> : null}
        <div className="dashboard-shell">
          <BrandAssetsForm action={updateBrandSettingsFormAction} mediaAssets={mediaAssets} settings={storeSettings} />
        </div>
        <div className="dashboard-shell">
          <ThemeSettingsForm
            action={updateThemeSettingsFormAction}
            mediaAssets={mediaAssets}
            settings={settings}
          />
        </div>
      </section>
    </DashboardShell>
  );
}
