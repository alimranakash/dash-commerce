import Link from "next/link";
import type { ReactNode } from "react";
import type { StorefrontStore } from "../../storefront.types";
import { normalizeAdvancedSettings, type StorefrontAdvancedSettings } from "../../customization";
import { resolveStorefrontCopyright, resolveStorefrontHref } from "../../footer-content";
import type { StorefrontSocialLink } from "../../social-links";
import styles from "./electronics-footer.module.css";

type ElectronicsFooterProps = {
  advancedSettings?: StorefrontAdvancedSettings;
  primaryDomain: string | undefined;
  socialLinks: StorefrontSocialLink[];
  store: StorefrontStore;
  templateId: string;
};

export function ElectronicsStorefrontFooter({
  advancedSettings,
  primaryDomain,
  socialLinks,
  store,
  templateId
}: ElectronicsFooterProps) {
  const settings = store.setting;
  const advanced = normalizeAdvancedSettings(advancedSettings);
  const electronics = advanced.electronics;
  const footer = advanced.footer;
  const homeHref = `/s/${store.slug}`;
  const brandName = store.name.trim() || "Atlas";
  const description = footer.description || settings?.tagline?.trim() || "Your destination for modern tech built for everyday living.";
  const paymentIcons = footer.paymentIconsEnabled ? footer.paymentIcons : [];

  return (
    <footer className={styles.footer} data-storefront-footer-template={templateId}>
      <div className={styles.main}>
        <section className={styles.brand} aria-label="Store information">
          <Link className={styles.logo} href={homeHref}>
            {settings?.logoUrl ? <img alt={`${brandName} logo`} src={settings.logoUrl} /> : brandName}
          </Link>
          <p className={styles.description}>{description}</p>
          {socialLinks.length > 0 ? (
            <nav className={styles.socials} aria-label="Social links">
              {socialLinks.map((link) => (
                <a href={link.href} key={link.label} rel="noreferrer" target="_blank">
                  {link.shortLabel}
                  <span className="sr-only">{link.label}</span>
                </a>
              ))}
            </nav>
          ) : null}
        </section>

        <ElectronicsFooterColumn title="Collections">
          {electronics.footerCollectionLinks.map((link) => (
            <Link href={resolveStorefrontHref(homeHref, link.url)} key={link.label}>
              {link.label}
            </Link>
          ))}
        </ElectronicsFooterColumn>

        <ElectronicsFooterColumn title="Information">
          {electronics.footerInformationLinks.map((link) => (
            <Link href={resolveStorefrontHref(homeHref, link.url)} key={link.label}>
              {link.label}
            </Link>
          ))}
        </ElectronicsFooterColumn>

        <section className={styles.newsletter} aria-label="Newsletter">
          <h2>{electronics.newsletterTitle}</h2>
          <p>{electronics.newsletterDescription}</p>
          <form action="#" aria-label="Subscribe to newsletter">
            <input name="email" placeholder="Email" type="email" />
            <button type="button">Subscribe</button>
          </form>
        </section>
      </div>

      <div className={styles.bottom}>
        <div className={styles.bottomInner}>
          {paymentIcons.length > 0 ? (
            <div className={styles.payments} aria-label="Payment methods">
              {paymentIcons.map((badge) => (
                <span key={badge}>{badge}</span>
              ))}
            </div>
          ) : null}
          <p className={styles.copyright}>
            {resolveStorefrontCopyright(footer.copyrightText, brandName)}
            {primaryDomain ? ` | ${primaryDomain}` : ""}
          </p>
        </div>
      </div>
    </footer>
  );
}

function ElectronicsFooterColumn({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className={styles.column}>
      <h2>{title}</h2>
      <div className={styles.links}>{children}</div>
    </section>
  );
}

