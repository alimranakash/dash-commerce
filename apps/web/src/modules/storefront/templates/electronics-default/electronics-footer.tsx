import Link from "next/link";
import type { ReactNode } from "react";
import type { StorefrontStore } from "../../storefront.types";
import { normalizeAdvancedSettings, type StorefrontAdvancedSettings } from "../../customization";
import styles from "./electronics-footer.module.css";

type ElectronicsFooterProps = {
  advancedSettings?: StorefrontAdvancedSettings;
  primaryDomain: string | undefined;
  store: StorefrontStore;
  templateId: string;
};

const paymentBadges = ["Visa", "MC", "Amex", "Pay", "Diners", "Disc"];

export function ElectronicsStorefrontFooter({
  advancedSettings,
  primaryDomain,
  store,
  templateId
}: ElectronicsFooterProps) {
  const settings = store.setting;
  const advanced = normalizeAdvancedSettings(advancedSettings);
  const electronics = advanced.electronics;
  const homeHref = `/s/${store.slug}`;
  const currentYear = new Date().getFullYear();
  const brandName = store.name.trim() || "Atlas";
  const description = settings?.tagline?.trim() || "Your destination for modern tech built for everyday living.";
  const socialLinks = resolveSocialLinks(settings);

  return (
    <footer className={styles.footer} data-storefront-footer-template={templateId}>
      <div className={styles.main}>
        <section className={styles.brand} aria-label="Store information">
          <Link className={styles.logo} href={homeHref}>
            {settings?.logoUrl ? <img alt={`${brandName} logo`} src={settings.logoUrl} /> : brandName}
          </Link>
          <p className={styles.description}>{description}</p>
          <nav className={styles.socials} aria-label="Social links">
            {socialLinks.map((link) => (
              <a href={link.href} key={link.label} rel={link.external ? "noreferrer" : undefined} target={link.external ? "_blank" : undefined}>
                {link.shortLabel}
                <span className="sr-only">{link.label}</span>
              </a>
            ))}
          </nav>
        </section>

        <ElectronicsFooterColumn title="Collections">
          {electronics.footerCollectionLinks.map((link) => (
            <Link href={resolveFooterHref(homeHref, link.url)} key={link.label}>
              {link.label}
            </Link>
          ))}
        </ElectronicsFooterColumn>

        <ElectronicsFooterColumn title="Information">
          {electronics.footerInformationLinks.map((link) => (
            <Link href={resolveFooterHref(homeHref, link.url)} key={link.label}>
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
          <div className={styles.payments} aria-label="Payment methods">
            {paymentBadges.map((badge) => (
              <span key={badge}>{badge}</span>
            ))}
          </div>
          <p className={styles.copyright}>
            &copy; {currentYear} {brandName} {primaryDomain ? ` | ${primaryDomain}` : ""} | Powered by Dash Commerce OS
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

function resolveSocialLinks(settings: StorefrontStore["setting"]) {
  return [
    settings?.facebookUrl ? {
      external: true,
      href: settings.facebookUrl,
      label: "Facebook",
      shortLabel: "f"
    } : {
      external: false,
      href: "#facebook",
      label: "Facebook",
      shortLabel: "f"
    },
    settings?.instagramUrl ? {
      external: true,
      href: settings.instagramUrl,
      label: "Instagram",
      shortLabel: "ig"
    } : {
      external: false,
      href: "#instagram",
      label: "Instagram",
      shortLabel: "ig"
    },
    {
      external: false,
      href: "#youtube",
      label: "YouTube",
      shortLabel: "yt"
    }
  ];
}

function resolveFooterHref(homeHref: string, url: string) {
  if (url.startsWith("http") || url.startsWith("mailto:") || url.startsWith("tel:") || url.startsWith("#")) {
    return url;
  }

  return `${homeHref}${url === "/" ? "" : url.startsWith("/") ? url : `/${url}`}`;
}
