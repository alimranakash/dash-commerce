import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { PaymentSettingsForm } from "../../../modules/payments/components/payment-settings-form";
import { updatePaymentSettingsFormAction } from "../../../modules/payments/payment.actions";
import { getPaymentMethods } from "../../../modules/payments/payment.service";
import { requireStore } from "../../../modules/stores/queries";

type PaymentsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const store = await requireStore();
  const methods = await getPaymentMethods(store.id);
  const message = (await searchParams).updated ? "Payment settings updated." : null;

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Payments</p>
            <h1>Payment methods</h1>
            <p className="auth-copy">
              Configure cash on delivery and manual Bangladesh mobile payments.
            </p>
          </div>
        </div>
        {message ? <p className="success-message">{message}</p> : null}
        <div className="dashboard-shell">
          <PaymentSettingsForm action={updatePaymentSettingsFormAction} methods={methods} />
        </div>
      </section>
    </DashboardShell>
  );
}
