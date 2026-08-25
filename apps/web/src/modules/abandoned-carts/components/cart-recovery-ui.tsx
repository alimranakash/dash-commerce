"use client";

import type { Mail } from "lucide-react";
import Link from "next/link";
import type { AbandonedCartRecord, AbandonedCartStatus } from "../abandoned-cart.types";

/**
 * The pieces the abandoned-cart and incomplete-order tables both draw with.
 *
 * The two pages are different lists of the same snapshot row, worked the same
 * way by the same person — so a status badge that reads one way on one of them
 * and another way on the other would be a bug, not a variation.
 */

/**
 * What the shopper is being reminded of.
 *
 * Someone who filled in a delivery address and pressed Place Order knows they
 * were trying to buy something; being told they "left something in their cart"
 * reads as a form letter to them. Someone who never reached checkout has not
 * necessarily decided anything yet, and is asked more gently.
 */
export type OutreachIntent = "cart" | "checkout";

export function ActionButton({
  disabled,
  icon: Icon,
  label,
  onClick
}: {
  disabled?: boolean;
  icon?: typeof Mail;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border border-[#ded9ef] px-2.5 text-[11px] font-semibold text-[#5f3dc4] hover:bg-[#f5f1ff] disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {label}
    </button>
  );
}

/**
 * An action that navigates rather than saves.
 *
 * Drawn as a button so it sits in the same row as the ones that do, but it is a
 * link: it opens a form the seller then fills in, and a middle click or a new
 * tab is a reasonable thing to want from it.
 */
export function ActionLink({
  emphasis,
  href,
  icon: Icon,
  label
}: {
  emphasis?: boolean;
  href: string;
  icon?: typeof Mail;
  label: string;
}) {
  const styles = emphasis
    ? "border-[#7548f5] bg-[#7548f5] text-white hover:bg-[#6436e8]"
    : "border-[#ded9ef] text-[#5f3dc4] hover:bg-[#f5f1ff]";

  return (
    <Link
      className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-[11px] font-semibold ${styles}`}
      href={href}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {label}
    </Link>
  );
}

export function CartStatusBadge({ status }: { status: AbandonedCartStatus }) {
  const styles =
    status === "RECOVERED"
      ? "bg-[#e5f8f2] text-[#11815f]"
      : status === "CONTACTED"
        ? "bg-[#eeeaff] text-[#6846d8]"
        : "bg-[#fff1df] text-[#a7650c]";

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles}`}
    >
      {status === "NOT_CONTACTED" ? "Not Contacted" : status === "CONTACTED" ? "Contacted" : "Recovered"}
    </span>
  );
}

export function emailLink(record: AbandonedCartRecord, storeName: string, intent: OutreachIntent) {
  if (!record.email) {
    return null;
  }

  const subject =
    intent === "checkout"
      ? `Your order at ${storeName} is not finished`
      : `You left something in your cart at ${storeName}`;
  const body = [
    `Hi ${record.customerName},`,
    "",
    intent === "checkout"
      ? "Your order was not completed. Here is what you had:"
      : "Your cart is still waiting for you:",
    ...record.items.map((item) => `- ${item.productName} x${item.quantity}`),
    "",
    intent === "checkout"
      ? `Finish your order here: ${record.recoveryUrl}`
      : `Pick up where you left off: ${record.recoveryUrl}`,
    "",
    storeName
  ].join("\n");

  return `mailto:${encodeURIComponent(record.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function whatsappLink(
  record: AbandonedCartRecord,
  storeName: string,
  intent: OutreachIntent
) {
  const number = toWhatsAppNumber(record.phone);

  if (!number) {
    return null;
  }

  const message =
    intent === "checkout"
      ? `Hi ${record.customerName}, your order at ${storeName} did not go through. You can finish it here: ${record.recoveryUrl}`
      : `Hi ${record.customerName}, you left ${record.items.length === 1 ? "an item" : "some items"} in your cart at ${storeName}. You can finish your order here: ${record.recoveryUrl}`;

  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/** The seller's own phone, for the call a Bangladeshi store actually makes. */
export function callLink(phone: string | null) {
  const digits = (phone ?? "").replace(/[^\d+]/g, "");

  return digits.length >= 8 ? `tel:${digits}` : null;
}

/**
 * wa.me needs a full international number. Checkout collects local Bangladeshi
 * numbers (`01…`), which are expanded with the country code; anything already
 * carrying one is left alone.
 */
function toWhatsAppNumber(phone: string | null) {
  const digits = (phone ?? "").replace(/\D/g, "").replace(/^00/, "");

  if (digits.length < 8) {
    return null;
  }

  return digits.startsWith("0") ? `880${digits.slice(1)}` : digits;
}

export function formatDuration(minutes: number) {
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  const hours = Math.round((minutes / 60) * 10) / 10;

  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  );
}

export function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en", { currency, style: "currency" }).format(value);
}
