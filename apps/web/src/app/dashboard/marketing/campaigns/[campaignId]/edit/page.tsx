import { notFound } from "next/navigation";
import { DashboardShell } from "../../../../../../components/dashboard/dashboard-shell";
import { CampaignForm } from "../../../../../../modules/campaigns/components/campaign-form";
import { updateCampaignFormAction } from "../../../../../../modules/campaigns/campaign.actions";
import {
  getCampaignByIdForStore,
  resolveCampaignRules
} from "../../../../../../modules/campaigns/campaign.service";
import { listAudiences } from "../../../../../../modules/campaigns/audience.service";
import { listTemplates } from "../../../../../../modules/campaigns/template.service";
import { listCoupons } from "../../../../../../modules/coupons/coupon.service";
import { requireStore } from "../../../../../../modules/stores/queries";

type EditCampaignPageProps = {
  params: Promise<{ campaignId: string }>;
};

export default async function EditCampaignPage({ params }: EditCampaignPageProps) {
  const store = await requireStore();
  const { campaignId } = await params;
  const campaign = await getCampaignByIdForStore(store.id, campaignId);

  if (!campaign) {
    notFound();
  }

  const [coupons, audiences, templates] = await Promise.all([
    listCoupons(store.id, { status: "ACTIVE" }),
    listAudiences(store.id),
    listTemplates(store.id)
  ]);
  const usable = coupons.filter((coupon) => coupon.redemptionState === "ACTIVE");
  const action = updateCampaignFormAction.bind(null, campaign.id);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <CampaignForm
          action={action}
          audiences={audiences.map((audience) => ({
            id: audience.id,
            name: audience.name,
            summary: audience.summary
          }))}
          campaign={{
            audienceId: campaign.audienceId,
            body: campaign.body,
            couponId: campaign.couponId,
            name: campaign.name,
            rules: resolveCampaignRules(campaign)
          }}
          cancelHref={`/dashboard/marketing/campaigns/${campaign.id}`}
          coupons={usable.map((coupon) => ({ code: coupon.code, id: coupon.id }))}
          currency={store.currency}
          heading={`Edit ${campaign.name}`}
          templates={templates.map((template) => ({
            body: template.body,
            id: template.id,
            name: template.name
          }))}
        />
      </section>
    </DashboardShell>
  );
}
