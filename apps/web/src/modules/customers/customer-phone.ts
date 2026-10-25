import { normalizeBangladeshPhone } from "../courier/courier-phone";
import { loyaltyPhoneKey } from "../loyalty/loyalty.rules";

/**
 * How a customer's number is stored and compared when staff add one by hand.
 * Pure and dependency-light, because the sale form's picker runs the same
 * comparison in the browser before it asks the server.
 */

/**
 * What the counter stores as the customer's number: a Bangladesh mobile in its
 * canonical `01XXXXXXXXX`, anything else as typed.
 *
 * Canonical on purpose. `Customer` is unique on `(storeId, phone)` exactly as
 * written, so storing one spelling is what lets that index refuse two staff
 * saving the same number at once — the check before the insert cannot.
 */
export function customerPhoneForStorage(phone: string) {
  return normalizeBangladeshPhone(phone) ?? phone.trim();
}

/**
 * The key two numbers are compared on when looking for an existing customer:
 * the loyalty phone key, so `01712…`, `+8801712…` and `017-12…` are one
 * customer here exactly as they are one membership. A number the key cannot
 * read falls back to its bare digits rather than matching nothing.
 */
export function customerPhoneMatchKey(phone: string) {
  return loyaltyPhoneKey(phone) ?? phone.replace(/\D/g, "");
}
