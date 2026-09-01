import { NextResponse, type NextRequest } from "next/server";
import { resolveSeoRequest } from "../../../modules/seo/seo-request";
import { parseSitemapSection } from "../../../modules/seo/sitemap-documents";
import { sitemapCacheHeader } from "../../../modules/seo/sitemap-response";
import { buildStorefrontSitemapSection } from "../../../modules/seo/sitemap.service";
import { SITEMAP_CONTENT_TYPE } from "../../../modules/seo/sitemap-xml";

/**
 * The documents `/sitemap.xml` indexes: `/sitemap/pages.xml`,
 * `/sitemap/categories.xml`, `/sitemap/products-1.xml` and its successors.
 *
 * Storefront-only. The marketing sitemap is small enough to be a single
 * `<urlset>`, so it indexes nothing and these addresses 404 there.
 */
export const dynamic = "force-dynamic";

type SitemapSectionRouteContext = {
  params: Promise<{
    section: string;
  }>;
};

export async function GET(request: NextRequest, context: SitemapSectionRouteContext) {
  const [{ section: sectionName }, { origin, surface }] = await Promise.all([
    context.params,
    resolveSeoRequest(request)
  ]);

  if (surface.kind !== "storefront") {
    return notFoundResponse();
  }

  const section = parseSitemapSection(sectionName);

  if (!section) {
    return notFoundResponse();
  }

  const body = await buildStorefrontSitemapSection({
    origin,
    section,
    store: surface.store
  });

  // An empty section is a 404 rather than an empty document: a crawler that
  // followed a stale index entry should be told the page is gone, not handed a
  // sitemap asserting this store has no products.
  if (!body) {
    return notFoundResponse();
  }

  return new NextResponse(body, {
    headers: {
      "Cache-Control": sitemapCacheHeader(),
      "Content-Type": SITEMAP_CONTENT_TYPE
    }
  });
}

function notFoundResponse() {
  return new NextResponse("Not found", {
    status: 404
  });
}
