import { Plus } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { FeatureGate } from "../../billing/components/feature-gate";
import { requireStore } from "../../stores/queries";
import { getOrderReturnsForStore } from "../return.service";
import type { OrderReturnReason, OrderReturnType } from "../return.schema";
import {
  orderReturnReasonLabels,
  orderReturnTypeFeatures,
  type OrderReturnListItem
} from "../return.types";
import {
  matchesReturnFilter,
  parseReturnFilter,
  ReturnListControls,
  type ReturnFilterKey
} from "./return-list-controls";
import { ReturnsTable, type ReturnRow } from "./returns-table";

type ReturnsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  type: OrderReturnType;
};

const copy: Record<OrderReturnType, { blurb: string; emptyHint: string; title: string }> = {
  EXCHANGE: {
    blurb:
      "Goods coming back for a swap. Only the price difference moves: the replacement leaves stock when you settle the request.",
    emptyHint: "Open one from an order when a customer wants a different size, colour or model.",
    title: "Exchanges"
  },
  REFUND: {
    blurb:
      "Money going back with nothing to collect — a goodwill gesture, a discount after a complaint, a delivery that never arrived.",
    emptyHint: "Open one from an order when you owe a customer money but no goods are coming back.",
    title: "Refunds"
  },
  RETURN: {
    blurb:
      "Goods coming back for a refund. Approve the request, mark the parcel received, and the stock goes back on the shelf.",
    emptyHint: "Open one from an order when a customer sends something back.",
    title: "Returns"
  }
};

/**
 * The Return, Exchange and Refund pages.
 *
 * All three are this component over a different `type`: the columns, the filters
 * and the workflow are identical, and only the wording and which slice of the
 * table is listed change.
 */
export async function ReturnsPage({ searchParams, type }: ReturnsPageProps) {
  const store = await requireStore();
  const requests = await getOrderReturnsForStore(store.id, type);
  const params = await searchParams;
  const activeFilter = parseReturnFilter(singleValue(params.status));
  const search = singleValue(params.search).trim();
  const dateFrom = singleValue(params.dateFrom).trim();
  const dateTo = singleValue(params.dateTo).trim();
  const deleted = Boolean(params.deleted);
  const scoped = requests.filter(
    (request) => matchesSearch(request, search) && matchesDateRange(request, dateFrom, dateTo)
  );
  const counts = countByFilter(scoped);
  const rows: ReturnRow[] = scoped
    .filter((request) => matchesReturnFilter(request.status, activeFilter))
    .map((request) => ({
      createdAt: formatDate(request.createdAt),
      customerName: request.customerName,
      customerPhone: request.customerPhone,
      dueAmount:
        Number(request.dueAmount) > 0 ? formatMoney(request.dueAmount, request.currency) : null,
      id: request.id,
      itemSummary: summariseItems(request),
      orderId: request.order.id,
      orderNumber: request.order.orderNumber,
      reason: orderReturnReasonLabels[request.reason as OrderReturnReason] ?? request.reason,
      refundAmount: formatMoney(request.refundAmount, request.currency),
      returnNumber: request.returnNumber,
      status: request.status,
      type: request.type
    }));
  const page = copy[type];
  const basePath = basePathForType(type);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="catalog-page-heading">
          <div className="flex items-center gap-3">
            <h1>{page.title}</h1>
            {/*
              The list stays readable on every plan — a seller should be able to
              see what they are being offered — and only opening a request is
              entitled. `createOrderReturnFormAction` checks again on submit.
            */}
            <FeatureGate feature={orderReturnTypeFeatures[type]} storeId={store.id}>
              <Link
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#7c3aed] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#6d28d9]"
                href={`/dashboard/orders/returns/new?type=${type}`}
              >
                <Plus className="h-3.5 w-3.5" />
                New {page.title.toLowerCase().replace(/s$/, "")}
              </Link>
            </FeatureGate>
          </div>
        </div>
        <p className="m-0 max-w-3xl text-xs leading-5 text-[#777985]">{page.blurb}</p>
        {deleted ? <p className="success-message">Request deleted.</p> : null}
        <ReturnListControls
          activeFilter={activeFilter}
          basePath={basePath}
          counts={counts}
          dateFrom={dateFrom}
          dateTo={dateTo}
          search={search}
        />
        {rows.length === 0 ? (
          <div className="empty-state">
            <h2>
              {requests.length ? "No matching requests" : `No ${page.title.toLowerCase()} yet`}
            </h2>
            <p>
              {requests.length ? "Try another stage, date range, or search term." : page.emptyHint}
            </p>
          </div>
        ) : (
          <ReturnsTable rows={rows} showType={false} />
        )}
      </section>
    </DashboardShell>
  );
}

export function basePathForType(type: OrderReturnType) {
  if (type === "EXCHANGE") return "/dashboard/orders/exchanges";
  if (type === "REFUND") return "/dashboard/orders/refunds";

  return "/dashboard/orders/returns";
}

function countByFilter(requests: OrderReturnListItem[]): Record<ReturnFilterKey, number> {
  const keys: ReturnFilterKey[] = ["all", "open", "approved", "received", "completed", "closed"];

  return keys.reduce(
    (counts, key) => {
      counts[key] = requests.filter((request) => matchesReturnFilter(request.status, key)).length;

      return counts;
    },
    {} as Record<ReturnFilterKey, number>
  );
}

function summariseItems(request: OrderReturnListItem) {
  if (request.items.length === 0) return "No items";

  const units = request.items.reduce((sum, item) => sum + item.quantity, 0);
  const first = request.items[0];
  const rest = request.items.length - 1;

  return rest > 0
    ? `${units} units · ${first?.title ?? ""} +${rest} more`
    : `${units} × ${first?.title ?? ""}`;
}

function matchesSearch(request: OrderReturnListItem, search: string) {
  if (!search) return true;

  const query = search.toLowerCase();

  return [
    request.returnNumber,
    request.order.orderNumber,
    request.customerName,
    request.customerPhone
  ].some((value) => value?.toLowerCase().includes(query));
}

function matchesDateRange(request: OrderReturnListItem, dateFrom: string, dateTo: string) {
  const created = request.createdAt.getTime();
  const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
  const to = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;

  if (from && !Number.isNaN(from.getTime()) && created < from.getTime()) return false;
  if (to && !Number.isNaN(to.getTime()) && created > to.getTime()) return false;

  return true;
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
