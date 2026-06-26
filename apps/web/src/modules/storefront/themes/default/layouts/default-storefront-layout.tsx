import type { ReactNode } from "react";
import type { StorefrontStore } from "../../../storefront.types";
import { StorefrontContainer } from "../../../primitives/container";

export function DefaultStorefrontLayout({ children, store }: { children: ReactNode; store: StorefrontStore }) {
  return (
    <div className="sf-page sf-foundation-layout" data-theme="default">
      <header className="sf-foundation-header">
        <StorefrontContainer>
          <span>{store.name}</span>
          <small>Header placeholder</small>
        </StorefrontContainer>
      </header>
      <main>{children}</main>
      <footer className="sf-foundation-footer">
        <StorefrontContainer>
          <span>{store.name}</span>
          <small>Footer placeholder</small>
        </StorefrontContainer>
      </footer>
    </div>
  );
}
