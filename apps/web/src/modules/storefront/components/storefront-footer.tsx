import Link from "next/link";
import type { ReactNode } from "react";
import { getModuleSettings } from "../../settings/settings.service";
import { DEFAULT_STOREFRONT_TEMPLATE_ID } from "../templates/template-mapping";
import { ElectronicsStorefrontFooter } from "../templates/electronics-default/electronics-footer";
import { FashionStorefrontFooter } from "../templates/fashion-default/fashion-footer";
import { getStorefrontThemeSettings } from "../themes/theme.service";
import { resolveStorefrontSocialLinks } from "../social-links";
import { resolveStorefrontHref, resolveStorefrontCopyright } from "../footer-content";
import type { StorefrontStore } from "../storefront.types";

type StorefrontFooterProps = {
  primaryDomain: string | undefined;
  store: StorefrontStore;
};

export async function StorefrontFooter({ primaryDomain, store }: StorefrontFooterProps) {
  const settings = store.setting;
  const homeHref = `/s/${store.slug}`;
  const templateId = store.activeTemplate || DEFAULT_STOREFRONT_TEMPLATE_ID;
  const [themeSettings, moduleSettings] = await Promise.all([
    getStorefrontThemeSettings(store.id),
    getModuleSettings(store.id)
  ]);
  const footer = themeSettings.advancedSettings.footer;
  const socialLinks = footer.showSocialIcons
    ? resolveStorefrontSocialLinks(settings, moduleSettings.socialProfiles)
    : [];

  if (!footer.enabled) {
    return null;
  }

  if (templateId === "fashion-default") {
    return (
      <FashionStorefrontFooter
        advancedSettings={themeSettings.advancedSettings}
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
        advancedSettings={themeSettings.advancedSettings}
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
    "A curated online store powered by Dash Commerce OS, built for smooth shopping and modern customer service.";

  return (
    <footer className="sf-footer" data-storefront-footer-template={templateId}>
      <div className="sf-footer-grid">
        <section className="sf-footer-brand" aria-label="Store information">
          <Link className="sf-footer-logo" href={homeHref}>
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
          <small>{primaryDomain ?? `${store.slug}.dash.com`}</small>
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
        <p>{resolveStorefrontCopyright(footer.copyrightText, store.name)}</p>
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
