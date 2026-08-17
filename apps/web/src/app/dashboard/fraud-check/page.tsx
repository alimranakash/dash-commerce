import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { hasPlanFeature } from "../../../modules/billing/subscription-limits";
import { CourierScoreCard } from "../../../modules/courier/components/courier-score-card";
import { requireStore } from "../../../modules/stores/queries";

/**
 * Standalone fraud check, so the capability is discoverable from the sidebar
 * rather than only surfacing inside a single order. Same action and same card as
 * the order page — this one just lets the seller type any number.
 */
export default async function FraudCheckPage() {
  const store = await requireStore();
  const locked = !(await hasPlanFeature(store.id, "fraud_check"));

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="mx-auto grid max-w-[720px] gap-5">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight text-[#20212a]">Fraud Check</h1>
          <p className="mt-2 text-sm leading-6 text-[#737582]">
            Check a customer&apos;s delivery history before you ship a cash-on-delivery order. See
            how many parcels they have received, cancelled, or returned with other stores.
          </p>
        </div>
        <CourierScoreCard cached={null} editable locked={locked} phone="" />
      </section>
    </DashboardShell>
  );
}
