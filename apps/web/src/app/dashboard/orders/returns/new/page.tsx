import { Search } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "../../../../../components/dashboard/dashboard-shell";
import { DashboardQueryForm } from "../../../../../components/dashboard/dashboard-query-form";
import { getProductsForStore } from "../../../../../modules/products/product.service";
import { createOrderReturnFormAction } from "../../../../../modules/returns/return.actions";
import {
  ReturnCreateForm,
  type ReturnFormOrderLine,
  type ReturnFormProductOption
} from "../../../../../modules/returns/components/return-create-form";
import {
  orderReturnTypeSchema,
  type OrderReturnType
} from "../../../../../modules/returns/return.schema";
import {
  getReturnableOrderForStore,
  getReturnableOrdersForStore,
  getReturnedQuantitiesByOrderItem
} from "../../../../../modules/returns/return.service";
import { orderReturnTypeLabels } from "../../../../../modules/returns/return.types";
import { requireStore } from "../../../../../modules/stores/queries";

type NewReturnPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Opening a request is two screens, not one: pick the order, then price the
 * settlement.
 *
 * The order is chosen by navigation rather than by a client-side dropdown so the
 * server can load exactly one order's lines and their remaining quantities.
 * Shipping every order's items to the browser to make a picker work would be a
 * lot of payload for a page that only ever uses one of them.
 */
export default async function NewReturnPage({ searchParams }: NewReturnPageProps) {
  const store = await requireStore();
  const params = await searchParams;
  const parsedType = orderReturnTypeSchema.safeParse(singleValue(params.type));
  const type: OrderReturnType = parsedType.success ? parsedType.data : "RETURN";
  const orderId = singleValue(params.orderId).trim();
  const search = singleValue(params.search).trim();
  const backHref = listPathForType(type);

  if (!orderId) {
    return (
      <OrderPicker
        backHref={backHref}
        search={search}
        storeSlug={store.slug}
        orders={(await getReturnableOrdersForStore(store.id))
          .filter((order) => matchesOrderSearch(order, search))
          .slice(0, 50)
          .map((order) => ({
            createdAt: formatDate(order.createdAt),
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            id: order.id,
            orderNumber: order.orderNumber,
            total: formatMoney(order.totalAmount, order.currency)
          }))}
        type={type}
      />
    );
  }

  const order = await getReturnableOrderForStore(store.id, orderId);

  if (!order) notFound();

  const [alreadyReturned, products] = await Promise.all([
    getReturnedQuantitiesByOrderItem(store.id, order.id),
    getProductsForStore(store.id)
  ]);

  const lines: ReturnFormOrderLine[] = order.items.map((item) => ({
    id: item.id,
    imageUrl: item.imageUrl,
    productId: item.productId,
    quantity: item.quantity,
    remaining: Math.max(0, item.quantity - (alreadyReturned.get(item.id) ?? 0)),
    sku: item.sku,
    title: item.title,
    unitPrice: String(item.price)
  }));

  // Archived products cannot be sold, so they cannot be handed over as a
  // replacement either — same rule the manual order form applies.
  const replacementOptions: ReturnFormProductOption[] = products
    .filter((product) => product.status !== "ARCHIVED")
    .map((product) => ({
      id: product.id,
      price: String(product.price),
      sku: product.sku,
      stockQuantity: product.stockQuantity,
      title: product.title
    }));

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Orders</p>
            <h1>New {orderReturnTypeLabels[type].toLowerCase()}</h1>
            <p className="auth-copy">
              Against order {order.orderNumber} for {order.customerName}. Nothing moves in stock or
              in money until you approve the request and settle it.
            </p>
          </div>
          <Link
            className="secondary link-button"
            href={`/dashboard/orders/returns/new?type=${type}`}
          >
            Change order
          </Link>
        </div>
        <div className="panel-card">
          <ReturnCreateForm
            action={createOrderReturnFormAction}
            cancelHref={backHref}
            currency={order.currency}
            defaultType={type}
            lines={lines}
            orderId={order.id}
            orderNumber={order.orderNumber}
            products={replacementOptions}
            shippingAmount={String(order.shippingAmount)}
          />
        </div>
      </section>
    </DashboardShell>
  );
}

type PickerOrder = {
  createdAt: string;
  customerName: string;
  customerPhone: string;
  id: string;
  orderNumber: string;
  total: string;
};

function OrderPicker({
  backHref,
  orders,
  search,
  storeSlug,
  type
}: {
  backHref: string;
  orders: PickerOrder[];
  search: string;
  storeSlug: string;
  type: OrderReturnType;
}) {
  return (
    <DashboardShell storeSlug={storeSlug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Orders</p>
            <h1>New {orderReturnTypeLabels[type].toLowerCase()}</h1>
            <p className="auth-copy">
              Which order is this about? Search by order number, name, or phone.
            </p>
          </div>
          <Link className="secondary link-button" href={backHref}>
            Back
          </Link>
        </div>

        <DashboardQueryForm
          actionPath="/dashboard/orders/returns/new"
          className="flex w-full flex-col gap-3 sm:flex-row sm:items-center"
        >
          <input name="type" type="hidden" value={type} />
          <input
            aria-label="Search orders"
            className="h-11 min-w-0 flex-1 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6]"
            defaultValue={search}
            name="search"
            placeholder="Order number, customer name, or phone"
            type="search"
          />
          <button
            aria-label="Search orders"
            className="grid h-11 w-full shrink-0 place-items-center rounded-lg bg-[#7548f5] text-white transition hover:bg-[#6436e8] sm:w-11"
            type="submit"
          >
            <Search aria-hidden="true" className="h-4 w-4" />
          </button>
        </DashboardQueryForm>

        {orders.length === 0 ? (
          <div className="empty-state">
            <h2>No matching orders</h2>
            <p>Try another order number, customer name, or phone number.</p>
          </div>
        ) : (
          <section className="min-w-0 overflow-hidden rounded-xl border border-[#ececf5] bg-white shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
            <ul className="m-0 grid list-none gap-0 p-0">
              {orders.map((order) => (
                <li className="border-b border-[#efeff5] last:border-b-0" key={order.id}>
                  <Link
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-xs transition hover:bg-[#faf9ff]"
                    href={`/dashboard/orders/returns/new?type=${type}&orderId=${order.id}`}
                  >
                    <span>
                      <strong className="block text-sm font-semibold text-[#6d3cf5]">
                        {order.orderNumber}
                      </strong>
                      <span className="text-[#777985]">{order.createdAt}</span>
                    </span>
                    <span>
                      <strong className="block font-semibold text-[#292a34]">
                        {order.customerName}
                      </strong>
                      <span className="text-[#777985]">{order.customerPhone}</span>
                    </span>
                    <strong className="font-semibold text-[#292a34]">{order.total}</strong>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>
    </DashboardShell>
  );
}

function listPathForType(type: OrderReturnType) {
  if (type === "EXCHANGE") return "/dashboard/orders/exchanges";
  if (type === "REFUND") return "/dashboard/orders/refunds";

  return "/dashboard/orders/returns";
}

function matchesOrderSearch(
  order: { customerName: string; customerPhone: string; orderNumber: string },
  search: string
) {
  if (!search) return true;

  const query = search.toLowerCase();

  return [order.orderNumber, order.customerName, order.customerPhone].some((value) =>
    value.toLowerCase().includes(query)
  );
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
