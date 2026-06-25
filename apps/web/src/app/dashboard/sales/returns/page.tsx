import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { requireStore } from "../../../../modules/stores/queries";

export default async function SalesReturnsPage() {
  const store = await requireStore();

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="m-0 text-2xl font-semibold text-[#20212a]">Sales Returns</h1>
            <p className="mt-2 text-sm text-[#777985]">Return management will restore stock and connect to future refund workflows.</p>
          </div>
          <Link className="secondary link-button min-h-10" href="/dashboard/sales">Back to Sales</Link>
        </div>
        <section className="grid min-h-[520px] place-items-center rounded-xl border border-[#ececf5] bg-white p-8 text-center shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
          <div className="max-w-md">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#f3f0ff] text-[#7c3aed]"><RotateCcw className="h-8 w-8" /></span>
            <h2 className="mb-0 mt-5 text-xl font-semibold text-[#20212a]">Returns module coming soon</h2>
            <p className="mt-2 text-sm leading-6 text-[#777985]">Sales returns, refund tracking, and automatic stock restoration will appear here when the full returns workflow is added.</p>
          </div>
        </section>
      </section>
    </DashboardShell>
  );
}
