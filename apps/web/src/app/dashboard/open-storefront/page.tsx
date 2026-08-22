import { redirect } from "next/navigation";
import { storeSubdomain } from "../../../lib/host-routing";
import { requireStore } from "../../../modules/stores/queries";

/**
 * Where "Open Storefront" in the dashboard nav points.
 *
 * The nav is a client component and `PLATFORM_ROOT_DOMAIN` never reaches the
 * browser bundle, so it cannot build `<slug>.<root>` itself. Handing the address
 * down as a prop would mean touching every page that renders `DashboardShell`,
 * so the link comes here and the current store's own subdomain is resolved
 * server-side — which is also what puts the seller on their real storefront
 * address rather than the internal `/s/<slug>` rewrite target.
 *
 * Deliberately not under `/dashboard/storefront`: that path is the storefront
 * settings section, and its `[section]` segment would swallow any child route.
 */
export default async function OpenStorefrontPage() {
  const store = await requireStore();

  redirect(`https://${storeSubdomain(store.slug)}`);
}
