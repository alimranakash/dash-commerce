import Link from "next/link";
import type { ReactNode } from "react";
import type { StorefrontStore } from "../../storefront.types";

type FashionFooterProps = {
  primaryDomain: string | undefined;
  store: StorefrontStore;
  templateId: string;
};

const fallbackDescription = "Best Swimwear is a bikini boutique, in sunny Hermosa Beach, California. A warm environment where instead of feeling self-conscious she feels secure in her own body, not limited by age, size or shape, wearing swimwear that fits and feels good.";

const aboutLinks = [
  { label: "Our blog", url: "#blog" },
  { label: "About Us", url: "#about" },
  { label: "Contact Us", url: "#contact" },
  { label: "FAQs", url: "#faqs" },
  { label: "Search", url: "/search" }
];

const shopLinks = [
  { label: "Swim Tops", url: "/products" },
  { label: "Swim Bottoms", url: "/products" },
  { label: "One Pieces", url: "/products" },
  { label: "Cover-ups", url: "/products" }
];

const legalLinks = [
  { label: "Privacy Policy", url: "#privacy-policy" },
  { label: "Shipping Policy", url: "#shipping-policy" },
  { label: "FAQs", url: "#faqs" },
  { label: "Returns Policy", url: "#returns-policy" }
];

const pressNames = ["Cosmopolitan", "Bazaar", "Vogue", "Elle"];

export function FashionStorefrontFooter({
  primaryDomain,
  store,
  templateId
}: FashionFooterProps) {
  const settings = store.setting;
  const homeHref = `/s/${store.slug}`;
  const currentYear = new Date().getFullYear();
  const brandText = store.name.trim() || "Symmetry";
  const description = settings?.tagline?.trim() || fallbackDescription;
  const socialLinks = resolveSocialLinks(settings);

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
          <Link className="fashion-footer-logo" href={homeHref}>
            {settings?.logoUrl ? <img alt={`${brandText} logo`} src={settings.logoUrl} /> : null}
            <span>{brandText}</span>
          </Link>
          <nav className="fashion-footer-socials" aria-label="Social links">
            {socialLinks.map((link) => (
              <a href={link.href} key={link.label} rel={link.external ? "noreferrer" : undefined} target={link.external ? "_blank" : undefined}>
                {link.shortLabel}
              </a>
            ))}
          </nav>
        </section>

        <FashionFooterColumn title="About">
          {aboutLinks.map((link) => (
            <Link href={resolveFooterHref(homeHref, link.url)} key={link.label}>
              {link.label}
            </Link>
          ))}
        </FashionFooterColumn>

        <FashionFooterColumn title="Shop">
          {shopLinks.map((link) => (
            <Link href={resolveFooterHref(homeHref, link.url)} key={link.label}>
              {link.label}
            </Link>
          ))}
        </FashionFooterColumn>

        <section className="fashion-footer-newsletter" aria-label="Newsletter">
          <h2>Newsletter</h2>
          <p>Be the first to know about sales, new product launches and exclusive offers!</p>
          <form action="#" aria-label="Subscribe to newsletter">
            <input name="email" placeholder="Your email" type="email" />
            <button type="button">Subscribe</button>
          </form>
        </section>
      </div>

      <div className="fashion-footer-bottom">
        <div className="fashion-footer-copyright">
          <p>
            &copy; {currentYear} {brandText}. Powered by Dash Commerce OS.
            {primaryDomain ? ` ${primaryDomain}` : ""}
          </p>
        </div>

        <div className="fashion-footer-legal">
          <div className="fashion-footer-payments" aria-label="Payment methods">
            {["Visa", "MC", "Amex", "Pay", "Disc"].map((badge) => (
              <span key={badge}>{badge}</span>
            ))}
          </div>
          <nav aria-label="Legal links">
            {legalLinks.map((link) => (
              <Link href={resolveFooterHref(homeHref, link.url)} key={link.label}>
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

function resolveSocialLinks(settings: StorefrontStore["setting"]) {
  const whatsappHref = getWhatsAppHref(settings?.whatsappNumber);
  const links = [
    settings?.facebookUrl ? { external: true, href: settings.facebookUrl, label: "Facebook", shortLabel: "f" } : null,
    { external: false, href: "#youtube", label: "YouTube", shortLabel: "yt" },
    settings?.instagramUrl ? { external: true, href: settings.instagramUrl, label: "Instagram", shortLabel: "ig" } : null,
    { external: false, href: "#tiktok", label: "TikTok", shortLabel: "tk" },
    whatsappHref ? { external: true, href: whatsappHref, label: "WhatsApp", shortLabel: "wa" } : { external: false, href: "#x", label: "X", shortLabel: "x" }
  ];

  return links.filter((link): link is { external: boolean; href: string; label: string; shortLabel: string } => Boolean(link));
}

function getWhatsAppHref(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "");

  return digits ? `https://wa.me/${digits}` : null;
}

function resolveFooterHref(homeHref: string, url: string) {
  if (url.startsWith("http") || url.startsWith("mailto:") || url.startsWith("tel:") || url.startsWith("#")) {
    return url;
  }

  return `${homeHref}${url === "/" ? "" : url.startsWith("/") ? url : `/${url}`}`;
}
