"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { PlanFeatureError, hasPlanFeature, requirePlanFeature } from "../billing/subscription-limits";
import type { GatedResult, PlanFeatureKey } from "../billing/plan-features";
import { getCurrentUser } from "../../lib/auth";
import { createCounterCustomer, getCustomerPickRecords } from "../customers/customer.service";
import { LoyaltyError } from "../loyalty/loyalty.rules";
import { enrollCustomerAtCounter } from "../loyalty/loyalty.service";
import { errorForLog } from "../notifications/notifications.redact";
import { requireStore } from "../stores/queries";
import { toSaleCustomerOption, type SaleCustomerOption } from "./sale-customer";
import { receiptHref } from "./sale-receipt";
import { createSale, updateSale, voidSale } from "./sale.service";
import type { CreateSaleInput } from "./sale.schema";

export type SaleActionState = {
  lockedFeature?: PlanFeatureKey;
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

/**
 * A completed sale goes on to its receipt — the counter's next screen, with
 * Print and New sale on it — rather than back to the list; a draft or any
 * other status goes to the list as before. Both happen only after `createSale`
 * has committed, so nothing can be printed for a sale that was not saved, and
 * the receipt page only reads it, so printing can never save it twice.
 * "Complete & print receipt" posts `intent=print`, which also opens the
 * dialog once on arrival.
 */
export async function createSaleFormAction(
  _state: SaleActionState,
  formData: FormData
): Promise<SaleActionState> {
  const store = await requireStore();
  let sale: { id: string; status: string };

  try {
    await requirePlanFeature(store.id, "sales");
    sale = await createSale(await contextFromStore(store), saleInputFromFormData(formData));
  } catch (error) {
    return saleErrorState(error);
  }

  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/products");

  if (sale.status === "COMPLETED") {
    redirect(receiptHref(sale.id, { completed: true, print: wantsPrint(formData) }));
  }

  redirect("/dashboard/sales?created=1");
}

export async function updateSaleFormAction(
  saleId: string,
  _state: SaleActionState,
  formData: FormData
): Promise<SaleActionState> {
  const store = await requireStore();
  let status: string;

  try {
    await requirePlanFeature(store.id, "sales");
    const sale = await updateSale(
      await contextFromStore(store),
      saleId,
      saleInputFromFormData(formData)
    );

    if (!sale) {
      return { message: "Sale not found.", status: "error" };
    }

    status = sale.status;
  } catch (error) {
    return saleErrorState(error);
  }

  revalidatePath("/dashboard/sales");
  revalidatePath(`/dashboard/sales/${saleId}`);
  revalidatePath("/dashboard/products");

  if (status === "COMPLETED" && wantsPrint(formData)) {
    redirect(receiptHref(saleId, { print: true }));
  }

  redirect(`/dashboard/sales/${saleId}?updated=1`);
}

export async function voidSaleAction(saleId: string): Promise<GatedResult> {
  const store = await requireStore();

  if (!(await hasPlanFeature(store.id, "sales"))) {
    return { lockedFeature: "sales" };
  }

  await voidSale(await contextFromStore(store), saleId);

  revalidatePath("/dashboard/sales");
  revalidatePath(`/dashboard/sales/${saleId}`);
  revalidatePath("/dashboard/products");
  redirect("/dashboard/sales?voided=1");
}

/*
 * The counter: saving a customer and taking out a membership without leaving
 * the sale form. The picker calls these directly rather than posting them —
 * the sale form is the only form on the page, and a nested one is not allowed —
 * and neither touches the sale. Nothing here revalidates the page either: a
 * refresh would re-read every product and customer while staff are mid-sale,
 * and the picker lays the answer over its own list instead.
 *
 * Both are ordinary work for any team member, like the sale itself. The store
 * and the acting person are the session's; the browser sends a name and a
 * number, or a customer id the service re-checks against this store.
 */

export type SaleCustomerResult =
  | { customer: SaleCustomerOption; status: "created" }
  | { matches: SaleCustomerOption[]; message: string; status: "duplicate" }
  | {
      fieldErrors?: Record<string, string>;
      lockedFeature?: PlanFeatureKey;
      message: string;
      status: "error";
    };

export async function createSaleCustomerAction(input: {
  name: string;
  phone: string;
}): Promise<SaleCustomerResult> {
  const store = await requireStore();

  try {
    await requirePlanFeature(store.id, "sales");
    const result = await createCounterCustomer(store.id, input);

    if (result.status === "created") {
      return { customer: toSaleCustomerOption(store.id, result.customer), status: "created" };
    }

    return {
      matches: result.matches.map((customer) => toSaleCustomerOption(store.id, customer)),
      message:
        "This number is already a customer here. Use that record instead — nothing was saved.",
      status: "duplicate"
    };
  } catch (error) {
    return counterErrorState(
      error,
      "The customer could not be saved. The sale can still go ahead."
    );
  }
}

export type SaleMembershipResult =
  | { customer: SaleCustomerOption; message: string; status: "enrolled" | "existing" }
  | { holder: SaleCustomerOption | null; message: string; status: "conflict" }
  | { lockedFeature?: PlanFeatureKey; message: string; status: "error" };

/**
 * Enrols the chosen customer, on their own yes. Records no opt-in for any sale:
 * earning on this one is still the sale's box, ticked or not.
 */
export async function enrollSaleCustomerAction(customerId: string): Promise<SaleMembershipResult> {
  const store = await requireStore();
  // From the session, never the browser: it is who recorded the customer's yes.
  const userId = (await getCurrentUser())?.id;

  if (!userId) {
    return { message: "Sign in again to add a member.", status: "error" };
  }

  try {
    const enrollment = await enrollCustomerAtCounter(store.id, {
      customerId: String(customerId ?? ""),
      userId
    });

    if (enrollment.action === "ineligible") {
      return {
        message:
          "This customer's phone number can't hold a membership — it needs a valid mobile number. The sale can still be saved.",
        status: "error"
      };
    }

    if (enrollment.action === "conflict") {
      const [holder] = enrollment.holderCustomerId
        ? await saleCustomerOptions(store.id, [enrollment.holderCustomerId])
        : [];

      return {
        holder: holder ?? null,
        message:
          "This number already belongs to a member on a different customer record, so nobody was enrolled and nothing was merged.",
        status: "conflict"
      };
    }

    const [customer] = await saleCustomerOptions(store.id, [String(customerId)]);

    if (!customer) {
      return { message: "That customer does not belong to this store.", status: "error" };
    }

    return {
      customer,
      message:
        enrollment.action === "enrolled"
          ? "Membership active."
          : customer.membership?.status === "suspended"
            ? "Already a member, but the membership is suspended. Nothing was changed."
            : "Already a member. Nothing was changed.",
      status: enrollment.action
    };
  } catch (error) {
    return counterErrorState(
      error,
      "The membership could not be added. The sale can still go ahead."
    );
  }
}

async function saleCustomerOptions(storeId: string, customerIds: string[]) {
  return (await getCustomerPickRecords(storeId, customerIds)).map((customer) =>
    toSaleCustomerOption(storeId, customer)
  );
}

/**
 * A refusal the employee can act on, said as it is; anything else as the
 * fallback, so a database error never reaches the counter screen verbatim.
 */
function counterErrorState(
  error: unknown,
  fallback: string
): Extract<SaleCustomerResult, { status: "error" }> {
  if (error instanceof ZodError) {
    return {
      fieldErrors: Object.fromEntries(
        error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message])
      ),
      message: "Check the customer's name and phone number.",
      status: "error"
    };
  }

  if (error instanceof PlanFeatureError) {
    return { lockedFeature: error.featureKey, message: error.message, status: "error" };
  }

  if (error instanceof LoyaltyError) {
    return { message: error.message, status: "error" };
  }

  console.error(`[sales] counter customer step failed: ${errorForLog(error)}`);

  return { message: fallback, status: "error" };
}

function saleInputFromFormData(formData: FormData): CreateSaleInput {
  const productIds = formData.getAll("productId").map(stringValue);
  const quantities = formData.getAll("quantity").map(stringValue);
  const unitPrices = formData.getAll("unitPrice").map(stringValue);
  const discounts = formData.getAll("itemDiscount").map(stringValue);
  // Every row posts one, blank for a product without options, so the lists line up.
  const variantIds = formData.getAll("variantId").map(stringValue);
  const rowCount = Math.max(productIds.length, quantities.length, unitPrices.length);

  return {
    customerId: optionalValue(formData.get("customerId")),
    discount: stringValue(formData.get("discount")) || "0",
    items: Array.from({ length: rowCount }, (_, index) => ({
      discount: discounts[index] || "0",
      productId: productIds[index] ?? "",
      quantity: Number(quantities[index] || 1),
      unitPrice: unitPrices[index] || "0",
      variantId: variantIds[index] || undefined
    })).filter((item) => item.productId),
    loyaltyOptIn: loyaltyOptInFromFormData(formData),
    notes: optionalValue(formData.get("notes")),
    paidAmount: stringValue(formData.get("paidAmount")) || "0",
    paymentMethod: stringValue(formData.get("paymentMethod")) as CreateSaleInput["paymentMethod"],
    saleDate: stringValue(formData.get("saleDate")),
    saleType: stringValue(formData.get("saleType")) as CreateSaleInput["saleType"],
    shipping: stringValue(formData.get("shipping")) || "0",
    status: stringValue(formData.get("status")) as CreateSaleInput["status"],
    tax: stringValue(formData.get("tax")) || "0"
  };
}

/** The "Complete & print receipt" button: a submitter value, never a field the sale stores. */
function wantsPrint(formData: FormData) {
  return formData.get("intent") === "print";
}

async function contextFromStore(store: { id: string; organizationId: string }) {
  return {
    organizationId: store.organizationId,
    storeId: store.id,
    // From the session, never the form: it is who recorded a loyalty opt-in.
    userId: (await getCurrentUser())?.id ?? null
  };
}

/**
 * The loyalty box as the form posted it. The marker says the box was shown, so
 * an unticked box is a withdrawal; without it the form had no box to tick and
 * the sale's opt-in is left as it was.
 */
function loyaltyOptInFromFormData(formData: FormData): CreateSaleInput["loyaltyOptIn"] {
  if (formData.get("loyaltyOptInShown") !== "1") {
    return "keep";
  }

  return formData.get("loyaltyOptIn") === "on" ? "in" : "out";
}

function stringValue(value: FormDataEntryValue | null | undefined) {
  return String(value ?? "").trim();
}

function optionalValue(value: FormDataEntryValue | null | undefined) {
  const next = stringValue(value);
  return next || undefined;
}

function saleErrorState(error: unknown): SaleActionState {
  if (error instanceof ZodError) {
    return {
      fieldErrors: Object.fromEntries(
        error.issues.map((issue) => [issue.path.length ? String(issue.path[0]) : "form", issue.message])
      ),
      message: "Please fix the highlighted sale fields.",
      status: "error"
    };
  }

  return {
    message: error instanceof Error ? error.message : "Sale operation failed.",
    status: "error",
    ...(error instanceof PlanFeatureError ? { lockedFeature: error.featureKey } : {})
  };
}
