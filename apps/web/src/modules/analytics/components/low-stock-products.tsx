import Link from "next/link";
import { DashboardCard } from "../../../components/dashboard/dashboard-card";
import type { DashboardLowStockProduct } from "../analytics.types";

type LowStockProductsProps = { products: DashboardLowStockProduct[] };

export function LowStockProducts({ products }: LowStockProductsProps) {
  return (
    <DashboardCard action={<Link className="text-[11px] font-semibold text-[#6d3cf5]" href="/dashboard/products">Manage</Link>} title="Low Stock">
      {products.length === 0 ? <div className="grid min-h-32 place-items-center text-xs text-[#8b8c97]">Stock looks healthy</div> : (
        <div>
          <div className="grid grid-cols-[1fr_64px_80px] rounded-md bg-[#f7f7fa] px-3 py-2.5 text-[10px] font-medium text-[#44454f]"><span>Product Name</span><span>Quantity</span><span>Threshold</span></div>
          <div className="divide-y divide-[#f0eff5]">
            {products.slice(0, 5).map((product) => <div className="grid grid-cols-[1fr_64px_80px] items-center px-3 py-3 text-[11px]" key={product.id}><strong className="font-medium">{product.title}</strong><span>{product.stockQuantity}</span><span className="w-fit rounded-full bg-rose-50 px-2 py-1 text-[9px] font-semibold text-rose-600">{product.lowStockThreshold}</span></div>)}
          </div>
        </div>
      )}
    </DashboardCard>
  );
}
