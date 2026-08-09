import type { ReactNode } from "react";
import { ScrollToTopButton } from "../../../modules/storefront/components/scroll-to-top-button";

// The custom-domain surface has no shared shell of its own — each page renders its
// own theme scope — so this layout exists purely to give it the same single
// floating scroll-to-top button the `[slug]` surface gets.
export default function StorefrontDomainLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ScrollToTopButton />
    </>
  );
}
