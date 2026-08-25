import { DashboardShell } from "../../../../../components/dashboard/dashboard-shell";
import { CampaignForm } from "../../../../../modules/campaigns/components/campaign-form";
import { createCampaignFormAction } from "../../../../../modules/campaigns/campaign.actions";
import { listAudiences } from "../../../../../modules/campaigns/audience.service";
import { listTemplates } from "../../../../../modules/campaigns/template.service";
import { listCoupons } from "../../../../../modules/coupons/coupon.service";
import { requireStore } from "../../../../../modules/stores/queries";

export default async function CreateCampaignPage() {
  const store = await requireStore();
  const [coupons, audiences, templates] = await Promise.all([
    listCoupons(store.id, { status: "ACTIVE" }),
    listAudiences(store.id),
    listTemplates(store.id)
  ]);

  // Only codes that would actually work if a shopper used one today. Offering an
  // expired coupon to attach to a campaign is offering a broken message.
  const usable = coupons.filter((coupon) => coupon.redemptionState === "ACTIVE");

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <CampaignForm
          action={createCampaignFormAction}
          audiences={audiences.map((audience) => ({
            id: audience.id,
            name: audience.name,
            summary: audience.summary
          }))}
          cancelHref="/dashboard/marketing/campaigns"
          coupons={usable.map((coupon) => ({ code: coupon.code, id: coupon.id }))}
          currency={store.currency}
          heading="Create Campaign"
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
