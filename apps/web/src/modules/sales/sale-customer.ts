import { maskPhone } from "../ai/ai-redact";
import { customerPhoneMatchKey } from "../customers/customer-phone";
import { loyaltyPhoneSearchDigits } from "../loyalty/loyalty.rules";

/**
 * The customer picker on a sale: who can be chosen, and what is shown about
 * them. Pure, so the server builds the options, the browser searches them and
 * `verify-loyalty` drives both without a database.
 *
 * A loyalty member *is* a customer — `LoyaltyMember.customerId` — so choosing
 * a member for a sale means choosing their customer record, and the sale keeps
 * nothing but `Sale.customerId`. The form posts that id alone; the service
 * checks it belongs to the store, and the membership shown beside it is read on
 * the server from the same row. No member id or balance ever comes back from
 * the browser, so there is nothing there to forge.
 *
 * An offline sale earns points only when the member opts in for it at the
 * counter — the box `canOfferSaleOptIn` decides to draw — and only once it is
 * completed and fully paid; `planSaleLoyalty` is the rule. Points cannot be
 * spent on one. Choosing a customer who is not a member enrols nobody: joining
 * takes the customer's own yes, asked separately (`canOfferMembershipJoin`),
 * and joining is not that box — a new member's sale still earns only if they
 * tick it too.
 */

export type SaleCustomerMembership = {
  points: number;
  status: "active" | "suspended";
};

export type SaleCustomerOption = {
  email: string | null;
  id: string;
  /** This store's membership, or null — never another store's. */
  membership: SaleCustomerMembership | null;
  name: string;
  phone: string;
  phoneMasked: string;
};

export function toSaleCustomerOption(
  storeId: string,
  customer: {
    email: string | null;
    id: string;
    loyaltyMember: { pointsBalance: number; storeId: string; suspendedAt: Date | null } | null;
    name: string;
    phone: string;
  }
): SaleCustomerOption {
  const member = customer.loyaltyMember;

  return {
    email: customer.email,
    id: customer.id,
    // The same refusal the customers page makes: a membership row that is not
    // this store's is not shown, whatever the join returned.
    membership:
      member && member.storeId === storeId
        ? {
            points: member.pointsBalance,
            status: member.suspendedAt === null ? "active" : "suspended"
          }
        : null,
    name: customer.name,
    phone: customer.phone,
    phoneMasked: maskPhone(customer.phone)
  };
}

const MEMBERSHIP_ORDER = { active: 0, none: 2, suspended: 1 } as const;

/**
 * The options matching what staff typed — a name, an email, or any run of three
 * or more digits of the number however it is written (`+880 1712…`, `01712…`)
 * — members first, then suspended members, then everyone else, each in the
 * order the store lists them. An empty query lists the first few, members first.
 */
export function searchSaleCustomers(
  options: readonly SaleCustomerOption[],
  query: string,
  limit = 8
) {
  const text = query.trim().toLowerCase();
  const digits = loyaltyPhoneSearchDigits(query);
  const matches = text
    ? options.filter(
        (option) =>
          option.name.toLowerCase().includes(text) ||
          (option.email?.toLowerCase().includes(text) ?? false) ||
          (digits !== null && option.phone.replace(/\D/g, "").includes(digits))
      )
    : options;

  return matches
    .map((option, index) => ({ index, option }))
    .sort(
      (a, b) =>
        MEMBERSHIP_ORDER[a.option.membership?.status ?? "none"] -
          MEMBERSHIP_ORDER[b.option.membership?.status ?? "none"] || a.index - b.index
    )
    .slice(0, limit)
    .map(({ option }) => option);
}

/**
 * The customers already saved on a whole number, in whatever spelling either
 * was typed — the hint the new-customer form shows before anything is sent.
 * Part of a number matches nothing here: this answers "is this person already
 * a customer", not "who has these digits". The server asks again on save.
 */
export function findSaleCustomersByPhone(options: readonly SaleCustomerOption[], phone: string) {
  const key = phone.replace(/\D/g, "").length >= 8 ? customerPhoneMatchKey(phone) : null;

  return key ? options.filter((option) => customerPhoneMatchKey(option.phone) === key) : [];
}

/**
 * The page's options with what this visit learned from the server laid over
 * them — a customer saved here, a membership just taken out — so the picker
 * shows it without reloading the page and losing the sale being typed. A
 * fresher copy replaces the page's by id; a new customer goes first.
 */
export function mergeSaleCustomerOptions(
  base: readonly SaleCustomerOption[],
  updates: readonly SaleCustomerOption[]
) {
  const fresh = new Map(updates.map((option) => [option.id, option]));
  const known = new Set(base.map((option) => option.id));

  return [
    ...updates.filter((option) => !known.has(option.id)),
    ...base.map((option) => fresh.get(option.id) ?? option)
  ];
}

/**
 * What a search with no match pre-fills the new-customer form with: something
 * that is mostly a number goes in Phone, anything else in Name.
 */
export function newCustomerDraft(query: string) {
  const text = query.trim();
  const digits = text.replace(/\D/g, "").length;

  return digits >= 3 && digits >= text.replace(/[\s+-]/g, "").length - 1
    ? { name: "", phone: text }
    : { name: text, phone: "" };
}

/**
 * Whether the form offers the opt-in box: an active member of this store,
 * while the programme is running. The server checks all of it again — this
 * only decides what is drawn.
 */
export function canOfferSaleOptIn(option: SaleCustomerOption | null, programmeLive: boolean) {
  return programmeLive && option?.membership?.status === "active";
}

/**
 * Whether the form asks if a chosen customer wants to join: one with no
 * membership here, while the programme is running. A member — active or
 * suspended — is shown as one instead, and is never offered a second.
 */
export function canOfferMembershipJoin(option: SaleCustomerOption | null, programmeLive: boolean) {
  return programmeLive && option !== null && option.membership === null;
}

/**
 * The line shown under a chosen customer. A membership is always described;
 * a customer without one is only told how joining works while the programme is
 * running (`programmeLive`), since otherwise there is nothing to join.
 */
export function saleMembershipNote(option: SaleCustomerOption, programmeLive: boolean) {
  if (option.membership) {
    if (option.membership.status === "suspended") {
      return "Loyalty membership suspended — this sale won't earn points.";
    }

    return programmeLive
      ? "Loyalty member. Points can't be spent on offline sales."
      : "Loyalty member, but the programme isn't running, so this sale won't earn points.";
  }

  return programmeLive
    ? "Not a loyalty member. Choosing them here doesn't enrol them — only their own yes below does."
    : null;
}
