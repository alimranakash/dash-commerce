import { isUniqueConstraintError } from "../../lib/prisma-errors";
import {
  createCustomerRecord,
  findCustomerPickRecords,
  getCustomerRecordsForStore,
  listCustomerPhonesForStore
} from "./customer.repository";
import { customerPhoneForStorage, customerPhoneMatchKey } from "./customer-phone";
import { counterCustomerSchema, type CounterCustomerInput } from "./customer.schema";
import type { CustomerSummary } from "./customer.types";

export type CustomerPickRecord = Awaited<ReturnType<typeof findCustomerPickRecords>>[number];

export type CounterCustomerResult =
  | { customer: CustomerPickRecord; status: "created" }
  | { matches: CustomerPickRecord[]; status: "duplicate" };

/**
 * Saves a customer staff typed in at the counter — or, when the store already
 * has one on that number in any spelling, saves nothing and returns them, so
 * the employee picks the existing record instead. Never a merge, never an
 * update of the existing row's name.
 *
 * The look-up before the insert finds other spellings; the unique index on the
 * stored, canonical number is what settles two saves racing on one number. The
 * loser's insert is refused, and it answers with the winner like any duplicate.
 */
export async function createCounterCustomer(
  storeId: string,
  input: CounterCustomerInput
): Promise<CounterCustomerResult> {
  const data = counterCustomerSchema.parse(input);
  const existing = await findCustomersByPhone(storeId, data.phone);

  if (existing.length > 0) {
    return { matches: existing, status: "duplicate" };
  }

  try {
    const customer = await createCustomerRecord({
      name: data.name,
      phone: customerPhoneForStorage(data.phone),
      storeId
    });

    return { customer, status: "created" };
  } catch (error) {
    if (!isUniqueConstraintError(error, "phone")) {
      throw error;
    }

    const matches = await findCustomersByPhone(storeId, data.phone);

    if (matches.length === 0) {
      throw error;
    }

    return { matches, status: "duplicate" };
  }
}

/** This store's customers by id, as a picker shows them. An id from elsewhere finds nothing. */
export function getCustomerPickRecords(storeId: string, customerIds: string[]) {
  return findCustomerPickRecords(storeId, customerIds);
}

/** This store's customers on a number, in whatever spelling each was saved. */
export async function findCustomersByPhone(storeId: string, phone: string) {
  const key = customerPhoneMatchKey(phone);
  const ids = (await listCustomerPhonesForStore(storeId))
    .filter((row) => customerPhoneMatchKey(row.phone) === key)
    .map((row) => row.id);

  return ids.length > 0 ? findCustomerPickRecords(storeId, ids) : [];
}

export async function getCustomersForStore(storeId: string, fallbackCurrency: string): Promise<CustomerSummary> {
  const customers = await getCustomerRecordsForStore(storeId);
  const newCustomerStart = new Date();
  newCustomerStart.setDate(newCustomerStart.getDate() - 30);
  newCustomerStart.setHours(0, 0, 0, 0);

  const rows = customers.map((customer) => ({
    createdAt: customer.createdAt,
    currency: customer.orders[0]?.currency ?? fallbackCurrency,
    email: customer.email,
    id: customer.id,
    lastOrderAt: customer.orders[0]?.createdAt ?? null,
    loyalty:
      customer.loyaltyMember && customer.loyaltyMember.storeId === storeId
        ? {
            points: customer.loyaltyMember.pointsBalance,
            suspended: customer.loyaltyMember.suspendedAt !== null
          }
        : null,
    name: customer.name,
    orderCount: customer.orders.length,
    phone: customer.phone,
    totalSpent: customer.orders.reduce((total, order) => total + Number(order.totalAmount), 0)
  }));
  const totalSpent = rows.reduce((total, customer) => total + customer.totalSpent, 0);

  return {
    metrics: {
      averageValue: rows.length ? totalSpent / rows.length : 0,
      newCustomers: rows.filter((customer) => customer.createdAt >= newCustomerStart).length,
      returning: rows.filter((customer) => customer.orderCount > 1).length,
      total: rows.length
    },
    rows
  };
}
