import { GuestOrderHistory } from "../../../../modules/guest-orders/components/guest-order-history";
import { getGuestAccountView } from "../../../../modules/guest-orders/guest-orders.service";
import type { Metadata } from "next";
import { NotificationBarSlot } from "../../../../modules/notification-bar/components/notification-bar-slot";
import { storefrontBasePath } from "../../../../modules/storefront/base-path";
import { StorefrontFooter } from "../../../../modules/storefront/components/storefront-footer";
import { StorefrontHeader } from "../../../../modules/storefront/components/storefront-header";
import { requireStorefrontBySlug } from "../../../../modules/storefront/resolver";
import { storeSubdomain } from "../../../../lib/host-routing";

type StorefrontAccountPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    cleared?: string;
  }>;
};

/**
 * No canonical, and `noindex` instead — the wishlist's reasoning exactly.
 *
 * This page is one shopper's cookie rendered as a page, so there is no address
 * here that is the same document twice, and now that it can carry a name, a
 * phone number and a street address it is the last page on the storefront that
 * should be fetched by a crawler. `robots.ts` disallows it as well; the two
 * halves have to agree.
 */
export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false
  },
  title: "Account"
};

/**
 * Two pages behind one address.
 *
 * A visitor who has never ordered here gets exactly the page that was here
 * before — the shop has nothing of theirs to show, and saying so is the honest
 * answer. A visitor who ordered gets their own purchases, drawn from the order
 * ids their checkout left on this device and re-read from the database, for the
 * three days after each order.
 *
 * Deliberately not a login. Sellers on this platform take cash-on-delivery
 * orders from shoppers who will not make an account to buy a shirt, and the one
 * question those shoppers come back with — "where is my order?" — does not need
 * one.
 */
export default async function StorefrontAccountPage({
  params,
  searchParams
}: StorefrontAccountPageProps) {
  const { slug } = await params;
  const { cleared } = await searchParams;
  const store = await requireStorefrontBySlug(slug);
  const basePath = await storefrontBasePath(store.slug);
  const primaryDomain = store.domains.find((domain) => domain.isPrimary) ?? store.domains[0];
  const account = await getGuestAccountView(store.id);

  return (
    <main className="sf-page">
      <StorefrontHeader store={store} />
      <NotificationBarSlot anchor="top" store={store} surface="other" />
      <section className="sf-shop-hero" aria-labelledby="account-title">
        <p>{primaryDomain?.domain ?? storeSubdomain(store.slug)}</p>
        <h1 id="account-title">{account ? "Your orders" : "Customer account"}</h1>
        <span>
          {account
            ? "Your recent purchases from this shop, followed on this device — no account needed."
            : "Profile, orders, and saved addresses will be managed from this customer account area."}
        </span>
      </section>
      {/*
        Said once, on the page the button returned to. Clearing a receipt looks
        identical to the page having nothing on it, and a shopper who cannot tell
        the two apart presses it again.
      */}
      {cleared && !account ? (
        <section className="sf-section sf-account-cleared" role="status">
          <p>Your saved order details have been cleared from this device.</p>
        </section>
      ) : null}
      {account ? (
        <GuestOrderHistory basePath={basePath} storeSlug={store.slug} view={account} />
      ) : (
        <section className="sf-section sf-account-grid" aria-label="Customer account sections">
          <AccountCard
            items={["Name and contact details", "Email and phone", "Account preferences"]}
            title="Profile"
          />
          <AccountCard
            items={["Recent orders", "Order status", "Payment and delivery updates"]}
            title="Orders"
          />
          <AccountCard
            items={["Shipping addresses", "Billing address", "Default delivery details"]}
            title="Addresses"
          />
        </section>
      )}
      <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
    </main>
  );
}

function AccountCard({ items, title }: { items: string[]; title: string }) {
  return (
    <article className="sf-account-card">
      <h2>{title}</h2>
      <p>This section is prepared for customer self-service.</p>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <button type="button" disabled>
        Coming soon
      </button>
    </article>
  );
}
