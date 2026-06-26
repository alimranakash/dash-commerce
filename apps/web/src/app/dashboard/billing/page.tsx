import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { submitManualPaymentAction } from "../../../modules/billing/billing.actions";
import { BillingDashboard } from "../../../modules/billing/components/billing-dashboard";
import { getBillingDashboardData, getTrialRemaining } from "../../../modules/billing/billing.service";
import { requireStore } from "../../../modules/stores/queries";

export default async function BillingPage() {
  const store = await requireStore();
  const data = await getBillingDashboardData(store);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="mx-auto grid max-w-[1480px] gap-5">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight text-[#20212a]">Billing</h1>
          <p className="mt-2 text-sm text-[#737582]">Manage your plan, manual payments, invoices, and subscription status.</p>
        </div>
        <BillingDashboard
          action={submitManualPaymentAction}
          billingSettings={{
            bankAccountDetails: data.billingSettings.bankAccountDetails,
            bkashAccountType: data.billingSettings.bkashAccountType,
            bkashNumber: data.billingSettings.bkashNumber,
            nagadAccountType: data.billingSettings.nagadAccountType,
            nagadNumber: data.billingSettings.nagadNumber,
            paymentInstructions: data.billingSettings.paymentInstructions,
            rocketAccountType: data.billingSettings.rocketAccountType,
            rocketNumber: data.billingSettings.rocketNumber
          }}
          plans={data.plans.map((plan) => ({
            aiEnabled: plan.aiEnabled,
            currency: plan.currency,
            customDomainEnabled: plan.customDomainEnabled,
            description: plan.description,
            id: plan.id,
            isFeatured: plan.isFeatured,
            name: plan.name,
            orderLimit: plan.orderLimit,
            priceMonthly: plan.priceMonthly.toString(),
            priceYearly: plan.priceYearly.toString(),
            productLimit: plan.productLimit,
            staffLimit: plan.staffLimit,
            storeLimit: plan.storeLimit
          }))}
          subscription={{
            billingCycle: data.subscription.billingCycle,
            cancelAtPeriodEnd: data.subscription.cancelAtPeriodEnd,
            currentPeriodEndsAt: formatDate(data.subscription.currentPeriodEndsAt),
            payments: data.subscription.payments.map((payment) => ({
              amount: payment.amount.toString(),
              createdAt: formatDate(payment.createdAt),
              currency: payment.currency,
              invoiceNumber: payment.invoiceNumber,
              paymentMethod: payment.paymentMethod,
              paymentReference: payment.paymentReference ?? "No reference",
              status: payment.status
            })),
            planId: data.subscription.planId,
            planName: data.subscription.plan.name,
            status: data.subscription.status,
            trialRemaining: getTrialRemaining(data.subscription)
          }}
          usage={data.usage}
        />
      </section>
    </DashboardShell>
  );
}

function formatDate(date: Date | null) {
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium"
  }).format(date);
}
