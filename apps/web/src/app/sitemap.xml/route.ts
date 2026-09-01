import { NextResponse, type NextRequest } from "next/server";
import { resolveSeoRequest } from "../../modules/seo/seo-request";
import { buildMarketingSitemapDocument } from "../../modules/seo/sitemap-documents";
import { sitemapCacheHeader } from "../../modules/seo/sitemap-response";
import { buildStorefrontSitemapIndex } from "../../modules/seo/sitemap.service";
import { SITEMAP_CONTENT_TYPE } from "../../modules/seo/sitemap-xml";

/**
 * `/sitemap.xml`, on every hostname this server answers on.
 *
 * A route handler rather than Next's `app/sitemap.ts` convention because the
 * answer depends on the request's `Host`: one file has to serve the marketing
 * site's handful of pages and any one of the tenant storefronts, and the
 * metadata convention has no request to read.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { origin, surface } = await resolveSeoRequest(request);

  if (surface.kind === "marketing") {
    return sitemapResponse(buildMarketingSitemapDocument(origin));
  }

  // The seller app is a private application and an unknown host serves no
  // store, so neither has anything to submit; `robots.txt` disallows both for
  // the same reason.
  if (surface.kind !== "storefront") {
    return new NextResponse("Not found", {
      status: 404
    });
  }

  return sitemapResponse(
    await buildStorefrontSitemapIndex({
      origin,
      storeId: surface.store.id
    })
  );
}

function sitemapResponse(body: string) {
  return new NextResponse(body, {
    headers: {
      "Cache-Control": sitemapCacheHeader(),
      "Content-Type": SITEMAP_CONTENT_TYPE
    }
  });
}
