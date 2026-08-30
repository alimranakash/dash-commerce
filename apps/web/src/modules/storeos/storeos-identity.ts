import type { StoreOSStoreIdentity } from "@dash/storeos-sdk";
import { getStoreConnectionIdentityById } from "../stores/store.repository";
import { storeSubdomain } from "../../lib/host-routing";

export type StoreOSConnectionIdentity = {
  organization: {
    id: string;
    name: string;
  };
  store: StoreOSStoreIdentity;
};

export class StoreOSIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreOSIdentityError";
  }
}

/**
 * The envelope that answers "who is connecting?" — and the reason the browser
 * cannot answer it.
 *
 * The only input is a `storeId`, and the only place a `storeId` may come from is
 * a completed `requireStore()` / `requireStoreManager()` guard. Nothing here
 * reads a form field, a query string, or a header, so there is no parameter an
 * attacker could change to make DashCommerce connect somebody else's shop: the
 * name, slug and hostnames below are re-read from the store row every time
 * rather than carried in from the request.
 *
 * Everything StoreOS is told about the merchant is assembled here, once, so a
 * future capability that needs the same identity does not grow a second,
 * slightly different version of it.
 */
export async function buildStoreOSConnectionIdentity(
  storeId: string
): Promise<StoreOSConnectionIdentity> {
  const store = await getStoreConnectionIdentityById(storeId);

  if (!store) {
    throw new StoreOSIdentityError("Store not found.");
  }

  const subdomain = storeSubdomain(store.slug);
  // The first row is the primary one — the repository orders by `isPrimary`, and
  // only verified CUSTOM domains reach us at all.
  const customDomain = store.domains[0]?.domain;

  return {
    organization: {
      id: store.organization.id,
      name: store.organization.name
    },
    store: {
      country: store.country,
      currency: store.currency,
      id: store.id,
      name: store.name,
      slug: store.slug,
      // What a customer types to reach the shop: the custom domain once it is
      // verified, the free subdomain until then.
      storefrontUrl: `https://${customDomain ?? subdomain}`,
      subdomain,
      timezone: store.timezone,
      ...(customDomain ? { customDomain } : {})
    }
  };
}
