"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * The storefront's link prefix, for client components.
 *
 * Server components call `storefrontBasePath()` directly; that reads the request
 * `Host`, which the browser bundle has no access to. Rather than thread the
 * result through every card, slider and drawer, the storefront layout publishes
 * it once here.
 *
 * Empty string is the right default: it is what a storefront hostname wants, so
 * a component rendered outside the provider still links somewhere sane.
 */
const StorefrontBasePathContext = createContext("");

export function StorefrontBasePathProvider({
  children,
  value
}: {
  children: ReactNode;
  value: string;
}) {
  return (
    <StorefrontBasePathContext.Provider value={value}>
      {children}
    </StorefrontBasePathContext.Provider>
  );
}

export function useStorefrontBasePath() {
  return useContext(StorefrontBasePathContext);
}
