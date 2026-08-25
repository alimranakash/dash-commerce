import { Plus, Users } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { MarketingRowActions } from "../../../../modules/campaigns/components/marketing-row-actions";
import { listAudiences } from "../../../../modules/campaigns/audience.service";
import { requireStore } from "../../../../modules/stores/queries";

type AudiencesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AudiencesPage({ searchParams }: AudiencesPageProps) {
  const store = await requireStore();
  const params = await searchParams;
  const search = singleValue(params.search).trim();
  const audiences = await listAudiences(store.id, search);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="flex flex-wrap items-center gap-4">
          <div className="catalog-page-heading">
            <h1>Audiences</h1>
          </div>
          <Link
            className="inline-flex items-center gap-1 rounded-lg border border-[#7c3aed] bg-white px-3.5 py-2.5 text-sm font-medium text-[#6d3cf5] hover:bg-[#f7f3ff]"
            href="/dashboard/marketing/audiences/new"
          >
            <Plus aria-hidden="true" className="h-4 w-4" /> New Audience
          </Link>
        </div>

        <section className="flex min-h-[480px] flex-col rounded-xl border border-[#ececf5] bg-white px-6 py-6 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
          {audiences.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
              <div className="mb-6 grid h-28 w-28 place-items-center rounded-2xl bg-[#f3efff] text-[#7950f2]">
                <Users aria-hidden="true" className="h-14 w-14" />
              </div>
              <h2 className="m-0 text-xl font-semibold text-[#20212a]">No saved audiences</h2>
              <p className="mt-4 max-w-sm text-sm leading-6 text-[#85869a]">
                Save the segments you send to most often — repeat buyers, people who never ordered,
                carts left behind — and reuse them across campaigns.
              </p>
              <Link
                className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-[#7c3aed] px-4 py-2.5 text-sm font-medium text-[#6d3cf5] hover:bg-[#f7f3ff]"
                href="/dashboard/marketing/audiences/new"
              >
                <Plus aria-hidden="true" className="h-4 w-4" /> New Audience
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#eeeef5] text-[11px] uppercase tracking-wide text-[#85869a]">
                    <th className="py-3 pr-4 font-medium">Audience</th>
                    <th className="py-3 pr-4 font-medium">Rules</th>
                    <th className="py-3 pr-4 font-medium">Size</th>
                    <th className="py-3 pr-4 font-medium">Used by</th>
                    <th className="py-3 pl-4 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {audiences.map((audience) => (
                    <tr className="border-b border-[#f4f4f9] align-middle" key={audience.id}>
                      <td className="py-4 pr-4">
                        <Link
                          className="font-semibold text-[#6d3cf5] hover:underline"
                          href={`/dashboard/marketing/audiences/${audience.id}`}
                        >
                          {audience.name}
                        </Link>
                        {audience.description ? (
                          <p className="m-0 mt-0.5 text-xs text-[#85869a]">{audience.description}</p>
                        ) : null}
                      </td>
                      <td className="py-4 pr-4 text-xs text-[#555762]">{audience.summary}</td>
                      <td className="py-4 pr-4 text-[#30313d]">
                        {/* A cached figure is labelled as one. An unqualified
                            number here would be read as live and acted on. */}
                        {audience.cachedCount === null ? (
                          <span className="text-xs text-[#a2a3b0]">Not counted</span>
                        ) : (
                          <>
                            {audience.cachedCount.toLocaleString("en")}
                            <span className="ml-1 text-xs text-[#a2a3b0]">
                              as of {formatDate(audience.countedAt)}
                            </span>
                          </>
                        )}
                      </td>
                      <td className="py-4 pr-4 text-[#30313d]">
                        {audience.campaignCount === 0
                          ? "—"
                          : `${audience.campaignCount} ${audience.campaignCount === 1 ? "campaign" : "campaigns"}`}
                      </td>
                      <td className="py-4 pl-4">
                        <MarketingRowActions
                          editHref={`/dashboard/marketing/audiences/${audience.id}`}
                          id={audience.id}
                          kind="audience"
                          name={audience.name}
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

function formatDate(date: Date | null) {
  return date ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date) : "unknown";
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}
