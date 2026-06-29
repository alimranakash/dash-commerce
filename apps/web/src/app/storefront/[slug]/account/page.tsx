import { StorefrontFooter } from "../../../../modules/storefront/components/storefront-footer";
import { StorefrontHeader } from "../../../../modules/storefront/components/storefront-header";
import { requireStorefrontBySlug } from "../../../../modules/storefront/resolver";

type StorefrontAccountPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function StorefrontAccountPage({ params }: StorefrontAccountPageProps) {
  const { slug } = await params;
  const store = await requireStorefrontBySlug(slug);
  const primaryDomain = store.domains.find((domain) => domain.isPrimary) ?? store.domains[0];

  return (
    <main className="sf-page">
      <StorefrontHeader store={store} />
      <section className="sf-shop-hero" aria-labelledby="account-title">
        <p>{primaryDomain?.domain ?? `${store.slug}.dash.com`}</p>
        <h1 id="account-title">Customer account</h1>
        <span>Profile, orders, and saved addresses will be managed from this customer account area.</span>
      </section>
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
