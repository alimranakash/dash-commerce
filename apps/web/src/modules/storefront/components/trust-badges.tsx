const badges = [
  "Secure checkout ready",
  "Local inventory",
  "Responsive storefront",
  "Seller managed catalog"
];

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
