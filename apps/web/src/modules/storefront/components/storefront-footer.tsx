import type { StorefrontStore } from "../storefront.types";

type StorefrontFooterProps = {
  primaryDomain: string | undefined;
  store: StorefrontStore;
};

export function StorefrontFooter({ primaryDomain, store }: StorefrontFooterProps) {
  const settings = store.setting;

  return (
    <footer className="sf-footer">
      <div>
        <strong>{store.name}</strong>
        <span>{primaryDomain ?? `${store.slug}.dash.com`}</span>
        {settings?.businessAddress ? <span>{settings.businessAddress}</span> : null}
      </div>
      <div className="sf-footer-links">
        {settings?.contactEmail ? <a href={`mailto:${settings.contactEmail}`}>Email</a> : null}
        {settings?.contactPhone ? <a href={`tel:${settings.contactPhone}`}>Call</a> : null}
        {settings?.whatsappNumber ? (
          <a href={`https://wa.me/${settings.whatsappNumber.replace(/\D/g, "")}`}>WhatsApp</a>
        ) : null}
        {settings?.facebookUrl ? <a href={settings.facebookUrl}>Facebook</a> : null}
        {settings?.instagramUrl ? <a href={settings.instagramUrl}>Instagram</a> : null}
      </div>
      <p>Powered by Dash Commerce OS</p>
    </footer>
  );
}
