import Link from "next/link";
import { DashboardQueryForm } from "../../../../components/dashboard/dashboard-query-form";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { FakeOrderActionButtons } from "../../../../modules/fake-orders/components/fake-order-action-buttons";
import { FakeOrderEmpty } from "../../../../modules/fake-orders/components/fake-order-empty";
import { RiskLevelBadge, VerificationStatusBadge } from "../../../../modules/fake-orders/components/fake-order-badges";
import { getVerificationQueue } from "../../../../modules/fake-orders/fake-order.service";
import { isCheckoutPhoneOtpRequired } from "../../../../modules/checkout/checkout-verification.service";
import { isCourierVerificationRequired } from "../../../../modules/fake-orders/fake-order.verification";
import {
  CheckoutOtpPolicyToggle,
  VerificationPolicyNotice,
  VerificationPolicyToggle
} from "../../../../modules/fake-orders/components/verification-policy-toggle";
import { requireStore } from "../../../../modules/stores/queries";

type VerificationQueuePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function VerificationQueuePage({ searchParams }: VerificationQueuePageProps) {
  const store = await requireStore();
  const params = await searchParams;
  const search = singleValue(params.search).trim();
  const [orders, verificationRequired, codOtpRequired] = await Promise.all([
    getVerificationQueue(store.id, search),
    isCourierVerificationRequired(store.id),
    isCheckoutPhoneOtpRequired(store.id)
  ]);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Orders</p>
            <h1>Verification Queue</h1>
            <p className="auth-copy">Manually verify suspicious orders before fulfillment.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CheckoutOtpPolicyToggle required={codOtpRequired} />
            <VerificationPolicyToggle required={verificationRequired} />
            <Link className="secondary link-button" href="/dashboard/orders/fake">
              Fake Orders
            </Link>
          </div>
        </div>

        {params.updated ? <p className="success-message">Verification status updated.</p> : null}
        {params.policy ? (
          <p className="success-message">
            Courier verification is now {params.policy === "on" ? "required" : "off"} for this store.
          </p>
        ) : null}
        {params.codOtp ? (
          <p className="success-message">
            Cash-on-delivery orders {params.codOtp === "on" ? "now need" : "no longer need"} an SMS
            code before they can be placed.
          </p>
        ) : null}

        <VerificationPolicyNotice required={verificationRequired} />

        <div className="panel-card p-4 sm:p-5">
          <DashboardQueryForm actionPath="/dashboard/orders/verification" className="mb-5 flex w-full gap-2 sm:max-w-md sm:ml-auto">
            <input className="h-11 min-w-0 flex-1 rounded-lg border border-[#e4e3ee] px-3 text-sm outline-none focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10" defaultValue={search} name="search" placeholder="Search order, customer, or phone" />
            <button className="h-11 rounded-lg bg-[#7c3aed] px-5 text-sm font-semibold text-white" type="submit">Search</button>
          </DashboardQueryForm>

          {orders.length ? (
            <div className="overflow-hidden rounded-xl border border-[#efeff5] bg-white">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1120px] border-collapse text-left text-xs">
                  <thead className="bg-[#f7f7fa] text-[#565762]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Order ID</th>
                      <th className="px-4 py-3 font-semibold">Customer</th>
                      <th className="px-4 py-3 font-semibold">Phone</th>
                      <th className="px-4 py-3 font-semibold">Order Value</th>
                      <th className="px-4 py-3 font-semibold">Risk Score</th>
                      <th className="px-4 py-3 font-semibold">Risk Level</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#efeff5]">
                    {orders.map(({ assessment, order }) => (
                      <tr className="transition hover:bg-[#fbfaff]" key={order.id}>
                        <td className="px-4 py-4">
                          <Link className="font-semibold text-[#6d3cf5] hover:underline" href={`/dashboard/orders/fake/${order.id}`}>
                            {order.orderNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-[#30313d]">{order.customerName}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-[#565762]">{order.customerPhone}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-[#30313d]">{formatMoney(order.totalAmount, order.currency)}</td>
                        <td className="px-4 py-4 font-semibold text-[#20212c]">{assessment.score}/100</td>
                        <td className="px-4 py-4"><RiskLevelBadge level={assessment.level} /></td>
                        <td className="px-4 py-4"><VerificationStatusBadge status={order.verificationStatus} /></td>
                        <td className="px-4 py-4">
                          <FakeOrderActionButtons compact orderId={order.id} redirectToQueue />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <FakeOrderEmpty title="No orders waiting for verification" description="High and medium risk orders will appear here until they are verified or marked fake." />
          )}
        </div>
      </section>
    </DashboardShell>
  );
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatMoney(value: unknown, currency: string) {
  return new Intl.NumberFormat("en", { currency, style: "currency" }).format(Number(value));
}
