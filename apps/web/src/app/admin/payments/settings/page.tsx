import { AdminPageHeader } from "../../../../components/admin/admin-ui";
import { updateBillingSettingsAction } from "../../../../modules/billing/billing.actions";
import { BillingSettingsForm } from "../../../../modules/billing/components/billing-settings-form";
import { getBillingSettings } from "../../../../modules/billing/billing.service";

export default async function AdminPaymentSettingsPage() {
  const settings = await getBillingSettings();

  return (
    <section className="mx-auto grid max-w-[1180px] gap-5">
      <AdminPageHeader
        description="Configure manual bKash, Nagad, Rocket, and bank transfer accounts shown to sellers."
        title="Manual Payment Settings"
      />
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
