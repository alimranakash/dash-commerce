import { CalendarClock, PackageX } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import {
  getPreorderDebts,
  getPreorderWaitingOrders
} from "../../../../modules/products/preorder.service";
import { requireStore } from "../../../../modules/stores/queries";

export default async function PreordersPage() {
  const store = await requireStore();
  const [debts, waiting] = await Promise.all([
    getPreorderDebts(store.id),
    getPreorderWaitingOrders(store.id)
  ]);
  const totalOwed = debts.reduce((sum, debt) => sum + debt.owed, 0);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Products</p>
            <h1>Pre-orders</h1>
            <p className="auth-copy">
              What you have sold and cannot ship yet. The first table is what to buy; the second is
              who to ring once it lands.
            </p>
          </div>
          <Link className="secondary link-button" href="/dashboard/purchases/new">
            Create purchase order
          </Link>
        </div>

        <div className="panel-card p-4 sm:p-5">
          <h2 className="m-0 flex items-center gap-2 text-base font-semibold text-[#20212c]">
            <PackageX className="h-4 w-4 text-[#7c3aed]" />
            Stock owed
          </h2>
          <p className="m-0 mt-1 text-sm text-[#74758a]">
            {totalOwed
              ? `${totalOwed} unit${totalOwed === 1 ? "" : "s"} across ${debts.length} product${debts.length === 1 ? "" : "s"}. Buying this much clears every pre-order below.`
              : "Nothing is oversold right now."}
          </p>
          {debts.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead className="bg-[#f8f8fb] text-xs font-semibold text-[#555762]">
                  <tr>
                    {["Product", "SKU", "Units owed", "Ships around", "Still selling"].map(
                      (heading) => (
                        <th className="px-4 py-3" key={heading}>
                          {heading}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {debts.map((debt) => (
                    <tr className="border-t border-[#eeeef5] text-[#30313d]" key={debt.productId}>
                      <td className="px-4 py-3 font-medium">
                        <Link
                          className="text-[#6d3cf5] hover:underline"
                          href={`/dashboard/products/${debt.productId}/edit`}
                        >
                          {debt.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[#74758a]">{debt.sku ?? "-"}</td>
                      <td className="px-4 py-3 font-semibold text-[#a3203a]">{debt.owed}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {debt.preorderReleaseAt ? formatDate(debt.preorderReleaseAt) : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {/*
                          A product can owe stock and no longer be taking orders,
                          which is the normal way out of a pre-order run — the
                          seller closes it and works the backlog off.
                        */}
                        {debt.stillSelling ? "Yes" : "Closed"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        <div className="panel-card p-4 sm:p-5">
          <h2 className="m-0 flex items-center gap-2 text-base font-semibold text-[#20212c]">
            <CalendarClock className="h-4 w-4 text-[#7c3aed]" />
            Customers waiting
          </h2>
          <p className="m-0 mt-1 text-sm text-[#74758a]">
            Oldest first, because they have been waiting longest. None of these can be booked with a
            courier until the stock is in.
          </p>
          {waiting.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead className="bg-[#f8f8fb] text-xs font-semibold text-[#555762]">
                  <tr>
                    {["Order", "Customer", "Waiting on", "Placed", "Status"].map((heading) => (
                      <th className="px-4 py-3" key={heading}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {waiting.map((order) => (
                    <tr className="border-t border-[#eeeef5] align-top text-[#30313d]" key={order.orderId}>
                      <td className="px-4 py-3 font-medium">
                        <Link
                          className="text-[#6d3cf5] hover:underline"
                          href={`/dashboard/orders/${order.orderId}`}
                        >
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p className="m-0">{order.customerName}</p>
                        <p className="mb-0 mt-1 text-xs text-[#85869a]">{order.customerPhone}</p>
                      </td>
                      <td className="px-4 py-3">
                        {order.lines.map((line) => (
                          <p className="m-0 text-[13px]" key={line.title}>
                            {line.title} × {line.quantity}
                          </p>
                        ))}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{formatDate(order.createdAt)}</td>
                      <td className="px-4 py-3">{titleCase(order.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="m-0 mt-4 rounded-xl border border-dashed border-[#dedcf0] bg-[#fbfaff] p-5 text-sm text-[#74758a]">
              Nobody is waiting on stock.
            </p>
          )}
        </div>
      </section>
    </DashboardShell>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value);
}

function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
