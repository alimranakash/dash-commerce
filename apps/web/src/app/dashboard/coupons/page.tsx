import { Plus } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { FeatureGate } from "../../../modules/billing/components/feature-gate";
import {
  CouponListControls,
  type CouponFilterKey
} from "../../../modules/coupons/components/coupon-list-controls";
import { getCouponCountsForStore, listCoupons } from "../../../modules/coupons/coupon.service";
import type { CouponFilters } from "../../../modules/coupons/coupon.service";
import { requireStore } from "../../../modules/stores/queries";

type CouponsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CouponsPage({ searchParams }: CouponsPageProps) {
  const store = await requireStore();
  const params = await searchParams;
  const activeFilter = parseCouponFilter(singleValue(params.status));
  const search = singleValue(params.search).trim();
  const dateRange = singleValue(params.dateRange).trim();

  const filters: CouponFilters = {
    ...(activeFilter === "all" ? {} : { status: activeFilter === "active" ? "ACTIVE" : "INACTIVE" }),
    ...(search ? { search } : {}),
    ...parseDateRange(dateRange)
  };

  const [coupons, counts] = await Promise.all([
    listCoupons(store.id, filters),
    getCouponCountsForStore(store.id, filters)
  ]);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="flex flex-wrap items-center gap-4">
          <div className="catalog-page-heading">
            <h1>Coupons</h1>
            {/*
              The list reads on any plan; creating and editing is what the
              entitlement buys, and every write action re-checks it.
            */}
            <FeatureGate feature="coupons" storeId={store.id} />
          </div>
          <Link
            className="inline-flex items-center gap-1 rounded-lg border border-[#7c3aed] bg-white px-3.5 py-2.5 text-sm font-medium text-[#6d3cf5] hover:bg-[#f7f3ff]"
            href="/dashboard/coupons/new"
          >
            <Plus aria-hidden="true" className="h-4 w-4" /> Create Coupon
          </Link>
        </div>
        <CouponListControls
          activeFilter={activeFilter}
          counts={counts}
          coupons={coupons}
          currency={store.currency}
          dateRange={dateRange}
          search={search}
        />
      </section>
    </DashboardShell>
  );
}

function parseCouponFilter(value: string): CouponFilterKey {
  const filters: CouponFilterKey[] = ["active", "inactive"];
  return filters.includes(value as CouponFilterKey) ? (value as CouponFilterKey) : "all";
}

/**
 * The date-range box is free text ("22 May - 21 Jun 2026"). Anything that does
 * not parse into two dates is ignored rather than reported: it is a convenience
 * filter, and refusing to render the page over a typo in it would be worse than
 * showing everything.
 */
function parseDateRange(value: string): { from?: Date; to?: Date } {
  if (!value) {
    return {};
  }

  const [rawFrom, rawTo] = value.split(/\s*(?:-|–|—|to)\s*/i);

  if (!rawFrom || !rawTo) {
    return {};
  }

  const to = new Date(rawTo);

  if (Number.isNaN(to.getTime())) {
    return {};
  }

  // The right-hand year is the one a seller writes ("22 May - 21 Jun 2026"), so
  // borrow it when the left-hand side omits one.
  const from = new Date(/\d{4}/.test(rawFrom) ? rawFrom : `${rawFrom} ${to.getFullYear()}`);

  if (Number.isNaN(from.getTime())) {
    return {};
  }

  to.setHours(23, 59, 59, 999);

  return { from, to };
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}
