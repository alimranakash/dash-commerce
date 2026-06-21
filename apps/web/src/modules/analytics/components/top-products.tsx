import { DashboardCard } from "../../../components/dashboard/dashboard-card";
import type { DashboardTopProduct } from "../analytics.types";

type TopProductsProps = { currency: string; products: DashboardTopProduct[] };

export function TopProducts({ currency, products }: TopProductsProps) {
  return (
    <DashboardCard title="Top Selling">
      {products.length === 0 ? <Empty label="No sales data yet" /> : (
        <div>
          <div className="grid grid-cols-[1fr_auto] rounded-md bg-[#f7f7fa] px-3 py-2.5 text-[10px] font-medium uppercase text-[#44454f]"><span>Product Name</span><span>Items Sold</span></div>
          <div className="divide-y divide-[#f0eff5]">
            {products.slice(0, 5).map((product) => <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-3 text-[11px]" key={product.productId}><div><strong className="font-medium">{product.title}</strong><span className="mt-0.5 block text-[9px] text-[#9697a1]">{formatMoney(product.revenue, currency)}</span></div><strong>{product.quantitySold}</strong></div>)}
          </div>
        </div>
      )}
    </DashboardCard>
  );
}

function Empty({ label }: { label: string }) { return <div className="grid min-h-32 place-items-center text-xs text-[#8b8c97]">{label}</div>; }
function formatMoney(value: string, currency: string) { return new Intl.NumberFormat("en", { currency, style: "currency" }).format(Number(value)); }
