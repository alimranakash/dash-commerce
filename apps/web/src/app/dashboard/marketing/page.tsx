import { BellRing, Megaphone, Percent, ShoppingCart, Users } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { getCampaignCountsForStore } from "../../../modules/campaigns/campaign.service";
import { getCouponCountsForStore } from "../../../modules/coupons/coupon.service";
import { requireStore } from "../../../modules/stores/queries";

export default async function MarketingOverviewPage() {
  const store = await requireStore();
  const [campaigns, coupons] = await Promise.all([
    getCampaignCountsForStore(store.id),
    getCouponCountsForStore(store.id)
  ]);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="catalog-page-heading">
          <h1>Marketing</h1>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Campaigns sent" value={campaigns.sent} />
          <StatCard label="In progress" value={campaigns.sending} />
          <StatCard label="Drafts" value={campaigns.draft} />
          <StatCard label="Active coupons" value={coupons.active} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ActionCard
            description="Write an SMS and send it to a segment of your customers."
            href="/dashboard/marketing/campaigns"
            icon={Megaphone}
            title="Campaigns"
          />
          <ActionCard
            description="Save the segments you send to and reuse them next time."
            href="/dashboard/marketing/audiences"
            icon={Users}
            title="Audiences"
          />
          <ActionCard
            description="Discount codes shoppers can enter at checkout."
            href="/dashboard/coupons"
            icon={Percent}
            title="Coupons"
          />
          <ActionCard
            description="Carts left behind, and the customers who left them."
            href="/dashboard/abandoned-cart"
            icon={ShoppingCart}
            title="Abandoned Cart"
          />
          <ActionCard
            description="Show shoppers what other people have just bought, from your real orders."
            href="/dashboard/marketing/sales-notifications"
            icon={BellRing}
            title="Sales Notifications"
          />
          <ActionCard
            description="One announcement across your shop, with a countdown that takes it down on time."
            href="/dashboard/marketing/notification-bar"
            icon={Megaphone}
            title="Notification Bar"
          />
        </div>
      </section>
    </DashboardShell>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[#ececf5] bg-white px-5 py-4 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
      <p className="m-0 text-xs font-medium uppercase tracking-wide text-[#85869a]">{label}</p>
      <p className="m-0 mt-1.5 text-2xl font-semibold text-[#20212a]">{value}</p>
    </div>
  );
}

function ActionCard({
  description,
  href,
  icon: Icon,
  title
}: {
  description: string;
  href: string;
  icon: typeof Megaphone;
  title: string;
}) {
  return (
    <Link
      className="flex flex-col gap-2 rounded-xl border border-[#ececf5] bg-white px-5 py-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)] transition hover:border-[#d9cffb]"
      href={href}
    >
      <Icon aria-hidden="true" className="h-5 w-5 text-fuchsia-500" />
      <strong className="text-sm font-semibold text-[#20212a]">{title}</strong>
      <span className="text-xs leading-5 text-[#85869a]">{description}</span>
    </Link>
  );
}
