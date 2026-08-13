import type { Metadata } from "next";
import type { ReactNode } from "react";
import { MarketingTags } from "../../../modules/marketing/components/marketing-tags";
import {
  getMarketingMetaTags,
  getMarketingTagPlan
} from "../../../modules/marketing/marketing.service";
import { ScrollToTopButton } from "../../../modules/storefront/components/scroll-to-top-button";
import { getStorefrontByDomain } from "../../../modules/storefront/resolver";

type StorefrontDomainLayoutProps = {
  children: ReactNode;
  params: Promise<{
    domain: string;
  }>;
};

// This surface had no metadata of its own; it exists here so a store on a custom
// domain gets the same verification tags as the `<slug>.dash.com` one — domain
// verification is precisely the thing a custom domain needs.
export async function generateMetadata({
  params
}: StorefrontDomainLayoutProps): Promise<Metadata> {
  const { domain } = await params;
  const store = await getStorefrontByDomain(decodeURIComponent(domain));

  if (!store) {
    return {};
  }

  const verification = await getMarketingMetaTags(store.id);

  return verification ? { other: verification } : {};
}

// The custom-domain surface has no shared shell of its own — each page renders its
// own theme scope — so this layout exists to give it the same single floating
// scroll-to-top button the `[slug]` surface gets, plus its marketing tags.
export default async function StorefrontDomainLayout({
  children,
  params
}: StorefrontDomainLayoutProps) {
  const { domain } = await params;
  const store = await getStorefrontByDomain(decodeURIComponent(domain));
  const marketing = store ? await getMarketingTagPlan(store.id) : null;

  return (
    <>
      {marketing ? (
        <>
          <MarketingTags tags={marketing.head} />
          <MarketingTags tags={marketing.bodyStart} />
        </>
      ) : null}
      {children}
      <ScrollToTopButton />
      {marketing ? <MarketingTags tags={marketing.bodyEnd} /> : null}
    </>
  );
}
