import { Plus } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { CampaignList } from "../../../../modules/campaigns/components/campaign-list";
import { getCampaignsForStore } from "../../../../modules/campaigns/campaign.service";
import type { CampaignFilters } from "../../../../modules/campaigns/campaign.service";
import { requireStore } from "../../../../modules/stores/queries";

type CampaignsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CampaignsPage({ searchParams }: CampaignsPageProps) {
  const store = await requireStore();
  const params = await searchParams;
  const search = singleValue(params.search).trim();

  const filters: CampaignFilters = {
    ...(search ? { search } : {})
  };

  const campaigns = await getCampaignsForStore(store.id, filters);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="flex flex-wrap items-center gap-4">
          <div className="catalog-page-heading">
            <h1>Campaigns</h1>
          </div>
          <Link
            className="inline-flex items-center gap-1 rounded-lg border border-[#7c3aed] bg-white px-3.5 py-2.5 text-sm font-medium text-[#6d3cf5] hover:bg-[#f7f3ff]"
            href="/dashboard/marketing/campaigns/new"
          >
            <Plus aria-hidden="true" className="h-4 w-4" /> Create Campaign
          </Link>
        </div>

        <section className="flex min-h-[520px] flex-col rounded-xl border border-[#ececf5] bg-white px-6 py-6 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
          <CampaignList
            campaigns={campaigns.map((campaign) => ({
              audienceName: campaign.audience?.name ?? null,
              channel: campaign.channel,
              couponCode: campaign.coupon?.code ?? null,
              createdAt: campaign.createdAt,
              failedCount: campaign.failedCount,
              id: campaign.id,
              name: campaign.name,
              sentCount: campaign.sentCount,
              status: campaign.status,
              totalCount: campaign.totalCount
            }))}
          />
        </section>
      </section>
    </DashboardShell>
  );
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}
