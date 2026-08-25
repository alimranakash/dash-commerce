import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { CouponForm } from "../../../../modules/coupons/components/coupon-form";
import { createCouponFormAction } from "../../../../modules/coupons/coupon.actions";
import { requireStore } from "../../../../modules/stores/queries";

export default async function CreateCouponPage() {
  const store = await requireStore();

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <CouponForm
          action={createCouponFormAction}
          cancelHref="/dashboard/coupons"
          currency={store.currency}
          heading="Create Coupon"
        />
      </section>
    </DashboardShell>
  );
}
