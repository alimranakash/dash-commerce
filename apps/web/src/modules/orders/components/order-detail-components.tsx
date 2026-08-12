import { Building2, CircleDollarSign, Clock3, ImageIcon, Mail, MapPin, Package, Phone, Truck, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { OrderQuickActions } from "./order-detail-actions";
import { OrderStatusBadge } from "./order-status-badge";

export type OrderAddressView = {
  addressLine1: string;
  addressLine2?: string | null;
  area?: string | null;
  city?: string | null;
  country: string;
  district: string;
};

export function OrderStatusCards({ fulfillmentStatus, orderStatus, paymentStatus }: { fulfillmentStatus: string; orderStatus: string; paymentStatus: string }) {
  return <div className="grid gap-3 sm:grid-cols-3"><StatusCard icon={Package} label="Order Status" status={orderStatus} /><StatusCard icon={CircleDollarSign} label="Payment Status" status={paymentStatus} /><StatusCard icon={Truck} label="Fulfillment Status" status={fulfillmentStatus} /></div>;
}

export function CustomerCard({ billingAddress, email, name, phone, shippingAddress }: { billingAddress: OrderAddressView | null; email: string | null; name: string; phone: string; shippingAddress: OrderAddressView | null }) {
  const initials = name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return <DetailCard title="Customer"><div className="flex items-center gap-3 border-b border-[#efeff5] pb-4"><span className="grid h-12 w-12 place-items-center rounded-full bg-[#eee9ff] text-sm font-bold text-[#6d3cf5]">{initials || <UserRound className="h-5 w-5" />}</span><div><strong className="text-sm">{name}</strong><span className="mt-1 flex items-center gap-1.5 text-xs text-[#777985]"><Mail className="h-3.5 w-3.5" />{email ?? "No email provided"}</span><span className="mt-1 flex items-center gap-1.5 text-xs text-[#777985]"><Phone className="h-3.5 w-3.5" />{phone}</span></div></div><div className="grid gap-4 pt-4 md:grid-cols-2"><AddressBlock address={shippingAddress} label="Shipping Address" /><AddressBlock address={billingAddress} label="Billing Address" /></div></DetailCard>;
}

export function OrderSummaryCard({ discount, shipping, subtotal, tax, total }: { discount: string; shipping: string; subtotal: string; tax: string; total: string }) {
  return <DetailCard title="Order Summary"><dl className="grid grid-cols-[1fr_auto] gap-x-5 gap-y-3 text-xs"><dt className="text-[#777985]">Subtotal</dt><dd className="m-0 font-medium">{subtotal}</dd><dt className="text-[#777985]">Shipping</dt><dd className="m-0 font-medium">{shipping}</dd><dt className="text-[#777985]">Discount</dt><dd className="m-0 font-medium text-emerald-700">-{discount}</dd><dt className="text-[#777985]">Tax</dt><dd className="m-0 font-medium">{tax}</dd><dt className="mt-2 border-t border-[#ececf5] pt-4 text-sm font-semibold">Total</dt><dd className="m-0 mt-2 border-t border-[#ececf5] pt-4 text-xl font-bold text-[#6d3cf5]">{total}</dd></dl></DetailCard>;
}

export function PaymentCard({ method, paymentDate, reference, status }: { method: string; paymentDate: string; reference: string | null; status: string }) {
  return <DetailCard icon={CircleDollarSign} title="Payment"><InfoRows rows={[["Method", method], ["Transaction ID", reference ?? "Not provided"], ["Payment Status", <OrderStatusBadge key="status" status={status} />], ["Payment Date", paymentDate]]} /></DetailCard>;
}

// The old ShippingCard lived here with hardcoded "Not booked" / "Not assigned"
// rows. It is replaced by modules/courier/components/courier-card.tsx, which
// renders the same shipping method and cost alongside the real booking.

export function OrderItemsTable({ currency, items }: { currency: string; items: Array<{ id: string; imageUrl: string | null; price: number; quantity: number; sku: string | null; title: string; total: number }> }) {
  return <section className="min-w-0 overflow-hidden rounded-xl border border-[#ececf5] bg-white shadow-[0_8px_24px_rgba(62,54,114,0.04)]"><header className="border-b border-[#ececf5] px-5 py-4"><h2 className="m-0 text-sm font-semibold">Ordered Products</h2></header><div className="max-w-full overflow-x-auto p-4"><table className="w-full min-w-[760px] border-collapse text-left text-xs"><thead className="bg-[#f7f7fa] text-[#5f616d]"><tr><th className="p-3">Product Image</th><th className="p-3">Product Name</th><th className="p-3">SKU</th><th className="p-3">Price</th><th className="p-3">Quantity</th><th className="p-3 text-right">Total</th></tr></thead><tbody>{items.map((item) => <tr className="border-b border-[#efeff5] transition hover:bg-[#faf9ff]" key={item.id}><td className="p-3"><span className="grid h-11 w-11 place-items-center overflow-hidden rounded-lg border border-[#ecebf2] bg-[#fafafa]">{item.imageUrl ? <img alt={item.title} className="h-full w-full object-cover" src={item.imageUrl} /> : <ImageIcon className="h-4 w-4 text-[#b6b7c0]" />}</span></td><td className="p-3 font-semibold">{item.title}</td><td className="p-3 text-[#686a76]">{item.sku ?? "-"}</td><td className="p-3">{formatMoney(item.price, currency)}</td><td className="p-3">{item.quantity}</td><td className="p-3 text-right font-semibold">{formatMoney(item.total, currency)}</td></tr>)}</tbody></table></div></section>;
}

export function OrderTimeline({ createdAt, fulfillmentStatus, orderStatus, paymentStatus, updatedAt }: { createdAt: Date; fulfillmentStatus: string; orderStatus: string; paymentStatus: string; updatedAt: Date }) {
  const events = [
    { active: true, label: "Order Created", time: createdAt },
    { active: ["PAID", "REFUNDED"].includes(paymentStatus), label: "Payment Received", time: updatedAt },
    { active: ["PROCESSING", "COMPLETED"].includes(orderStatus), label: "Processing Started", time: updatedAt },
    { active: fulfillmentStatus === "FULFILLED", label: "Shipped", time: updatedAt },
    { active: fulfillmentStatus === "FULFILLED" && orderStatus === "COMPLETED", label: "Delivered", time: updatedAt }
  ];
  return <DetailCard icon={Clock3} title="Order Timeline"><ol className="grid gap-0">{events.map((event, index) => <li className="relative grid grid-cols-[24px_1fr] gap-3 pb-5 last:pb-0" key={event.label}><span className={`relative z-10 mt-0.5 h-3 w-3 rounded-full ring-4 ${event.active ? "bg-[#7548f5] ring-[#eee9ff]" : "bg-[#d5d4dc] ring-[#f2f2f5]"}`} />{index < events.length - 1 ? <span className="absolute left-[5px] top-3 h-full w-px bg-[#e5e3ed]" /> : null}<div><strong className={`text-xs ${event.active ? "text-[#292a34]" : "text-[#92939d]"}`}>{event.label}</strong><span className="mt-1 block text-[10px] text-[#92939d]">{event.active ? formatDate(event.time) : "Pending"}</span></div></li>)}</ol></DetailCard>;
}

export function QuickActionsCard({ courierLabel, hasShipment, orderId, sendDisabledReason }: { courierLabel: string; hasShipment: boolean; orderId: string; sendDisabledReason?: string | undefined }) {
  return <DetailCard title="Quick Actions"><OrderQuickActions courierLabel={courierLabel} hasShipment={hasShipment} orderId={orderId} {...(sendDisabledReason ? { sendDisabledReason } : {})} /></DetailCard>;
}

function StatusCard({ icon: Icon, label, status }: { icon: typeof Package; label: string; status: string }) { return <article className="rounded-xl border border-[#ececf5] bg-white p-4 shadow-[0_8px_24px_rgba(62,54,114,0.04)]"><div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-xs font-semibold text-[#555762]"><span className="grid h-8 w-8 place-items-center rounded-md bg-[#f0ebff] text-[#7548f5]"><Icon className="h-4 w-4" /></span>{label}</span><OrderStatusBadge status={status} /></div></article>; }
function DetailCard({ children, icon: Icon = Building2, title }: { children: ReactNode; icon?: typeof Building2; title: string }) { return <section className="overflow-hidden rounded-xl border border-[#ececf5] bg-white shadow-[0_8px_24px_rgba(62,54,114,0.04)]"><header className="flex items-center gap-2.5 border-b border-[#ececf5] px-5 py-4"><span className="grid h-8 w-8 place-items-center rounded-md bg-[#f0ebff] text-[#7548f5]"><Icon className="h-4 w-4" /></span><h2 className="m-0 text-sm font-semibold">{title}</h2></header><div className="p-5">{children}</div></section>; }
function AddressBlock({ address, label }: { address: OrderAddressView | null; label: string }) { return <div><strong className="flex items-center gap-1.5 text-xs"><MapPin className="h-3.5 w-3.5 text-[#7548f5]" />{label}</strong>{address ? <address className="mt-2 grid gap-1 text-xs not-italic leading-5 text-[#777985]"><span>{address.addressLine1}</span>{address.addressLine2 ? <span>{address.addressLine2}</span> : null}<span>{[address.area, address.city, address.district].filter(Boolean).join(", ")}</span><span>{address.country}</span></address> : <p className="mt-2 text-xs text-[#92939d]">Same as customer details / not provided.</p>}</div>; }
function InfoRows({ rows }: { rows: Array<[string, ReactNode]> }) { return <dl className="grid grid-cols-[minmax(110px,0.7fr)_minmax(0,1fr)] gap-x-5 gap-y-4 text-xs">{rows.map(([label, value]) => <div className="contents" key={label}><dt className="text-[#777985]">{label}</dt><dd className="m-0 font-medium text-[#292a34]">{value}</dd></div>)}</dl>; }
function formatMoney(value: number, currency: string) { return new Intl.NumberFormat("en", { currency, style: "currency" }).format(value); }
function formatDate(value: Date) { return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value); }
