import type { DashboardRecentOrder } from "../analytics.types";
import { DashboardCard } from "../../../components/dashboard/dashboard-card";

type RecentSalesProps = {
  orders: DashboardRecentOrder[];
};

export function RecentSales({ orders }: RecentSalesProps) {
  const chartOrders = [...orders].reverse();
  const maxValue = Math.max(...chartOrders.map((order) => Number(order.totalAmount)), 1);

  return (
    <DashboardCard action={<span className="rounded-md border border-[#ececf5] px-3 py-1.5 text-[10px] text-[#555662]">Recent orders</span>} className="min-h-[330px]" title="Recent Sales">
      {chartOrders.length === 0 ? (
        <div className="grid min-h-[245px] place-items-center rounded-lg border border-dashed border-[#dedceb] bg-[#fafaff] px-6 text-center">
          <div>
            <p className="text-sm font-semibold text-[#33343e]">No sales trend yet</p>
            <p className="mt-1 text-xs text-[#858691]">Recent order activity will appear here.</p>
          </div>
        </div>
      ) : (
        <div className="relative flex h-[245px] items-end gap-3 border-b border-l border-[#ebeaf2] px-4 pb-7 pt-4">
          <div className="pointer-events-none absolute inset-x-0 top-1/4 border-t border-[#f0eff6]" />
          <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-[#f0eff6]" />
          <div className="pointer-events-none absolute inset-x-0 top-3/4 border-t border-[#f0eff6]" />
          {chartOrders.map((order, index) => (
            <div className="relative z-10 flex h-full min-w-0 flex-1 items-end justify-center" key={order.id}>
              <div className="group relative w-full max-w-12 rounded-t bg-[#7c5cff] transition hover:bg-[#6841ed]" style={{ height: `${Math.max((Number(order.totalAmount) / maxValue) * 85, 8)}%` }}>
                <span className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-[#202027] px-2 py-1 text-[9px] text-white group-hover:block">{order.orderNumber}</span>
              </div>
              <span className="absolute top-full mt-2 text-[9px] text-[#888995]">{formatDay(order.createdAt, index)}</span>
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}

function formatDay(value: Date, fallback: number) {
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short" }).format(value) || String(fallback + 1);
}
