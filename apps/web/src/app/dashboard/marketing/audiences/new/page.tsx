import { DashboardShell } from "../../../../../components/dashboard/dashboard-shell";
import { AudienceForm } from "../../../../../modules/campaigns/components/audience-form";
import { createAudienceFormAction } from "../../../../../modules/campaigns/audience.actions";
import { requireStore } from "../../../../../modules/stores/queries";

export default async function NewAudiencePage() {
  const store = await requireStore();

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <AudienceForm
          action={createAudienceFormAction}
          cancelHref="/dashboard/marketing/audiences"
          currency={store.currency}
          heading="New Audience"
        />
      </section>
    </DashboardShell>
  );
}
