import Link from "next/link";
import type { ReactNode } from "react";
import { DEFAULT_STOREFRONT_TEMPLATE_ID } from "../templates/template-mapping";
import { ElectronicsStorefrontFooter } from "../templates/electronics-default/electronics-footer";
import { FashionStorefrontFooter } from "../templates/fashion-default/fashion-footer";
import type { StorefrontStore } from "../storefront.types";

type StorefrontFooterProps = {
  primaryDomain: string | undefined;
  store: StorefrontStore;
};

export function StorefrontFooter({ primaryDomain, store }: StorefrontFooterProps) {
  const settings = store.setting;
  const homeHref = `/s/${store.slug}`;
  const currentYear = new Date().getFullYear();
  const templateId = store.activeTemplate || DEFAULT_STOREFRONT_TEMPLATE_ID;
  const whatsappHref = getWhatsAppHref(settings?.whatsappNumber);
  const socialLinks = [
    settings?.facebookUrl ? { href: settings.facebookUrl, label: "Facebook" } : null,
    settings?.instagramUrl ? { href: settings.instagramUrl, label: "Instagram" } : null,
    whatsappHref ? { href: whatsappHref, label: "WhatsApp" } : null
  ].filter((link): link is { href: string; label: string } => Boolean(link));

  if (templateId === "fashion-default") {
    return <FashionStorefrontFooter primaryDomain={primaryDomain} store={store} templateId={templateId} />;
  }

  if (templateId === "electronics-default") {
    return <ElectronicsStorefrontFooter primaryDomain={primaryDomain} store={store} templateId={templateId} />;
  }

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
          <p>
            A curated online store powered by Dash Commerce OS, built for smooth shopping and modern
            customer service.
          </p>
          <small>{primaryDomain ?? `${store.slug}.dash.com`}</small>
        </section>

        <FooterColumn title="Quick Links">
          <Link href={homeHref}>Home</Link>
          <Link href={`${homeHref}/products`}>Shop</Link>
          <Link href={`${homeHref}/categories`}>Categories</Link>
          {settings?.contactEmail ? (
            <a href={`mailto:${settings.contactEmail}`}>Contact</a>
          ) : (
            <a href="#contact">Contact</a>
          )}
        </FooterColumn>

        <FooterColumn title="Customer Support">
          <Link href={`${homeHref}/orders`}>Track Order</Link>
          <a href="#return-policy">Return Policy</a>
          <a href="#shipping-info">Shipping Info</a>
          <a href="#privacy-policy">Privacy Policy</a>
        </FooterColumn>

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
          © {currentYear} {store.name}. Powered by Dash Commerce OS.
        </p>
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

function getWhatsAppHref(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "");

  return digits ? `https://wa.me/${digits}` : null;
}
