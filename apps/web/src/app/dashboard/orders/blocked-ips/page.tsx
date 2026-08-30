import { Ban, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { FeatureGate } from "../../../../modules/billing/components/feature-gate";
import { hasPlanFeature } from "../../../../modules/billing/subscription-limits";
import { BlockedIpForm } from "../../../../modules/blocked-ips/components/blocked-ip-form";
import { BlockedIpList } from "../../../../modules/blocked-ips/components/blocked-ip-list";
import { BlockedIpSuggestions } from "../../../../modules/blocked-ips/components/blocked-ip-suggestions";
import { getBlockedIpDashboard } from "../../../../modules/blocked-ips/blocked-ip.service";
import { requireStore } from "../../../../modules/stores/queries";

export default async function BlockedIpsPage() {
  const store = await requireStore();
  const [{ blocked, suggestions }, locked] = await Promise.all([
    getBlockedIpDashboard(store.id),
    hasPlanFeature(store.id, "blocked_ips").then((entitled) => !entitled)
  ]);
  const activeCount = blocked.filter((row) => row.state === "ACTIVE").length;

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Orders</p>
            <h1>Blocked IPs</h1>
            <p className="auth-copy">
              Stop an address from placing orders on your store. {activeCount}
              {activeCount === 1 ? " active block" : " active blocks"}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/*
              Existing blocks stay listed and unblockable on any plan — a
              downgrade must never trap a seller with customers they cannot let
              back in. Only adding a block is entitled.
            */}
            <FeatureGate feature="blocked_ips" storeId={store.id} />
            <Link className="secondary link-button" href="/dashboard/orders/fake">
              Fake Orders
            </Link>
          </div>
        </div>

        {/*
          Stated once, at the top, because it is the thing most likely to make
          this feature do harm: on a Bangladeshi mobile network one address can
          be thousands of unrelated people, and a seller who does not know that
          reads "12 orders" as "one person".
        */}
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="m-0 text-sm leading-6 text-amber-900">
            Mobile networks in Bangladesh put many customers behind one shared IP address, so
            blocking an address can block real buyers too. Check the phone-number count before you
            block, and use a time-limited block when you are not certain. Blocked visitors can still
            browse your store — only checkout is refused.
          </p>
        </div>

        <div className="panel-card p-4 sm:p-5">
          <h2 className="m-0 flex items-center gap-2 text-base font-semibold text-[#20212c]">
            <Ban className="h-4 w-4 text-[#7c3aed]" />
            Block an address
          </h2>
          <div className="mt-5">
            <BlockedIpForm locked={locked} />
          </div>
        </div>

        <div className="panel-card p-4 sm:p-5">
          <h2 className="m-0 text-base font-semibold text-[#20212c]">Suggested from fake orders</h2>
          <p className="m-0 mt-1 text-sm text-[#74758a]">
            Addresses you have already marked fake orders from. Nothing here is blocked until you
            block it.
          </p>
          <BlockedIpSuggestions suggestions={suggestions} />
        </div>

        <div className="panel-card p-4 sm:p-5">
          <h2 className="m-0 text-base font-semibold text-[#20212c]">Blocked addresses</h2>
          <div className="mt-4">
            <BlockedIpList blocked={blocked} />
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}
