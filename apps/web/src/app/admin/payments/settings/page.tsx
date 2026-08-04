import { AdminPageHeader } from "../../../../components/admin/admin-ui";
import { updateBillingSettingsAction } from "../../../../modules/billing/billing.actions";
import { BillingSettingsForm } from "../../../../modules/billing/components/billing-settings-form";
import { getBillingSettings } from "../../../../modules/billing/billing.service";

type AdminPaymentSettingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPaymentSettingsPage({ searchParams }: AdminPaymentSettingsPageProps) {
  const params = await searchParams;
  const updated = params.updated === "1";
  const settings = await getBillingSettings();

  return (
    <section className="mx-auto grid max-w-[1180px] gap-5">
      <AdminPageHeader
        description="Configure manual bKash, Nagad, Rocket, and bank transfer accounts shown to sellers."
        title="Manual Payment Settings"
      />
      {updated ? (
        <p className="m-0 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          Billing settings saved.
        </p>
      ) : null}
      <BillingSettingsForm
        action={updateBillingSettingsAction}
        settings={{
          bankAccountDetails: settings.bankAccountDetails,
          bkashAccountType: settings.bkashAccountType,
          bkashNumber: settings.bkashNumber,
          nagadAccountType: settings.nagadAccountType,
          nagadNumber: settings.nagadNumber,
          paymentInstructions: settings.paymentInstructions,
          rocketAccountType: settings.rocketAccountType,
          rocketNumber: settings.rocketNumber
        }}
      />
    </section>
  );
}
