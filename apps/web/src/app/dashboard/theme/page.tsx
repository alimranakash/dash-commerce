import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { getMediaPickerAssets } from "../../../modules/media/media.service";
import { BrandAssetsForm } from "../../../modules/settings/components/brand-assets-form";
import { ThemeSettingsForm } from "../../../modules/settings/components/theme-settings-form";
import { updateBrandSettingsFormAction, updateThemeSettingsFormAction } from "../../../modules/settings/settings.actions";
import { getStoreSettings, getThemeSettings } from "../../../modules/settings/settings.service";
import { requireStore } from "../../../modules/stores/queries";
import { StorefrontTemplateLibrary } from "../../../modules/storefront/templates/components/storefront-template-library";
import { StorefrontTemplatePreviewCard } from "../../../modules/storefront/templates/components/storefront-template-preview-card";
import { getAvailableStorefrontTemplates } from "../../../modules/storefront/templates/registry";
import { DEFAULT_STOREFRONT_TEMPLATE_ID } from "../../../modules/storefront/templates/template-mapping";
import { getStoreActiveTemplate } from "../../../modules/storefront/templates/template-store";

type ThemePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ThemePage({ searchParams }: ThemePageProps) {
  const store = await requireStore();
  const [settings, storeSettings, mediaAssets, activeTemplate] = await Promise.all([
    getThemeSettings(store.id),
    getStoreSettings(store.id),
    getMediaPickerAssets(store.id),
    getStoreActiveTemplate(store.id)
  ]);
  const params = await searchParams;
  const message = params.updated ? "Theme settings updated." : params.brandingUpdated ? "Store branding updated." : null;
  const storefrontPreviewUrl = `/s/${store.slug}`;
  const activeTemplateId = activeTemplate || DEFAULT_STOREFRONT_TEMPLATE_ID;
  const templates = getAvailableStorefrontTemplates().map((template) => ({
    businessType: template.businessType,
    description: template.description,
    id: template.id,
    name: template.name,
    previewImage: template.previewImage
  }));

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
          <StorefrontTemplatePreviewCard
            activeTemplate={activeTemplate}
            businessType={store.businessType}
            storeSlug={store.slug}
          />
        </div>
        <div className="dashboard-shell">
          <StorefrontTemplateLibrary
            activeTemplateId={activeTemplateId}
            storefrontPreviewUrl={storefrontPreviewUrl}
            templates={templates}
          />
        </div>
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
