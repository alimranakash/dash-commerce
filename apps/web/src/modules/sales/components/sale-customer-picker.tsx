"use client";

import { Search, Star, UserPlus } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode
} from "react";
import type { SaleMembershipResult } from "../sale.actions";
import {
  canOfferMembershipJoin,
  canOfferSaleOptIn,
  mergeSaleCustomerOptions,
  newCustomerDraft,
  saleMembershipNote,
  searchSaleCustomers,
  type SaleCustomerMembership,
  type SaleCustomerOption
} from "../sale-customer";
import { SaleCustomerCreate } from "./sale-customer-create";
import { SaleMembershipJoin } from "./sale-membership-join";

type SaleCustomerPickerProps = {
  customers: SaleCustomerOption[];
  defaultCustomerId?: string | null | undefined;
  /** Whether the sale's current customer has already opted in to earn on it. */
  defaultOptedIn?: boolean | undefined;
  /** Whether the store's loyalty programme is running, for the opt-in box and the notes. */
  programmeLive: boolean;
};

type JoinedNotice = { customerId: string; enrolled: boolean; message: string };

/**
 * Search the store's customers and loyalty members, pick one, add a new one,
 * or leave the sale as walk-in — and, for a member while the programme is
 * running, record whether they opt in to earn points on this sale.
 *
 * What is posted is `customerId`, and the box with a marker saying it was
 * shown. The service checks the customer is this store's, and re-checks the
 * membership, the plan and the programme before it records an opt-in;
 * everything shown here about the membership was read on the server.
 *
 * Saving a new customer and joining the programme are separate calls made
 * from here (`SaleCustomerCreate`, `SaleMembershipJoin`), never part of the
 * sale: nothing about the sale being typed is lost while they run, and a
 * refusal from either leaves a sale that can still be saved. What they come
 * back with is laid over the page's list, so the picker shows the server's
 * answer without a reload.
 */
export function SaleCustomerPicker({
  customers,
  defaultCustomerId,
  defaultOptedIn,
  programmeLive
}: SaleCustomerPickerProps) {
  const inputId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const focusCard = useRef(false);
  const [learned, setLearned] = useState<SaleCustomerOption[]>([]);
  const [selectedId, setSelectedId] = useState(defaultCustomerId ?? "");
  const [optedIn, setOptedIn] = useState(defaultOptedIn === true);
  const [query, setQuery] = useState("");
  const [changing, setChanging] = useState(false);
  const [draft, setDraft] = useState<{ name: string; phone: string } | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [joined, setJoined] = useState<JoinedNotice | null>(null);
  const options = useMemo(() => mergeSaleCustomerOptions(customers, learned), [customers, learned]);
  const byId = useMemo(() => new Map(options.map((option) => [option.id, option])), [options]);
  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;
  const results = useMemo(() => searchSaleCustomers(options, query), [options, query]);
  const note = selected ? saleMembershipNote(selected, programmeLive) : null;
  const joinedHere = joined && joined.customerId === selected?.id ? joined : null;

  // After a customer is chosen or saved, focus goes back to the sale: the next
  // Tab carries on from the customer to the rest of the form.
  useEffect(() => {
    if (focusCard.current && cardRef.current) {
      focusCard.current = false;
      cardRef.current.focus();
    }
  });

  function choose(id: string) {
    setSelectedId(id);
    // Consent is one customer's: a different customer starts unticked.
    setOptedIn(id !== "" && id === defaultCustomerId && defaultOptedIn === true);
    setChanging(false);
    setDraft(null);
    setQuery("");
    focusCard.current = id !== "";
  }

  function learn(option: SaleCustomerOption) {
    setLearned((current) => [option, ...current.filter((entry) => entry.id !== option.id)]);
  }

  function created(option: SaleCustomerOption) {
    learn(option);
    setSavedId(option.id);
    choose(option.id);
  }

  function pickInstead(option: SaleCustomerOption) {
    learn(option);
    choose(option.id);
  }

  function memberJoined(
    result: Extract<SaleMembershipResult, { status: "enrolled" | "existing" }>
  ) {
    learn(result.customer);
    setJoined({
      customerId: result.customer.id,
      enrolled: result.status === "enrolled",
      message: result.message
    });
  }

  function pickFirstOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    // Enter in the search picks the top match; it never submits the sale.
    if (event.key === "Enter") {
      event.preventDefault();

      if (query.trim() && results[0]) {
        choose(results[0].id);
      }
    }
  }

  return (
    <div className="grid gap-1.5">
      <input name="customerId" type="hidden" value={selected?.id ?? ""} />
      <label htmlFor={inputId}>Customer</label>

      {selected && !changing ? (
        <div
          className="sale-counter overflow-hidden rounded-xl border border-[#ececf5] bg-white"
          ref={cardRef}
          tabIndex={-1}
        >
          <div className="flex items-center gap-3 p-3">
            <span
              aria-hidden="true"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f3efff] text-xs font-bold text-[#6d3cf5]"
            >
              {initials(selected.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <strong className="truncate text-sm text-[#20212a]">{selected.name}</strong>
                {savedId === selected.id ? <Pill tone="green">Customer saved</Pill> : null}
              </div>
              <span className="text-xs text-[#686a76]">{selected.phoneMasked}</span>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button
                className="text-xs font-semibold text-[#6d3cf5]"
                onClick={() => setChanging(true)}
                type="button"
              >
                Change
              </button>
              <button
                className="text-xs font-semibold text-rose-600"
                onClick={() => choose("")}
                type="button"
              >
                Remove
              </button>
            </div>
          </div>

          {selected.membership || programmeLive ? (
            <div className="grid gap-2 border-t border-[#ececf5] bg-[#faf9ff] px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#565762]">
                  <Star aria-hidden="true" className="h-3.5 w-3.5 text-[#6d3cf5]" /> Loyalty
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {joinedHere?.enrolled ? <Pill tone="green">Membership active</Pill> : null}
                  <MembershipPill membership={selected.membership} />
                </span>
              </div>
              {joinedHere && !joinedHere.enrolled ? (
                <p className="m-0 text-[11px] font-semibold leading-5 text-[#686a76]">
                  {joinedHere.message}
                </p>
              ) : null}
              {note &&
              !canOfferSaleOptIn(selected, programmeLive) &&
              !canOfferMembershipJoin(selected, programmeLive) ? (
                <p className="m-0 text-[11px] leading-5 text-[#686a76]">{note}</p>
              ) : null}
              {canOfferSaleOptIn(selected, programmeLive) ? (
                <>
                  <input name="loyaltyOptInShown" type="hidden" value="1" />
                  <label className="sale-counter-option">
                    <span className="min-w-0">
                      <span className="block text-xs font-medium text-[#20212a]">
                        Earn points on this sale
                      </span>
                      <span className="block text-[11px] leading-5 text-[#686a76]">
                        Only if the customer agrees. Earns once Completed and fully Paid; points
                        can&apos;t be spent on offline sales.
                      </span>
                    </span>
                    <input
                      checked={optedIn}
                      className="sale-counter-switch"
                      name="loyaltyOptIn"
                      onChange={(event) => setOptedIn(event.target.checked)}
                      type="checkbox"
                    />
                  </label>
                </>
              ) : null}
              {canOfferMembershipJoin(selected, programmeLive) ? (
                <SaleMembershipJoin
                  customer={selected}
                  key={selected.id}
                  onJoined={memberJoined}
                  onUseHolder={pickInstead}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : draft ? (
        <SaleCustomerCreate
          draft={draft}
          onCancel={() => setDraft(null)}
          onCreated={created}
          onUseExisting={pickInstead}
          options={options}
        />
      ) : (
        <div className="grid gap-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#686a76]" />
            <input
              autoComplete="off"
              className="pl-8"
              id={inputId}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={pickFirstOnEnter}
              placeholder="Search customers or members by name, phone or email"
              type="search"
              value={query}
            />
          </div>
          {query.trim() ? (
            <ul className="m-0 max-h-64 list-none overflow-y-auto rounded-lg border border-[#ececf5] bg-white p-0">
              {results.length === 0 ? (
                <li className="px-3 py-2 text-xs text-[#686a76]">
                  No customer matches that.{" "}
                  <button
                    className="font-semibold text-[#6d3cf5]"
                    onClick={() => setDraft(newCustomerDraft(query))}
                    type="button"
                  >
                    Add as a new customer
                  </button>
                </li>
              ) : (
                results.map((option) => (
                  <li key={option.id}>
                    <button
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-[#faf9ff]"
                      onClick={() => choose(option.id)}
                      type="button"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{option.name}</span>
                        <span className="text-[#686a76]">{option.phoneMasked}</span>
                      </span>
                      {option.membership ? <MembershipPill membership={option.membership} /> : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="m-0 text-[11px] leading-5 text-[#686a76]">
              {changing && selected ? (
                <button
                  className="font-semibold text-[#6d3cf5]"
                  onClick={() => setChanging(false)}
                  type="button"
                >
                  Keep {selected.name}
                </button>
              ) : (
                "No customer chosen — the sale is recorded as walk-in / guest."
              )}
            </p>
            <button
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#6d3cf5]"
              onClick={() => setDraft(newCustomerDraft(query))}
              type="button"
            >
              <UserPlus className="h-3.5 w-3.5" /> New customer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** `StatusBadge`'s tones, without its `capitalize` — "420 pts" is not a title. */
const PILL_TONES = {
  gray: "bg-gray-100 text-gray-600",
  green: "bg-emerald-50 text-emerald-700",
  purple: "bg-violet-50 text-violet-700"
} as const;

function Pill({ children, tone }: { children: ReactNode; tone: keyof typeof PILL_TONES }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${PILL_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

function MembershipPill({ membership }: { membership: SaleCustomerMembership | null }) {
  if (!membership) {
    return <Pill tone="gray">Not a member</Pill>;
  }

  const points = `${new Intl.NumberFormat("en").format(membership.points)} pts`;

  return membership.status === "active" ? (
    <Pill tone="purple">Member · {points}</Pill>
  ) : (
    <Pill tone="gray">Suspended · {points}</Pill>
  );
}

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";

  return (first + last).toUpperCase() || "?";
}
