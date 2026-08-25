"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { markIncompleteOrderConverted } from "../abandoned-carts/abandoned-cart.service";
import type { PaymentMethodTypeValue } from "../payments/payment.schema";
import { requireStore } from "../stores/queries";
import type { CreateManualOrderInput } from "./order-create.schema";
import { createManualOrder } from "./order-create.service";
import { sendCustomOrderSms, sendOrderConfirmationSms } from "./order-sms.service";
import type { FulfillmentStatus } from "./order.repository";
import type { UpdateOrderDetailsInput } from "./order.schema";
import {
  updateOrderDetails,
  updateOrderFulfillmentStatus,
  updateOrderPaymentStatus,
  updateOrderStatus
} from "./order.service";

type OrderStatusUpdate = "CANCELLED" | "COMPLETED" | "PROCESSING";
type PaymentStatusUpdate = "PAID";

export async function updateOrderStatusFormAction(orderId: string, status: OrderStatusUpdate) {
  const store = await requireStore();

  await updateOrderStatus(store.id, orderId, status);

  revalidateOrderPaths(orderId);
  redirect(`/dashboard/orders/${orderId}?updated=1`);
}

/**
 * The seller's explicit fulfillment override.
 *
 * Phase 0 stopped deriving fulfillmentStatus from the order-status buttons, and
 * the courier layer only projects it from a shipment in Phase 2 — so until then
 * this is how an order gets marked fulfilled without claiming a delivery that
 * no carrier confirmed.
 */
export async function updateFulfillmentStatusFormAction(
  orderId: string,
  fulfillmentStatus: FulfillmentStatus
) {
  const store = await requireStore();

  await updateOrderFulfillmentStatus(store.id, orderId, fulfillmentStatus);

  revalidateOrderPaths(orderId);
  redirect(`/dashboard/orders/${orderId}?updated=1`);
}

export async function updatePaymentStatusFormAction(orderId: string, status: PaymentStatusUpdate) {
  const store = await requireStore();

  await updateOrderPaymentStatus(store.id, orderId, status);

  revalidateOrderPaths(orderId);
  redirect(`/dashboard/orders/${orderId}?updated=1`);
}

export type OrderDetailsActionState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

/**
 * The correction path for an order a shopper filled in wrong — a misspelt name,
 * a phone digit short, a delivery address that would never be found.
 *
 * Unlike the status buttons above this is a full form, so it returns an error
 * state instead of redirecting: a rejected phone number has to come back to the
 * field the seller was typing in.
 */
export async function updateOrderDetailsFormAction(
  orderId: string,
  _state: OrderDetailsActionState,
  formData: FormData
): Promise<OrderDetailsActionState> {
  const store = await requireStore();

  try {
    const order = await updateOrderDetails(store.id, orderId, orderDetailsFromFormData(formData));

    if (!order) {
      return {
        status: "error",
        message: "Order not found."
      };
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        status: "error",
        message: "Please fix the highlighted fields.",
        fieldErrors: Object.fromEntries(
          error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message])
        )
      };
    }

    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not update this order."
    };
  }

  revalidateOrderPaths(orderId);
  redirect(`/dashboard/orders/${orderId}?updated=1`);
}

/**
 * The dashboard's own way of taking an order — the phone call, the Messenger
 * thread, the customer standing at the counter.
 *
 * Returns an error state rather than redirecting on failure for the same reason
 * the edit form does: a rejected phone number or a product that ran out has to
 * come back to a form the seller has already spent a minute filling in.
 */
export async function createOrderFormAction(
  _state: OrderDetailsActionState,
  formData: FormData
): Promise<OrderDetailsActionState> {
  const store = await requireStore();
  // Set when the seller reached this form from the incomplete orders list.
  const incompleteOrderId = getValue(formData, "incompleteOrderId");
  let createdOrderId: string;

  try {
    const { order, sendSms } = await createManualOrder(store, manualOrderFromFormData(formData));

    createdOrderId = order.id;

    // Straight after the order commits and before the SMS: a snapshot left on
    // the incomplete list has the seller ringing a customer who has already
    // bought, which is a worse failure than a confirmation that did not send.
    if (incompleteOrderId) {
      await markIncompleteOrderConverted(store.id, incompleteOrderId, order);
    }

    if (sendSms) {
      // Same contract as the storefront checkout: the order is already
      // committed, so neither sender may turn a saved order into a failure.
      // Each store toggle still decides whether anything actually goes out.
      await Promise.all([
        sendOrderConfirmationSms({
          currency: store.currency,
          orderNumber: order.orderNumber,
          phone: order.customerPhone,
          storeId: store.id,
          storeName: store.name,
          total: Number(order.totalAmount)
        }).catch(() => undefined),
        sendCustomOrderSms({
          currency: store.currency,
          customerName: order.customerName,
          orderNumber: order.orderNumber,
          phone: order.customerPhone,
          storeId: store.id,
          storeName: store.name,
          total: Number(order.totalAmount)
        }).catch(() => undefined)
      ]);
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        status: "error",
        message: "Please fix the highlighted fields.",
        fieldErrors: Object.fromEntries(
          error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message])
        )
      };
    }

    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not create this order."
    };
  }

  revalidateOrderPaths(createdOrderId);
  // Stock moved, so the catalog counts on these pages are now stale.
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/inventory");

  if (incompleteOrderId) {
    revalidatePath("/dashboard/orders/incomplete");
  }

  redirect(`/dashboard/orders/${createdOrderId}?created=1`);
}

function manualOrderFromFormData(formData: FormData): CreateManualOrderInput {
  return {
    addressLine1: getValue(formData, "addressLine1"),
    addressLine2: optionalValue(formData, "addressLine2"),
    area: optionalValue(formData, "area"),
    city: optionalValue(formData, "city"),
    country: getValue(formData, "country") || "Bangladesh",
    customerEmail: optionalValue(formData, "customerEmail"),
    customerName: getValue(formData, "customerName"),
    customerPhone: getValue(formData, "customerPhone"),
    discountAmount: getValue(formData, "discountAmount"),
    district: getValue(formData, "district"),
    items: manualOrderLinesFromFormData(formData),
    notes: optionalValue(formData, "notes"),
    paymentMethod: getValue(formData, "paymentMethod") as PaymentMethodTypeValue,
    paymentNote: optionalValue(formData, "paymentNote"),
    paymentReference: optionalValue(formData, "paymentReference"),
    paymentStatus: getValue(formData, "paymentStatus") === "PAID" ? "PAID" : "PENDING",
    postalCode: optionalValue(formData, "postalCode"),
    sendSms: formData.get("sendSms") === "on",
    shippingAmount: getValue(formData, "shippingAmount"),
    shippingRateId: optionalValue(formData, "shippingRateId"),
    status: getValue(formData, "status") as CreateManualOrderInput["status"]
  };
}

/**
 * The order lines arrive as one JSON field rather than as indexed inputs.
 *
 * The cart the seller builds is edited in the browser — rows added, removed,
 * re-priced — and `items[3][price]` names would have to be renumbered on every
 * removal, with a half-renumbered form silently posting the wrong basket. One
 * hidden field the client keeps in sync cannot get into that state. Nothing here
 * is trusted: every line goes through `manualOrderItemSchema` in the service.
 */
function manualOrderLinesFromFormData(formData: FormData): CreateManualOrderInput["items"] {
  try {
    const parsed: unknown = JSON.parse(String(formData.get("items") ?? "[]"));

    return Array.isArray(parsed) ? (parsed as CreateManualOrderInput["items"]) : [];
  } catch {
    return [];
  }
}

function orderDetailsFromFormData(formData: FormData): UpdateOrderDetailsInput {
  return {
    addressLine1: getValue(formData, "addressLine1"),
    addressLine2: optionalValue(formData, "addressLine2"),
    area: optionalValue(formData, "area"),
    city: optionalValue(formData, "city"),
    country: getValue(formData, "country") || "Bangladesh",
    customerEmail: optionalValue(formData, "customerEmail"),
    customerName: getValue(formData, "customerName"),
    customerPhone: getValue(formData, "customerPhone"),
    district: getValue(formData, "district"),
    notes: optionalValue(formData, "notes"),
    postalCode: optionalValue(formData, "postalCode")
  };
}

function getValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalValue(formData: FormData, key: string) {
  const value = getValue(formData, key);

  return value || undefined;
}

function revalidateOrderPaths(orderId: string) {
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/orders/verification");
  revalidatePath("/dashboard/customers");
  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath(`/dashboard/orders/${orderId}/edit`);
}
