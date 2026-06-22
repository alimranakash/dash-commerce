import { notFound, redirect } from "next/navigation";
import { DashboardCard } from "../../../../components/dashboard/dashboard-card";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { requireStore } from "../../../../modules/stores/queries";

const settingsSections: Record<string, string> = {
  invoice: "Invoice"
};

export default async function SettingsSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;

  if (section === "general") redirect("/dashboard/settings");

  const title = settingsSections[section];
  if (!title) notFound();

  const store = await requireStore();

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="catalog-page-heading"><h1>{title}</h1></div>
        <DashboardCard title={`${title} Settings`}>
          <div className="grid min-h-64 place-items-center rounded-lg border border-dashed border-[#dedceb] bg-[#fafaff] px-6 text-center">
            <div><p className="text-sm font-semibold text-[#34353f]">Coming soon</p><p className="mt-2 text-xs leading-5 text-[#858691]">{title} settings will be available here.</p></div>
          </div>
        </DashboardCard>
      </section>
    </DashboardShell>
  );
}
