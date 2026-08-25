import { DashboardShell } from "../../../../../components/dashboard/dashboard-shell";
import { TemplateForm } from "../../../../../modules/campaigns/components/template-form";
import { createTemplateFormAction } from "../../../../../modules/campaigns/audience.actions";
import { requireStore } from "../../../../../modules/stores/queries";

export default async function NewTemplatePage() {
  const store = await requireStore();

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <TemplateForm
          action={createTemplateFormAction}
          cancelHref="/dashboard/marketing/templates"
          heading="New Template"
        />
      </section>
    </DashboardShell>
  );
}
