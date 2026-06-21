import { Plus } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { CouponListControls, type CouponFilterKey } from "../../../modules/coupons/components/coupon-list-controls";
import { requireStore } from "../../../modules/stores/queries";

type CouponsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CouponsPage({ searchParams }: CouponsPageProps) {
  const store = await requireStore();
  const params = await searchParams;

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="flex flex-wrap items-center gap-4">
          <div className="catalog-page-heading"><h1>Coupons</h1></div>
          <Link className="inline-flex items-center gap-1 rounded-lg border border-[#7c3aed] bg-white px-3.5 py-2.5 text-sm font-medium text-[#6d3cf5] hover:bg-[#f7f3ff]" href="/dashboard/coupons/new">
            <Plus aria-hidden="true" className="h-4 w-4" /> Create Coupon
          </Link>
        </div>
        <CouponListControls
          activeFilter={parseCouponFilter(singleValue(params.status))}
          dateRange={singleValue(params.dateRange).trim()}
          search={singleValue(params.search).trim()}
        />
      </section>
    </DashboardShell>
  );
}

function parseCouponFilter(value: string): CouponFilterKey {
  const filters: CouponFilterKey[] = ["active", "inactive"];
  return filters.includes(value as CouponFilterKey) ? value as CouponFilterKey : "all";
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
