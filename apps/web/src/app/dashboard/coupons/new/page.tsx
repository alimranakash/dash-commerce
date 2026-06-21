import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { CouponForm } from "../../../../modules/coupons/components/coupon-form";
import { requireStore } from "../../../../modules/stores/queries";

export default async function CreateCouponPage() {
  const store = await requireStore();

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <CouponForm />
      </section>
    </DashboardShell>
  );
}
