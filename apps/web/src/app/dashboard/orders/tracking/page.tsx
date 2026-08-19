import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { hasPlanFeature } from "../../../../modules/billing/subscription-limits";
import { OrderTrackingPanel } from "../../../../modules/courier/components/order-tracking-panel";
import { getRecentTrackedShipments } from "../../../../modules/courier/courier.service";
import { requireStore } from "../../../../modules/stores/queries";

/**
 * Orders → Order Tracking.
 *
 * A static segment, so it wins over `[orderId]` the same way `fake` and
 * `verification` already do.
 *
 * The page renders on every plan — a seller should be able to see what they are
 * being offered — and only the lookup itself is entitled. `locked` is resolved
 * here so the panel can explain itself before any click; the real enforcement is
 * `courierPlanGate` inside `trackOrderAction`.
 */
export default async function OrderTrackingPage() {
  const store = await requireStore();
  const [locked, recent] = await Promise.all([
    hasPlanFeature(store.id, "order_tracking").then((entitled) => !entitled),
    getRecentTrackedShipments(store.id)
  ]);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page mx-auto max-w-[900px]">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight text-[#20212a]">Order Tracking</h1>
          <p className="mt-2 text-sm leading-6 text-[#737582]">
            Look a parcel up by its tracking code and see every delivery update the courier has
            reported. Consignment ids, invoice references, and order numbers work here too.
          </p>
        </div>
        <OrderTrackingPanel locked={locked} recent={recent} />
      </section>
    </DashboardShell>
  );
}
