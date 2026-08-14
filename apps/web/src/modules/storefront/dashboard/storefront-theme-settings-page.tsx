import Link from "next/link";
import { BrandAssetsForm } from "../../settings/components/brand-assets-form";
import { ThemeSettingsForm } from "../../settings/components/theme-settings-form";
import {
  updateBrandSettingsFormAction,
  updateThemeSettingsFormAction
} from "../../settings/settings.actions";
import { getStoreSettings, getThemeSettings } from "../../settings/settings.service";
import { StorefrontTemplateLibrary } from "../templates/components/storefront-template-library";
import { StorefrontTemplatePreviewCard } from "../templates/components/storefront-template-preview-card";
import { getAvailableStorefrontTemplates, getStorefrontTemplateForStore } from "../templates/registry";
import { getStoreActiveTemplate } from "../templates/template-store";
import { StorefrontSettingsToast } from "./storefront-settings-toast";

type StorefrontThemeSettingsPageProps = {
  searchParams: Record<string, string | string[] | undefined>;
  store: {
    businessType?: string | null;
    id: string;
    slug: string;
  };
};

const storefrontSections = [
  { href: "#current-template", label: "Current Template" },
  { href: "#template-library", label: "Template Library" },
  { href: "#branding", label: "Branding" },
  { href: "#theme-settings", label: "Customize" },
  { href: "#announcement-bar", label: "Announcement Bar" },
  { href: "#header", label: "Header" },
  { href: "#hero-section", label: "Hero Section" },
  { href: "#colors-layout", label: "Colors & Layout" },
  { href: "#tabbed-product-showcase", label: "Tabbed Showcase" },
  { href: "#shop-collection-page", label: "Pages" },
  { href: "#footer", label: "Footer" },
  { href: "#cart-page", label: "Cart" },
  { href: "#mini-cart-drawer", label: "Mini Cart" },
  { href: "#product-sections", label: "Product Sections" },
  { href: "#fashion-homepage", label: "Fashion Homepage" },
  { href: "#electronics-homepage", label: "Electronics Homepage" },
  { href: "#product-page", label: "Product Page" }
];

function getSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function StorefrontThemeSettingsPage({
  searchParams,
  store
}: StorefrontThemeSettingsPageProps) {
  const [settings, storeSettings, activeTemplate] = await Promise.all([
    getThemeSettings(store.id),
    getStoreSettings(store.id),
    getStoreActiveTemplate(store.id)
  ]);
  const updated = getSearchParamValue(searchParams.updated);
  const brandingUpdated = getSearchParamValue(searchParams.brandingUpdated);
  const toastId = getSearchParamValue(searchParams.toast);
  const message = updated ? "Theme settings updated." : brandingUpdated ? "Store branding updated." : null;
  const messageKey = toastId ?? updated ?? brandingUpdated ?? null;
  const storefrontPreviewUrl = `/s/${store.slug}`;
  // Both panels resolve the active template exactly the way the storefront does,
  // so "Current active" in the dashboard can never disagree with what renders.
  const activeTemplateId = getStorefrontTemplateForStore({
    activeTemplate,
    businessType: store.businessType ?? null
  }).id;
  const templates = getAvailableStorefrontTemplates().map((template) => ({
    businessType: template.businessType,
    colors: template.defaultColors,
    description: template.description,
    id: template.id,
    name: template.name,
    sections: template.homepageSections as string[]
  }));

  return (
    <section className="resource-page storefront-settings-page">
      <div className="resource-header storefront-settings-hero">
        <div>
          <p className="eyebrow">Storefront</p>
          <h1>Storefront themes</h1>
          <p className="auth-copy">
            Manage templates, branding, homepage, header, hero, colors, pages, and storefront behavior.
          </p>
        </div>
        <Link className="storefront-preview-button" href={storefrontPreviewUrl} rel="noreferrer" target="_blank">
          View Storefront
        </Link>
      </div>

      <StorefrontSettingsToast message={message} messageKey={messageKey} type="success" />

      <div className="storefront-settings-layout">
        <aside className="storefront-settings-sidebar" aria-label="Storefront settings sections">
          <strong>Storefront</strong>
          <nav>
            {storefrontSections.map((section) => (
              <a href={section.href} key={section.href}>
                {section.label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="storefront-settings-content">
          <div id="current-template" className="storefront-settings-section">
            <StorefrontTemplatePreviewCard
              activeTemplate={activeTemplate}
              businessType={store.businessType ?? null}
              resolvedTemplateId={activeTemplateId}
              storeSlug={store.slug}
            />
          </div>

          <div id="template-library" className="storefront-settings-section">
            <StorefrontTemplateLibrary
              activeTemplateId={activeTemplateId}
              storefrontPreviewUrl={storefrontPreviewUrl}
              templates={templates}
            />
          </div>

          <div id="branding" className="storefront-settings-section">
            <BrandAssetsForm action={updateBrandSettingsFormAction} settings={storeSettings} />
          </div>

          <div id="theme-settings" className="storefront-settings-section">
            <ThemeSettingsForm action={updateThemeSettingsFormAction} settings={settings} />
          </div>

          <section id="footer-social-preview" className="storefront-settings-info-card storefront-settings-section">
            <div>
              <p className="eyebrow">Footer</p>
              <h2>Footer contact & social sources</h2>
              <p>
                Footer columns, payment icons, description, and copyright live in the Footer panel above. The contact block and the
                social icon targets come from your store branding, contact details, and social profile links.
              </p>
            </div>
            <div className="storefront-settings-info-links">
              <Link href="/dashboard/settings/general">General Settings</Link>
              <Link href="/dashboard/settings/social">Social Links</Link>
              <Link href="/dashboard/media">Media Library</Link>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
