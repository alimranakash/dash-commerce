export function StorefrontLoadingSkeleton() {
  return (
    <div className="sf-skeleton-stack" aria-label="Loading storefront">
      <div className="sf-skeleton-line sf-skeleton-line-wide" />
      <div className="sf-skeleton-line" />
      <div className="sf-skeleton-grid">
        <div />
        <div />
        <div />
      </div>
    </div>
  );
}
