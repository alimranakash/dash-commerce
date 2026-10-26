import { notFound } from "next/navigation";
import { DashboardShell } from "../../../../../components/dashboard/dashboard-shell";
import { SaleReceiptScreen } from "../../../../../modules/sales/components/sale-receipt-screen";
import { getSaleReceiptForStore } from "../../../../../modules/sales/sale-receipt.service";
import { requireStore } from "../../../../../modules/stores/queries";

type SaleReceiptPageProps = {
  params: Promise<{ saleId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * A sale's receipt — the counter's next screen after Complete sale, and the
 * reprint behind the sale page and the sales list. Guarded as the sale page is:
 * the store is the session's, and the sale is read within it or not at all.
 */
export default async function SaleReceiptPage({ params, searchParams }: SaleReceiptPageProps) {
  const store = await requireStore();
  const { saleId } = await params;
  const query = await searchParams;
  const found = await getSaleReceiptForStore(store, saleId);

  if (!found) notFound();

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <SaleReceiptScreen
          autoPrint={query.print === "1"}
          completed={query.completed === "1"}
          receipt={found.receipt}
          saleId={found.saleId}
        />
      </section>
    </DashboardShell>
  );
}
