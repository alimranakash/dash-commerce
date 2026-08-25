import { notFound } from "next/navigation";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { CouponForm } from "../../../../modules/coupons/components/coupon-form";
import { updateCouponFormAction } from "../../../../modules/coupons/coupon.actions";
import { findCoupon } from "../../../../modules/coupons/coupon.service";
import { requireStore } from "../../../../modules/stores/queries";

type EditCouponPageProps = {
  params: Promise<{ couponId: string }>;
};

export default async function EditCouponPage({ params }: EditCouponPageProps) {
  const store = await requireStore();
  const { couponId } = await params;
  const coupon = await findCoupon(store.id, couponId);

  if (!coupon) {
    notFound();
  }

  // Binding the id here rather than putting it in a hidden field: the row the
  // action writes is then fixed by the URL the seller actually opened.
  const action = updateCouponFormAction.bind(null, coupon.id);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <CouponForm
          action={action}
          cancelHref="/dashboard/coupons"
          coupon={coupon}
          currency={store.currency}
          heading={`Edit ${coupon.code}`}
        />
      </section>
    </DashboardShell>
  );
}
