import { ArrowLeft, CalendarDays, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "../../../../../components/dashboard/dashboard-shell";
import {
  ReturnDeleteButton,
  ReturnRefundForm,
  ReturnWorkflowActions
} from "../../../../../modules/returns/components/return-detail-actions";
import {
  DetailCard,
  ReturnItemsTable,
  ReturnRequestCard,
  ReturnStatusCards,
  ReturnSummaryCard,
  ReturnTimeline,
  type ReturnTimelineEvent
} from "../../../../../modules/returns/components/return-detail-components";
import { ReturnTypeBadge } from "../../../../../modules/returns/components/return-status-badge";
import { recordOrderReturnRefundFormAction } from "../../../../../modules/returns/return.actions";
import { getOrderReturnByIdForStore } from "../../../../../modules/returns/return.service";
import type {
  OrderRefundMethod,
  OrderReturnReason
} from "../../../../../modules/returns/return.schema";
import {
  orderRefundMethodLabels,
  orderReturnReasonLabels,
  orderReturnTypeLabels
} from "../../../../../modules/returns/return.types";
import { requireStore } from "../../../../../modules/stores/queries";

type ReturnDetailPageProps = {
  params: Promise<{ returnId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** The three stages that moved neither goods nor money, and so may be thrown away. */
const DELETABLE_STATUSES = ["REQUESTED", "REJECTED", "CANCELLED"];

export default async function ReturnDetailPage({ params, searchParams }: ReturnDetailPageProps) {
  const { returnId } = await params;
  const store = await requireStore();
  const request = await getOrderReturnByIdForStore(store.id, returnId);
  const flags = await searchParams;

  if (!request) notFound();

  const created = Boolean(flags.created);
  const updated = Boolean(flags.updated);
  const error = singleValue(flags.error);
  const isExchange = request.type === "EXCHANGE";
  // The one point where the money actually moves. A refund has nothing to
  // collect, so it reaches this straight from approved; everything else has to
  // have the goods in hand first.
  const canSettle =
    request.status === "RECEIVED" || (request.status === "APPROVED" && request.type === "REFUND");
  const listHref = listPathForType(request.type);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page w-full max-w-full min-w-0 grid-cols-[minmax(0,1fr)]">
        <header className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="m-0 text-[11px] font-semibold uppercase text-[#7c3aed]">
                {orderReturnTypeLabels[request.type as keyof typeof orderReturnTypeLabels] ??
                  request.type}
              </p>
              <h1 className="mt-1.5 flex flex-wrap items-center gap-3 text-[1.75rem] font-semibold leading-tight text-[#20212a]">
                {request.returnNumber}
                <ReturnTypeBadge type={request.type} />
              </h1>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#777985]">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatDate(request.createdAt)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <UserRound className="h-3.5 w-3.5" />
                  {request.customerName}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Link
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#dedcea] bg-white px-3.5 text-xs font-semibold text-[#555762] hover:bg-[#f8f7fc]"
                href={listHref}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
              <Link
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#7c3aed] bg-white px-3.5 text-xs font-semibold text-[#6d3cf5] hover:bg-[#f7f3ff]"
                href={`/dashboard/orders/${request.order.id}`}
              >
                Open {request.order.orderNumber}
              </Link>
              {DELETABLE_STATUSES.includes(request.status) ? (
                <ReturnDeleteButton returnId={request.id} />
              ) : null}
            </div>
          </div>
        </header>

        {created ? <p className="success-message">Request opened.</p> : null}
        {updated ? <p className="success-message">Request updated.</p> : null}
        {error ? <p className="error-message">{error}</p> : null}

        <ReturnStatusCards
          restockItems={request.restockItems}
          status={request.status}
          type={request.type}
        />

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <ReturnRequestCard
            customerName={request.customerName}
            customerPhone={request.customerPhone}
            orderId={request.order.id}
            orderNumber={request.order.orderNumber}
            reason={orderReturnReasonLabels[request.reason as OrderReturnReason] ?? request.reason}
            reasonNote={request.reasonNote}
            refundMethod={
              orderRefundMethodLabels[request.refundMethod as OrderRefundMethod] ??
              request.refundMethod
            }
            refundReference={request.refundReference}
            resolutionNote={request.resolutionNote}
          />
          <ReturnSummaryCard
            dueAmount={
              Number(request.dueAmount) > 0 ? formatMoney(request.dueAmount, request.currency) : ""
            }
            itemsAmount={formatMoney(request.itemsAmount, request.currency)}
            refundAmount={formatMoney(request.refundAmount, request.currency)}
            replacementAmount={formatMoney(request.replacementAmount, request.currency)}
            restockingFee={formatMoney(request.restockingFee, request.currency)}
            shippingRefundAmount={formatMoney(request.shippingRefundAmount, request.currency)}
            showReplacement={isExchange}
          />
        </div>

        <ReturnItemsTable
          items={request.items.map((item) => ({
            id: item.id,
            imageUrl: item.imageUrl,
            quantity: item.quantity,
            replacementQuantity: item.replacementQuantity,
            replacementTitle: item.replacementTitle,
            replacementUnitPrice: item.replacementUnitPrice
              ? formatMoney(item.replacementUnitPrice, request.currency)
              : null,
            sku: item.sku,
            title: item.title,
            total: formatMoney(item.total, request.currency),
            unitPrice: formatMoney(item.unitPrice, request.currency)
          }))}
          showReplacement={isExchange}
        />

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <ReturnTimeline events={timelineFor(request)} />
          <div className="grid items-start gap-4">
            <DetailCard title="Next step">
              <ReturnWorkflowActions
                returnId={request.id}
                status={request.status}
                type={request.type}
              />
            </DetailCard>
            {canSettle ? (
              <DetailCard title="Settle this request">
                <ReturnRefundForm
                  action={recordOrderReturnRefundFormAction.bind(null, request.id)}
                  currency={request.currency}
                  defaultMethod={request.refundMethod}
                  refundAmount={Number(request.refundAmount)}
                />
              </DetailCard>
            ) : null}
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}

type ReturnRecord = NonNullable<Awaited<ReturnType<typeof getOrderReturnByIdForStore>>>;

/**
 * Only the stages this particular request went through.
 *
 * A rejected request never had goods received, and showing it a permanently
 * pending "Goods received" row would read as work still outstanding rather than
 * as a closed case.
 */
function timelineFor(request: ReturnRecord): ReturnTimelineEvent[] {
  const events: ReturnTimelineEvent[] = [{ at: request.createdAt, label: "Request opened" }];

  if (request.rejectedAt) {
    events.push({ at: request.rejectedAt, label: "Rejected" });

    return events;
  }

  if (request.cancelledAt) {
    events.push({ at: request.cancelledAt, label: "Cancelled" });

    return events;
  }

  events.push({ at: request.approvedAt, label: "Approved" });

  if (request.type !== "REFUND") {
    events.push({ at: request.receivedAt, label: "Goods received" });

    if (request.restockItems) {
      events.push({ at: request.restockedAt, label: "Stock put back" });
    }
  }

  if (Number(request.refundAmount) > 0) {
    events.push({ at: request.refundedAt, label: "Refund paid" });
  }

  events.push({ at: request.completedAt, label: "Settled" });

  return events;
}

function listPathForType(type: string) {
  if (type === "EXCHANGE") return "/dashboard/orders/exchanges";
  if (type === "REFUND") return "/dashboard/orders/refunds";

  return "/dashboard/orders/returns";
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function formatMoney(value: unknown, currency: string) {
  return new Intl.NumberFormat("en", { currency, style: "currency" }).format(Number(value));
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value);
}
