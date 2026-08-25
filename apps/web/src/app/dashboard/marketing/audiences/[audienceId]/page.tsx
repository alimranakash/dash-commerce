import { notFound } from "next/navigation";
import { DashboardShell } from "../../../../../components/dashboard/dashboard-shell";
import { AudienceForm } from "../../../../../modules/campaigns/components/audience-form";
import { updateAudienceFormAction } from "../../../../../modules/campaigns/audience.actions";
import { findAudience } from "../../../../../modules/campaigns/audience.service";
import { requireStore } from "../../../../../modules/stores/queries";

type EditAudiencePageProps = {
  params: Promise<{ audienceId: string }>;
};

export default async function EditAudiencePage({ params }: EditAudiencePageProps) {
  const store = await requireStore();
  const { audienceId } = await params;
  const audience = await findAudience(store.id, audienceId);

  if (!audience) {
    notFound();
  }

  const action = updateAudienceFormAction.bind(null, audience.id);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <AudienceForm
          action={action}
          audience={{
            description: audience.description,
            name: audience.name,
            rules: audience.rules
          }}
          cancelHref="/dashboard/marketing/audiences"
          currency={store.currency}
          heading={`Edit ${audience.name}`}
        />
        {audience.campaignCount > 0 ? (
          <p className="m-0 max-w-2xl rounded-lg border border-[#e5e3f1] bg-[#fafaff] px-4 py-3 text-xs leading-5 text-[#555762]">
            {audience.campaignCount} {audience.campaignCount === 1 ? "campaign uses" : "campaigns use"}{" "}
            this audience. Changing the rules affects drafts that still point at it; campaigns whose
            recipient list has already been built keep the people they were addressed to.
          </p>
        ) : null}
      </section>
    </DashboardShell>
  );
}
