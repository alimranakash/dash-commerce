import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { getOrderReturnsForOrder } from "../return.service";
import { orderReturnTypeLabels } from "../return.types";
import type { OrderReturnType } from "../return.schema";
import { ReturnStatusBadge, ReturnTypeBadge } from "./return-status-badge";

/**
 * What is already coming back on this order, on the order page itself.
 *
 * A seller looking at an order needs to know a return is open on it before they
 * ship it again or refund it a second time, which is why this sits with the
 * order rather than only on the Returns list.
 */
export async function OrderReturnsPanel({
  currency,
  orderId,
  storeId
}: {
  currency: string;
  orderId: string;
  storeId: string;
}) {
  const requests = await getOrderReturnsForOrder(storeId, orderId);

  return (
    <section className="overflow-hidden rounded-xl border border-[#ececf5] bg-white shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ececf5] px-5 py-4">
        <span className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-[#f0ebff] text-[#7548f5]">
            <RotateCcw className="h-4 w-4" />
          </span>
          <h2 className="m-0 text-sm font-semibold">Returns, exchanges & refunds</h2>
        </span>
        <span className="flex flex-wrap gap-2">
          {(["RETURN", "EXCHANGE", "REFUND"] as OrderReturnType[]).map((type) => (
            <Link
              className="inline-flex h-9 items-center rounded-lg border border-[#dedcea] bg-white px-3 text-[11px] font-semibold text-[#555762] transition hover:bg-[#f8f7fc]"
              href={`/dashboard/orders/returns/new?orderId=${orderId}&type=${type}`}
              key={type}
            >
              New {orderReturnTypeLabels[type].toLowerCase()}
            </Link>
          ))}
        </span>
      </header>
      <div className="p-5">
        {requests.length === 0 ? (
          <p className="m-0 text-xs text-[#777985]">
            Nothing has come back on this order. Open a request above when a customer wants goods
            returned, swapped, or money back.
          </p>
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0">
            {requests.map((request) => (
              <li
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#efeff5] px-4 py-3"
                key={request.id}
              >
                <span className="flex flex-wrap items-center gap-2.5">
                  <Link
                    className="text-xs font-semibold text-[#6d3cf5] hover:underline"
                    href={`/dashboard/orders/returns/${request.id}`}
                  >
                    {request.returnNumber}
                  </Link>
                  <ReturnTypeBadge type={request.type} />
                  <ReturnStatusBadge status={request.status} />
                </span>
                <span className="text-xs text-[#777985]">
                  {request.items.length > 0
                    ? `${request.items.reduce((sum, item) => sum + item.quantity, 0)} units · `
                    : ""}
                  <strong className="font-semibold text-[#292a34]">
                    {formatMoney(request.refundAmount, currency)}
                  </strong>{" "}
                  refund
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function formatMoney(value: unknown, currency: string) {
  return new Intl.NumberFormat("en", { currency, style: "currency" }).format(Number(value));
}
