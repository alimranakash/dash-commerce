import { notFound } from "next/navigation";
import { DashboardShell } from "../../../../../components/dashboard/dashboard-shell";
import { TemplateForm } from "../../../../../modules/campaigns/components/template-form";
import { updateTemplateFormAction } from "../../../../../modules/campaigns/audience.actions";
import { findTemplate } from "../../../../../modules/campaigns/template.service";
import { requireStore } from "../../../../../modules/stores/queries";

type EditTemplatePageProps = {
  params: Promise<{ templateId: string }>;
};

export default async function EditTemplatePage({ params }: EditTemplatePageProps) {
  const store = await requireStore();
  const { templateId } = await params;
  const template = await findTemplate(store.id, templateId);

  if (!template) {
    notFound();
  }

  const action = updateTemplateFormAction.bind(null, template.id);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <TemplateForm
          action={action}
          cancelHref="/dashboard/marketing/templates"
          heading={`Edit ${template.name}`}
          template={{ body: template.body, name: template.name }}
        />
      </section>
    </DashboardShell>
  );
}
