import type { NextRequest } from "next/server";
import { resolveStoreFromHost } from "../../lib/host-routing";
import { storefrontRequestOrigin } from "../storefront/base-path";
import { getStorefrontByDomain, getStorefrontBySlug } from "../storefront/resolver";
import type { SitemapStore } from "./sitemap.service";

/**
 * Which of the four surfaces asked for a `robots.txt` or a sitemap.
 *
 * These routes resolve the host themselves rather than being rewritten into a
 * store's tree like every other storefront page, because `proxy.ts` skips any
 * path with a file extension — `/robots.txt` and `/sitemap.xml` reach Next
 * exactly as the browser asked for them. That is the behaviour we want: one
 * address per hostname, answering for whatever store that hostname serves.
 *
 * The store lookups are the storefront's own, so a hostname that would not
 * render a shop does not get a sitemap for one either — an unverified custom
 * domain resolves to nothing here for the same reason it renders nothing there.
 *
 * There is no separate indexable flag, and the absence is deliberate. `DRAFT`
 * is the status every store is created with, and nothing a seller can reach
 * ever changes it — only a platform admin can, through
 * `updateAdminStoreStatus`. So DRAFT does not mean unlaunched here: it is the
 * ordinary state of a live shop with a domain, a checkout and real orders,
 * which `getStorefrontBySlug` serves to shoppers exactly like an ACTIVE one.
 * Gating on ACTIVE would have shipped a sitemap that 404s for almost every
 * real store. Servable and indexable are one question, answered by the
 * storefront: SUSPENDED and ARCHIVED stores do not resolve here at all, so
 * they fall through to `unresolved` and are disallowed.
 */

export type SeoSurface =
  | {
      kind: "marketing";
    }
  | {
      kind: "seller-app";
    }
  | {
      kind: "storefront";
      store: SitemapStore;
    }
  | {
      kind: "unresolved";
    };

export type SeoRequestContext = {
  /**
   * The origin the crawler actually asked for, not the store's canonical one.
   *
   * A sitemap may only list URLs beneath its own location — Search Console
   * rejects the rest as "URL not allowed" — so a sitemap served on the
   * subdomain lists subdomain URLs even when the seller's custom domain is
   * primary. The canonical tag on each of those pages, which does point at the
   * primary domain, is what merges the two.
   */
  origin: string;
  surface: SeoSurface;
};

export async function resolveSeoRequest(request: NextRequest): Promise<SeoRequestContext> {
  const origin = storefrontRequestOrigin(request);
  const route = resolveStoreFromHost(new URL(origin).host);

  if (route.type === "marketing" || route.type === "seller-app") {
    return {
      origin,
      surface: {
        kind: route.type
      }
    };
  }

  const store =
    route.type === "storefront"
      ? await getStorefrontBySlug(route.slug)
      : await getStorefrontByDomain(route.domain);

  if (!store) {
    return {
      origin,
      surface: {
        kind: "unresolved"
      }
    };
  }

  return {
    origin,
    surface: {
      kind: "storefront",
      store: {
        id: store.id,
        updatedAt: store.updatedAt
      }
    }
  };
}
