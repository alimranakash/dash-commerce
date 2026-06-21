import { notFound } from "next/navigation";
import { DashboardCard } from "../../../components/dashboard/dashboard-card";
import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { requireStore } from "../../../modules/stores/queries";

type PlaceholderPageProps = {
  params: Promise<{ section: string }>;
};

const sections: Record<string, { description: string; title: string }> = {
  "abandoned-cart": { description: "Recovered checkout opportunities will appear here when tracking is enabled.", title: "Abandoned cart" },
  coupons: { description: "Coupon creation and campaign controls are not configured yet.", title: "Coupons" },
  customers: { description: "Customer profiles will appear here as checkout activity grows.", title: "Customers" },
  reports: { description: "Detailed commerce reports and exports will be available here.", title: "Reports" },
  transactions: { description: "Payment transaction records will appear here when gateway processing is enabled.", title: "Transactions" }
};

export default async function DashboardPlaceholderPage({ params }: PlaceholderPageProps) {
  const store = await requireStore();
  const { section } = await params;
  const page = sections[section];

  if (!page) notFound();

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header"><div><p className="eyebrow">Commerce</p><h1>{page.title}</h1><p className="auth-copy">{page.description}</p></div></div>
        <DashboardCard title={page.title}>
          <div className="grid min-h-56 place-items-center rounded-lg border border-dashed border-[#dedceb] bg-[#fafaff] px-6 text-center">
            <div><p className="text-sm font-semibold text-[#34353f]">Nothing to show yet</p><p className="mt-2 max-w-md text-xs leading-5 text-[#858691]">{page.description}</p></div>
          </div>
        </DashboardCard>
      </section>
    </DashboardShell>
  );
}
