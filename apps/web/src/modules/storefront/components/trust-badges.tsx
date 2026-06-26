const badges = ["Fast Delivery", "Secure Checkout", "Easy Returns", "Customer Support"];

export function TrustBadges() {
  return (
    <section className="sf-trust" aria-label="Storefront trust badges">
      {badges.map((badge) => (
        <div key={badge}>
          <span />
          <strong>{badge}</strong>
        </div>
      ))}
    </section>
  );
}
