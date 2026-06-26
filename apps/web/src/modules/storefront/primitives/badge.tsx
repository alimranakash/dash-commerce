import type { ReactNode } from "react";

export function StorefrontBadge({ children }: { children: ReactNode }) {
  return <span className="sf-foundation-badge">{children}</span>;
}
