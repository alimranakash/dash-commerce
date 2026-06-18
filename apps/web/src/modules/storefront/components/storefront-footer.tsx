import type { StorefrontStore } from "../storefront.types";

type StorefrontFooterProps = {
  primaryDomain: string | undefined;
  store: StorefrontStore;
};

export function StorefrontFooter({ primaryDomain, store }: StorefrontFooterProps) {
  return (
    <footer className="sf-footer">
      <div>
        <strong>{store.name}</strong>
        <span>{primaryDomain ?? `${store.slug}.dash.com`}</span>
      </div>
      <p>Powered by Dash Commerce OS</p>
    </footer>
  );
}
