import { storefrontBasePath } from "../../base-path";
import Link from "next/link";
import type { ReactNode } from "react";
import type { StorefrontAdvancedSettings } from "../../customization";
import { resolveStorefrontHref } from "../../footer-content";
import { StorefrontCopyright } from "../../components/storefront-copyright";
import type { StorefrontSocialLink } from "../../social-links";
import type { StorefrontStore } from "../../storefront.types";

type FashionFooterProps = {
  advancedSettings?: StorefrontAdvancedSettings | null | undefined;
  primaryDomain: string | undefined;
  socialLinks: StorefrontSocialLink[];
  store: StorefrontStore;
  templateId: string;
};

export async function FashionStorefrontFooter({
  advancedSettings,
  primaryDomain,
  socialLinks,
  store,
  templateId
}: FashionFooterProps) {
  const settings = store.setting;
  const fashion = advancedSettings?.fashion;
  const footer = advancedSettings?.footer;
  const homeHref = await storefrontBasePath(store.slug);
  const brandText = store.name.trim() || "Symmetry";
  const description = footer?.description || settings?.tagline?.trim() || fashion?.footerDescription || "Best Swimwear is a bikini boutique, in sunny Hermosa Beach, California. A warm environment where instead of feeling self-conscious she feels secure in her own body, not limited by age, size or shape, wearing swimwear that fits and feels good.";
  const paymentIcons = footer?.paymentIconsEnabled ? footer.paymentIcons : [];
  const aboutLinks = fashion?.footerAboutLinks ?? [];
  const shopLinks = fashion?.footerShopLinks ?? [];
  const legalLinks = fashion?.footerLegalLinks ?? [];
  const pressNames = fashion?.footerPressLogos ?? [];

  return (
    <footer className="fashion-footer" data-storefront-footer-template={templateId}>
      <div className="fashion-footer-press" aria-label="Featured publications">
        <div className="fashion-footer-press-track">
          {[0, 1].map((group) => (
            <div aria-hidden={group === 1} className="fashion-footer-press-group" key={group}>
              {pressNames.map((name) => (
                <span className={`fashion-footer-press-${name.toLowerCase()}`} key={`${group}-${name}`}>
                  {name}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="fashion-footer-main">
        <section className="fashion-footer-brand" aria-label="Store information">
          <p>{description}</p>
          <Link className="fashion-footer-logo" href={homeHref || "/"}>
            {settings?.logoUrl ? <img alt={`${brandText} logo`} src={settings.logoUrl} /> : null}
            <span>{brandText}</span>
          </Link>
          {socialLinks.length > 0 ? (
            <nav className="fashion-footer-socials" aria-label="Social links">
              {socialLinks.map((link) => (
                <a href={link.href} key={link.label} rel="noreferrer" target="_blank">
                  {link.shortLabel}
                  <span className="sr-only">{link.label}</span>
                </a>
              ))}
            </nav>
          ) : null}
        </section>

        <FashionFooterColumn title="About">
          {aboutLinks.map((link) => (
            <Link href={resolveStorefrontHref(homeHref, link.url)} key={link.label}>
              {link.label}
            </Link>
          ))}
        </FashionFooterColumn>

        <FashionFooterColumn title="Shop">
          {shopLinks.map((link) => (
            <Link href={resolveStorefrontHref(homeHref, link.url)} key={link.label}>
              {link.label}
            </Link>
          ))}
        </FashionFooterColumn>

        <section className="fashion-footer-newsletter" aria-label="Newsletter">
          <h2>{fashion?.footerNewsletterTitle || "Newsletter"}</h2>
          <p>{fashion?.footerNewsletterDescription || "Be the first to know about sales, new product launches and exclusive offers!"}</p>
          <form action="#" aria-label="Subscribe to newsletter">
            <input name="email" placeholder="Your email" type="email" />
            <button type="button">Subscribe</button>
          </form>
        </section>
      </div>

      <div className="fashion-footer-bottom">
        <div className="fashion-footer-copyright">
          <p>
            <StorefrontCopyright
              storeName={brandText}
              template={footer?.copyrightText ?? "© {year} {store}."}
            />
            {primaryDomain ? ` ${primaryDomain}` : ""}
          </p>
        </div>

        <div className="fashion-footer-legal">
          {paymentIcons.length > 0 ? (
            <div className="fashion-footer-payments" aria-label="Payment methods">
              {paymentIcons.map((badge) => (
                <span key={badge}>{badge}</span>
              ))}
            </div>
          ) : null}
          <nav aria-label="Legal links">
            {legalLinks.map((link) => (
              <Link href={resolveStorefrontHref(homeHref, link.url)} key={link.label}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {process.env.NODE_ENV === "development" ? (
        <span className="fashion-footer-template-badge">Template: {templateId}</span>
      ) : null}
    </footer>
  );
}

function FashionFooterColumn({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="fashion-footer-column">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}

