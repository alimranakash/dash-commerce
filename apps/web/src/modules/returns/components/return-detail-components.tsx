import {
  Building2,
  CircleDollarSign,
  Clock3,
  ImageIcon,
  MessageSquareText,
  Package,
  RotateCcw
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ReturnStatusBadge, ReturnTypeBadge } from "./return-status-badge";

export type ReturnItemView = {
  id: string;
  imageUrl: string | null;
  quantity: number;
  replacementQuantity: number;
  replacementTitle: string | null;
  replacementUnitPrice: string | null;
  sku: string | null;
  title: string;
  total: string;
  unitPrice: string;
};

export type ReturnTimelineEvent = {
  at: Date | null;
  label: string;
};

export function ReturnStatusCards({
  restockItems,
  status,
  type
}: {
  restockItems: boolean;
  status: string;
  type: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <article className="rounded-xl border border-[#ececf5] bg-white p-4 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-xs font-semibold text-[#555762]">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-[#f0ebff] text-[#7548f5]">
              <RotateCcw className="h-4 w-4" />
            </span>
            Request type
          </span>
          <ReturnTypeBadge type={type} />
        </div>
      </article>
      <article className="rounded-xl border border-[#ececf5] bg-white p-4 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-xs font-semibold text-[#555762]">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-[#f0ebff] text-[#7548f5]">
              <Package className="h-4 w-4" />
            </span>
            Stage
          </span>
          <ReturnStatusBadge status={status} />
        </div>
      </article>
      <article className="rounded-xl border border-[#ececf5] bg-white p-4 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-xs font-semibold text-[#555762]">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-[#f0ebff] text-[#7548f5]">
              <Package className="h-4 w-4" />
            </span>
            Stock
          </span>
          <span className="text-xs font-semibold text-[#292a34]">
            {restockItems ? "Goes back on the shelf" : "Not restocked"}
          </span>
        </div>
      </article>
    </div>
  );
}

export function ReturnSummaryCard({
  dueAmount,
  itemsAmount,
  refundAmount,
  replacementAmount,
  restockingFee,
  shippingRefundAmount,
  showReplacement
}: {
  dueAmount: string;
  itemsAmount: string;
  refundAmount: string;
  replacementAmount: string;
  restockingFee: string;
  shippingRefundAmount: string;
  showReplacement: boolean;
}) {
  return (
    <DetailCard icon={CircleDollarSign} title="Settlement">
      <dl className="grid grid-cols-[1fr_auto] gap-x-5 gap-y-3 text-xs">
        <dt className="text-[#777985]">Goods coming back</dt>
        <dd className="m-0 font-medium">{itemsAmount}</dd>
        <dt className="text-[#777985]">Delivery refund</dt>
        <dd className="m-0 font-medium">{shippingRefundAmount}</dd>
        <dt className="text-[#777985]">Restocking fee</dt>
        <dd className="m-0 font-medium text-rose-600">-{restockingFee}</dd>
        {showReplacement ? (
          <>
            <dt className="text-[#777985]">Replacement going out</dt>
            <dd className="m-0 font-medium text-rose-600">-{replacementAmount}</dd>
          </>
        ) : null}
        <dt className="mt-2 border-t border-[#ececf5] pt-4 text-sm font-semibold">
          Refund to customer
        </dt>
        <dd className="m-0 mt-2 border-t border-[#ececf5] pt-4 text-xl font-bold text-[#6d3cf5]">
          {refundAmount}
        </dd>
        {dueAmount ? (
          <>
            <dt className="text-sm font-semibold">Customer still owes</dt>
            <dd className="m-0 text-sm font-bold text-[#e49a00]">{dueAmount}</dd>
          </>
        ) : null}
      </dl>
    </DetailCard>
  );
}

export function ReturnRequestCard({
  customerName,
  customerPhone,
  orderId,
  orderNumber,
  reason,
  reasonNote,
  refundMethod,
  refundReference,
  resolutionNote
}: {
  customerName: string;
  customerPhone: string;
  orderId: string;
  orderNumber: string;
  reason: string;
  reasonNote: string | null;
  refundMethod: string;
  refundReference: string | null;
  resolutionNote: string | null;
}) {
  return (
    <DetailCard icon={MessageSquareText} title="Request">
      <dl className="grid grid-cols-[minmax(110px,0.7fr)_minmax(0,1fr)] gap-x-5 gap-y-4 text-xs">
        <dt className="text-[#777985]">Order</dt>
        <dd className="m-0 font-medium">
          <Link className="text-[#6d3cf5] hover:underline" href={`/dashboard/orders/${orderId}`}>
            {orderNumber}
          </Link>
        </dd>
        <dt className="text-[#777985]">Customer</dt>
        <dd className="m-0 font-medium text-[#292a34]">
          {customerName}
          <span className="block text-[#777985]">{customerPhone}</span>
        </dd>
        <dt className="text-[#777985]">Reason</dt>
        <dd className="m-0 font-medium text-[#292a34]">{reason}</dd>
        <dt className="text-[#777985]">Refund method</dt>
        <dd className="m-0 font-medium text-[#292a34]">{refundMethod}</dd>
        <dt className="text-[#777985]">Transaction ID</dt>
        <dd className="m-0 font-medium text-[#292a34]">{refundReference ?? "Not recorded"}</dd>
        <dt className="text-[#777985]">Customer said</dt>
        <dd className="m-0 font-medium text-[#292a34]">{reasonNote ?? "Nothing noted"}</dd>
        <dt className="text-[#777985]">Resolution</dt>
        <dd className="m-0 font-medium text-[#292a34]">{resolutionNote ?? "Not settled yet"}</dd>
      </dl>
    </DetailCard>
  );
}

export function ReturnItemsTable({
  items,
  showReplacement
}: {
  items: ReturnItemView[];
  showReplacement: boolean;
}) {
  if (items.length === 0) {
    return (
      <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
        <h2 className="m-0 text-sm font-semibold">Items</h2>
        <p className="mt-2 text-xs text-[#777985]">
          No goods are attached to this request — it is a flat refund against the order.
        </p>
      </section>
    );
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-[#ececf5] bg-white shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
      <header className="border-b border-[#ececf5] px-5 py-4">
        <h2 className="m-0 text-sm font-semibold">
          {showReplacement ? "Items coming back and going out" : "Items coming back"}
        </h2>
      </header>
      <div className="max-w-full overflow-x-auto p-4">
        <table className="w-full min-w-[760px] border-collapse text-left text-xs">
          <thead className="bg-[#f7f7fa] text-[#5f616d]">
            <tr>
              <th className="p-3">Item</th>
              <th className="p-3">SKU</th>
              <th className="p-3">Unit price</th>
              <th className="p-3">Quantity</th>
              {showReplacement ? <th className="p-3">Replacement</th> : null}
              <th className="p-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr className="border-b border-[#efeff5] transition hover:bg-[#faf9ff]" key={item.id}>
                <td className="p-3">
                  <span className="flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-[#ecebf2] bg-[#fafafa]">
                      {item.imageUrl ? (
                        <img
                          alt={item.title}
                          className="h-full w-full object-cover"
                          src={item.imageUrl}
                        />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-[#b6b7c0]" />
                      )}
                    </span>
                    <span className="font-semibold">{item.title}</span>
                  </span>
                </td>
                <td className="p-3 text-[#686a76]">{item.sku ?? "-"}</td>
                <td className="p-3">{item.unitPrice}</td>
                <td className="p-3">{item.quantity}</td>
                {showReplacement ? (
                  <td className="p-3">
                    {item.replacementTitle ? (
                      <span>
                        <strong className="block font-semibold text-[#292a34]">
                          {item.replacementQuantity} × {item.replacementTitle}
                        </strong>
                        <span className="text-[#777985]">{item.replacementUnitPrice} each</span>
                      </span>
                    ) : (
                      <span className="text-[#92939d]">No replacement</span>
                    )}
                  </td>
                ) : null}
                <td className="p-3 text-right font-semibold">{item.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ReturnTimeline({ events }: { events: ReturnTimelineEvent[] }) {
  return (
    <DetailCard icon={Clock3} title="History">
      <ol className="grid gap-0">
        {events.map((event, index) => (
          <li className="relative grid grid-cols-[24px_1fr] gap-3 pb-5 last:pb-0" key={event.label}>
            <span
              className={`relative z-10 mt-0.5 h-3 w-3 rounded-full ring-4 ${event.at ? "bg-[#7548f5] ring-[#eee9ff]" : "bg-[#d5d4dc] ring-[#f2f2f5]"}`}
            />
            {index < events.length - 1 ? (
              <span className="absolute left-[5px] top-3 h-full w-px bg-[#e5e3ed]" />
            ) : null}
            <div>
              <strong className={`text-xs ${event.at ? "text-[#292a34]" : "text-[#92939d]"}`}>
                {event.label}
              </strong>
              <span className="mt-1 block text-[10px] text-[#92939d]">
                {event.at ? formatDate(event.at) : "Pending"}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </DetailCard>
  );
}

export function DetailCard({
  children,
  icon: Icon = Building2,
  title
}: {
  children: ReactNode;
  icon?: typeof Building2;
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#ececf5] bg-white shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
      <header className="flex items-center gap-2.5 border-b border-[#ececf5] px-5 py-4">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-[#f0ebff] text-[#7548f5]">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="m-0 text-sm font-semibold">{title}</h2>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value);
}
