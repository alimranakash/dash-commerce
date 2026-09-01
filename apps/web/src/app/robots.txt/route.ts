import { NextResponse, type NextRequest } from "next/server";
import {
  MARKETING_DISALLOWED_PATHS,
  renderDisallowAllRobotsTxt,
  renderRobotsTxt,
  ROBOTS_CONTENT_TYPE,
  STOREFRONT_DISALLOWED_PATHS
} from "../../modules/seo/robots";
import { resolveSeoRequest } from "../../modules/seo/seo-request";
import { sitemapCacheHeader } from "../../modules/seo/sitemap-response";
import { SITEMAP_INDEX_PATH } from "../../modules/seo/sitemap-documents";

/**
 * `robots.txt`, per hostname — which is the only way a multi-tenant deployment
 * can have one: a single static file under `public/` would answer for the
 * marketing site, the seller app and every seller's own domain at once.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { origin, surface } = await resolveSeoRequest(request);

  if (surface.kind === "seller-app" || surface.kind === "unresolved") {
    return robotsResponse(renderDisallowAllRobotsTxt());
  }

  if (surface.kind === "marketing") {
    return robotsResponse(
      renderRobotsTxt({
        disallow: MARKETING_DISALLOWED_PATHS,
        sitemapUrl: `${origin}${SITEMAP_INDEX_PATH}`
      })
    );
  }

  return robotsResponse(
    renderRobotsTxt({
      disallow: STOREFRONT_DISALLOWED_PATHS,
      sitemapUrl: `${origin}${SITEMAP_INDEX_PATH}`
    })
  );
}

function robotsResponse(body: string) {
  return new NextResponse(body, {
    headers: {
      "Cache-Control": sitemapCacheHeader(),
      "Content-Type": ROBOTS_CONTENT_TYPE
    }
  });
}
