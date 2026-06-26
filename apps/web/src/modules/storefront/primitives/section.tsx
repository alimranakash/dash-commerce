import type { ReactNode } from "react";

export function StorefrontSection({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <section className="sf-foundation-section" aria-label={title}>
      {children}
    </section>
  );
}
