import { notFound } from "next/navigation";
import { DashboardCard } from "../../../../components/dashboard/dashboard-card";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { requireStore } from "../../../../modules/stores/queries";

const reportTitles: Record<string, string> = {
  customers: "Customers",
  orders: "Orders",
  products: "Products",
  revenues: "Revenues"
};

export default async function ReportSectionPage({ params }: { params: Promise<{ report: string }> }) {
  const store = await requireStore();
  const { report } = await params;
  const title = reportTitles[report];

  if (!title) notFound();

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="mx-auto grid max-w-[1480px] gap-4">
        <h1 className="m-0 text-[1.65rem] font-semibold leading-tight">{title}</h1>
        <DashboardCard title={`${title} Report`}>
          <div className="grid min-h-80 place-items-center rounded-lg border border-dashed border-[#dedceb] bg-[#fafaff] px-6 text-center text-sm text-[#858691]">
            Detailed {title.toLowerCase()} reporting will appear here as more commerce data becomes available.
          </div>
        </DashboardCard>
      </section>
    </DashboardShell>
  );
}
