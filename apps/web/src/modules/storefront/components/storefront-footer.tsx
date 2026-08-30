import { storefrontBasePath } from "../base-path";
import Link from "next/link";
import type { ReactNode } from "react";
import { hasPlanFeature } from "../../billing/subscription-limits";
import { DEFAULT_STOREFRONT_ADVANCED_SETTINGS } from "../customization";
import { getModuleSettings } from "../../settings/settings.service";
import { DEFAULT_STOREFRONT_TEMPLATE_ID } from "../templates/template-mapping";
import { ElectronicsStorefrontFooter } from "../templates/electronics-default/electronics-footer";
import { FashionStorefrontFooter } from "../templates/fashion-default/fashion-footer";
import { getStorefrontThemeSettings } from "../themes/theme.service";
import { resolveStorefrontSocialLinks } from "../social-links";
import { resolveStorefrontHref } from "../footer-content";
import { StorefrontCopyright } from "./storefront-copyright";
import type { StorefrontStore } from "../storefront.types";
import { storeSubdomain } from "../../../lib/host-routing";

type StorefrontFooterProps = {
  primaryDomain: string | undefined;
  store: StorefrontStore;
};

export async function StorefrontFooter({ primaryDomain, store }: StorefrontFooterProps) {
  const settings = store.setting;
  const homeHref = await storefrontBasePath(store.slug);
  const templateId = store.activeTemplate || DEFAULT_STOREFRONT_TEMPLATE_ID;
  const [themeSettings, moduleSettings, canBrandFooter] = await Promise.all([
    getStorefrontThemeSettings(store.id),
    getModuleSettings(store.id),
    hasPlanFeature(store.id, "footer_branding")
  ]);
  // Every template footer reads its copyright out of this object — the default
  // one below, and the two that get it as a prop — so correcting it here is
  // what makes the Free tier's credit line unconditional. It is enforced on the
  // way *out* rather than only on the way in because a store that lapses or
  // downgrades still has whatever it saved while it was paying, and that must
  // stop being served the moment the entitlement goes.
  const advancedSettings = canBrandFooter
    ? themeSettings.advancedSettings
    : {
        ...themeSettings.advancedSettings,
        footer: {
          ...themeSettings.advancedSettings.footer,
          copyrightText: DEFAULT_STOREFRONT_ADVANCED_SETTINGS.footer.copyrightText
        }
      };
  const footer = advancedSettings.footer;
  const socialLinks = footer.showSocialIcons
    ? resolveStorefrontSocialLinks(settings, moduleSettings.socialProfiles)
    : [];

  if (!footer.enabled) {
    return null;
  }

  if (templateId === "fashion-default") {
    return (
      <FashionStorefrontFooter
        advancedSettings={advancedSettings}
        primaryDomain={primaryDomain}
        socialLinks={socialLinks}
        store={store}
        templateId={templateId}
      />
    );
  }

  if (templateId === "electronics-default") {
    return (
      <ElectronicsStorefrontFooter
        advancedSettings={advancedSettings}
        primaryDomain={primaryDomain}
        socialLinks={socialLinks}
        store={store}
        templateId={templateId}
      />
    );
  }

  const description =
    footer.description ||
    settings?.tagline?.trim() ||
    "A curated online store powered by StoreIM, built for smooth shopping and modern customer service.";

  return (
    <footer className="sf-footer" data-storefront-footer-template={templateId}>
      <div className="sf-footer-grid">
        <section className="sf-footer-brand" aria-label="Store information">
          <Link className="sf-footer-logo" href={homeHref || "/"}>
            <span>
              {settings?.logoUrl ? (
                <img alt={`${store.name} logo`} src={settings.logoUrl} />
              ) : (
                store.name.slice(0, 1).toUpperCase()
              )}
            </span>
            <strong>{store.name}</strong>
          </Link>
          <p>{description}</p>
          <small>{primaryDomain ?? storeSubdomain(store.slug)}</small>
        </section>

        {footer.columns.map((column) => (
          <FooterColumn key={column.title} title={column.title}>
            {column.links.map((item) => (
              <Link href={resolveStorefrontHref(homeHref, item.url)} key={`${item.label}-${item.url}`}>
                {item.label}
              </Link>
            ))}
          </FooterColumn>
        ))}

        <FooterColumn title="Contact Info">
          {settings?.contactEmail ? (
            <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>
          ) : null}
          {settings?.contactPhone ? (
            <a href={`tel:${settings.contactPhone}`}>{settings.contactPhone}</a>
          ) : null}
          {settings?.businessAddress ? <span>{settings.businessAddress}</span> : null}
          {!settings?.contactEmail && !settings?.contactPhone && !settings?.businessAddress ? (
            <span>Contact details will appear here soon.</span>
          ) : null}
        </FooterColumn>
      </div>

      <div className="sf-footer-bottom">
        <p>
          <StorefrontCopyright storeName={store.name} template={footer.copyrightText} />
        </p>
        {footer.paymentIconsEnabled && footer.paymentIcons.length > 0 ? (
          <div className="sf-footer-payments" aria-label="Payment methods">
            {footer.paymentIcons.map((icon) => (
              <span key={icon}>{icon}</span>
            ))}
          </div>
        ) : null}
        {socialLinks.length > 0 ? (
          <nav className="sf-footer-socials" aria-label="Social links">
            {socialLinks.map((link) => (
              <a href={link.href} key={link.label} rel="noreferrer" target="_blank">
                {link.label}
              </a>
            ))}
          </nav>
        ) : null}
        {process.env.NODE_ENV === "development" ? (
          <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-500">
            Template: {templateId}
          </span>
        ) : null}
      </div>
    </footer>
  );
}

function FooterColumn({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="sf-footer-column">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}
