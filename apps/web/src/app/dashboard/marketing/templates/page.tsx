import { FileText, Plus } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { FeatureGate } from "../../../../modules/billing/components/feature-gate";
import { MarketingRowActions } from "../../../../modules/campaigns/components/marketing-row-actions";
import { listTemplates } from "../../../../modules/campaigns/template.service";
import { requireStore } from "../../../../modules/stores/queries";

type TemplatesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TemplatesPage({ searchParams }: TemplatesPageProps) {
  const store = await requireStore();
  const params = await searchParams;
  const search = singleValue(params.search).trim();
  const templates = await listTemplates(store.id, search);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="flex flex-wrap items-center gap-4">
          <div className="catalog-page-heading">
            <h1>Templates</h1>
            {/*
              The list reads on any plan; creating and editing is what the
              entitlement buys, and every write action re-checks it.
            */}
            <FeatureGate feature="marketing_templates" storeId={store.id} />
          </div>
          <Link
            className="inline-flex items-center gap-1 rounded-lg border border-[#7c3aed] bg-white px-3.5 py-2.5 text-sm font-medium text-[#6d3cf5] hover:bg-[#f7f3ff]"
            href="/dashboard/marketing/templates/new"
          >
            <Plus aria-hidden="true" className="h-4 w-4" /> New Template
          </Link>
        </div>

        <section className="flex min-h-[480px] flex-col rounded-xl border border-[#ececf5] bg-white px-6 py-6 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
          {templates.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
              <div className="mb-6 grid h-28 w-28 place-items-center rounded-2xl bg-[#f3efff] text-[#7950f2]">
                <FileText aria-hidden="true" className="h-14 w-14" />
              </div>
              <h2 className="m-0 text-xl font-semibold text-[#20212a]">No templates yet</h2>
              <p className="mt-4 max-w-sm text-sm leading-6 text-[#85869a]">
                Save messages you send often so you are not retyping them — and not re-counting the
                SMS segments every time.
              </p>
              <Link
                className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-[#7c3aed] px-4 py-2.5 text-sm font-medium text-[#6d3cf5] hover:bg-[#f7f3ff]"
                href="/dashboard/marketing/templates/new"
              >
                <Plus aria-hidden="true" className="h-4 w-4" /> New Template
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#eeeef5] text-[11px] uppercase tracking-wide text-[#85869a]">
                    <th className="py-3 pr-4 font-medium">Template</th>
                    <th className="py-3 pr-4 font-medium">Message</th>
                    <th className="py-3 pr-4 font-medium">Cost</th>
                    <th className="py-3 pl-4 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((template) => (
                    <tr className="border-b border-[#f4f4f9] align-top" key={template.id}>
                      <td className="py-4 pr-4">
                        <Link
                          className="font-semibold text-[#6d3cf5] hover:underline"
                          href={`/dashboard/marketing/templates/${template.id}`}
                        >
                          {template.name}
                        </Link>
                        {template.placeholders.length > 0 ? (
                          <p className="m-0 mt-1 flex flex-wrap gap-1">
                            {template.placeholders.map((placeholder) => (
                              <span
                                className="rounded bg-[#f3f0ff] px-1.5 py-0.5 font-mono text-[10px] text-[#6d3cf5]"
                                key={placeholder}
                              >
                                {`{{${placeholder}}}`}
                              </span>
                            ))}
                          </p>
                        ) : null}
                      </td>
                      <td className="max-w-md py-4 pr-4 text-xs leading-5 text-[#555762]">
                        {template.body}
                      </td>
                      <td className="py-4 pr-4 text-xs text-[#555762]">
                        {template.segments} {template.segments === 1 ? "segment" : "segments"}
                        {template.unicode ? (
                          <span className="ml-1 text-[#a9741c]">non-Latin</span>
                        ) : null}
                      </td>
                      <td className="py-4 pl-4">
                        <MarketingRowActions
                          editHref={`/dashboard/marketing/templates/${template.id}`}
                          id={template.id}
                          kind="template"
                          name={template.name}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </DashboardShell>
  );
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}
