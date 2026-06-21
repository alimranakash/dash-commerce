import { CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { DashboardCard } from "../../../components/dashboard/dashboard-card";

type SetupStatusProps = {
  hasProducts: boolean;
  hasOrders: boolean;
};

export function SetupStatus({ hasOrders, hasProducts }: SetupStatusProps) {
  const items = [
    { complete: hasProducts, href: "/dashboard/products", label: "Product catalog" },
    { complete: hasOrders, href: "/dashboard/orders", label: "First order received" },
    { complete: false, href: "/dashboard/payments", label: "Payment setup" },
    { complete: false, href: "/dashboard/shipping", label: "Shipping configuration" },
    { complete: false, href: "/dashboard/settings", label: "Store profile setup" }
  ];

  return (
    <DashboardCard className="h-full" title="Setup Status">
      <div className="space-y-3">
        {items.map((item) => (
          <Link className="flex items-center gap-2.5 text-xs text-[#31323b] hover:text-[#6d3cf5]" href={item.href} key={item.label}>
            {item.complete ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-[#c8c9d1]" />}
            <span className={item.complete ? "" : "underline decoration-[#b9a8ff] underline-offset-2"}>{item.label}</span>
          </Link>
        ))}
      </div>
    </DashboardCard>
  );
}
