import type { ReactNode } from "react";

export function StorefrontCard({ children }: { children: ReactNode }) {
  return <div className="sf-foundation-card">{children}</div>;
}
