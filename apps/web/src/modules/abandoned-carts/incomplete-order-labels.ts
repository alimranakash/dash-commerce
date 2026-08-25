import type { IncompleteOrderFailureCode } from "./abandoned-cart.types";

/**
 * Why a checkout was refused, written for the seller.
 *
 * The shopper was already shown a sentence explaining it; this is the phrase a
 * person scanning a table or a report bar can group by. Kept in a file of its
 * own, free of any dependency, because both the dashboard (a client component)
 * and the report service read it.
 */
export const incompleteOrderFailureLabels: Record<IncompleteOrderFailureCode, string> = {
  BLOCKED_IP: "Blocked address",
  COUPON: "Coupon problem",
  EMPTY_CART: "Cart was empty",
  ORDER_LIMIT: "Order limit reached",
  OUT_OF_STOCK: "Out of stock",
  PAYMENT_REFERENCE: "No transaction ID",
  PHONE_VERIFICATION: "Number not verified",
  STORE_LOCKED: "Store locked",
  UNKNOWN: "Other",
  VALIDATION: "Form incomplete"
};
