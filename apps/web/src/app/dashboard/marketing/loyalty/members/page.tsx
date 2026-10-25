import { Coins, Search, Users, UserX } from "lucide-react";
import Link from "next/link";
import { DashboardQueryForm } from "../../../../../components/dashboard/dashboard-query-form";
import { DashboardShell } from "../../../../../components/dashboard/dashboard-shell";
import { SummaryMetricCard } from "../../../../../components/dashboard/summary-metric-card";
import { FeatureGate } from "../../../../../modules/billing/components/feature-gate";
import { LoyaltyMembersTable } from "../../../../../modules/loyalty/components/loyalty-members-table";
import {
  getLoyaltyMembersPage,
  getLoyaltyMemberTotalsForStore,
  getUnresolvedLoyaltyConflictCount
} from "../../../../../modules/loyalty/loyalty.service";
import { getStoreAccess } from "../../../../../modules/stores/queries";

type LoyaltyMembersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Dashboard → Marketing → Loyalty → Members.
 *
 * Open to every team member, like the customers page: it shows the store's own
 * customers and their balances. The controls are an owner's, and the
 * conflicts count is only read for one — `getUnresolvedLoyaltyConflictCount`
 * refuses anyone else rather than relying on this page to ask nicely.
 */
export default async function LoyaltyMembersPage({ searchParams }: LoyaltyMembersPageProps) {
  const access = await getStoreAccess();
  const params = await searchParams;
  const search = singleValue(params.search).trim().slice(0, 80);
  const [page, totals, conflicts] = await Promise.all([
    getLoyaltyMembersPage(access.store.id, { cursor: singleValue(params.cursor), search }),
    getLoyaltyMemberTotalsForStore(access.store.id),
    access.canManage
      ? getUnresolvedLoyaltyConflictCount(access, access.store.id)
      : Promise.resolve(0)
  ]);
  const query = (cursor: string | null) => {
    const next = new URLSearchParams();

    if (search) next.set("search", search);
    if (cursor) next.set("cursor", cursor);

    return `/dashboard/marketing/loyalty/members${next.size ? `?${next.toString()}` : ""}`;
  };

  return (
    <DashboardShell storeSlug={access.store.slug}>
      <section className="resource-page w-full max-w-full min-w-0 grid-cols-[minmax(0,1fr)]">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Loyalty</p>
            <h1>Members</h1>
            <p className="auth-copy">
              Everyone who opted in at checkout, newest first, with the points they hold now.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FeatureGate feature="loyalty" storeId={access.store.id} />
            <Link className="secondary link-button" href="/dashboard/marketing/loyalty">
              Settings
            </Link>
          </div>
        </div>

        {conflicts > 0 ? (
          <p className="m-0 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {conflicts === 1
              ? "One customer opted in with a number that already belongs to another member. "
              : `${conflicts} customers opted in with numbers that already belong to other members. `}
            <Link className="font-semibold underline" href="/dashboard/marketing/loyalty/conflicts">
              Review {conflicts === 1 ? "it" : "them"}
            </Link>
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <SummaryMetricCard icon={Users} label="Members" value={formatNumber(totals.members)} />
          <SummaryMetricCard
            icon={UserX}
            label="Suspended"
            value={formatNumber(totals.suspended)}
          />
          <SummaryMetricCard icon={Coins} label="Points held" value={formatNumber(totals.pointsHeld)} />
        </div>

        <section className="rounded-xl border border-[#ececf5] bg-white px-6 py-6 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
          <DashboardQueryForm
            actionPath="/dashboard/marketing/loyalty/members"
            className="flex w-full gap-3 sm:max-w-md"
          >
            <input
              aria-label="Search members"
              className="h-11 min-w-0 flex-1 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6]"
              defaultValue={search}
              name="search"
              placeholder="Name, email or phone"
              type="search"
            />
            <button
              aria-label="Search members"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#7548f5] text-white transition hover:bg-[#6436e8]"
              type="submit"
            >
              <Search aria-hidden="true" className="h-4 w-4" />
            </button>
          </DashboardQueryForm>
        </section>

        <LoyaltyMembersTable members={page.members} searching={search.length > 0} />

        {page.paged || page.nextCursor ? (
          <div className="flex flex-wrap items-center gap-2">
            {page.paged ? (
              <Link className="secondary link-button" href={query(null)}>
                First page
              </Link>
            ) : null}
            {page.nextCursor ? (
              <Link className="secondary link-button" href={query(page.nextCursor)}>
                Next page
              </Link>
            ) : null}
          </div>
        ) : null}
      </section>
    </DashboardShell>
  );
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en").format(value);
}
