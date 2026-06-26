import type { ReactNode } from "react";

export function StorefrontContainer({ children }: { children: ReactNode }) {
  return <div className="sf-container">{children}</div>;
}
