import Link from "next/link";

type QuickActionsProps = {
  storeSlug: string;
};

const actionItems = [
  {
    href: "/dashboard/products/new",
    label: "Add Product"
  },
  {
    href: "/dashboard/orders",
    label: "View Orders"
  },
  {
    href: "/dashboard/storefront/themes",
    label: "Customize Store"
  },
  {
    href: "/dashboard/ai",
    label: "StoreIM AI"
  }
];

export function QuickActions({ storeSlug }: QuickActionsProps) {
  return (
    <section className="panel-card dashboard-panel quick-actions-panel">
      <div className="panel-heading">
        <h2>Quick actions</h2>
      </div>
      <div className="quick-actions-grid">
        {actionItems.map((action) => (
          <Link className="quick-action-link" href={action.href} key={action.href}>
            {action.label}
          </Link>
        ))}
        <Link className="quick-action-link" href={`/s/${storeSlug}`} target="_blank">
          Open Storefront
        </Link>
      </div>
    </section>
  );
}
