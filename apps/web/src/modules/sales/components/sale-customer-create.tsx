"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { useUpgradePrompt } from "../../billing/components/plan-upgrade-provider";
import { createSaleCustomerAction, type SaleCustomerResult } from "../sale.actions";
import { findSaleCustomersByPhone, type SaleCustomerOption } from "../sale-customer";

type SaleCustomerCreateProps = {
  /** What the search box held, split into a likely name or number. */
  draft: { name: string; phone: string };
  onCancel: () => void;
  onCreated: (customer: SaleCustomerOption) => void;
  /** Staff chose an existing customer instead of saving a duplicate. */
  onUseExisting: (customer: SaleCustomerOption) => void;
  options: readonly SaleCustomerOption[];
};

/**
 * Saves a new customer from inside the sale form, without leaving it.
 *
 * The inputs carry no `name`, so they never ride along with the sale: the
 * customer is saved by its own call, and only the id it comes back with is
 * ever posted. Enter saves the customer rather than submitting the sale, and a
 * save in flight cannot be sent twice. A number already on a customer here —
 * spotted in the page's own list as it is typed, and checked again by the
 * server — offers that record instead of saving another.
 */
export function SaleCustomerCreate({
  draft,
  onCancel,
  onCreated,
  onUseExisting,
  options
}: SaleCustomerCreateProps) {
  const { openUpgrade } = useUpgradePrompt();
  const [name, setName] = useState(draft.name);
  const [phone, setPhone] = useState(draft.phone);
  const [result, setResult] = useState<SaleCustomerResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const inFlight = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const known = useMemo(() => findSaleCustomersByPhone(options, phone), [options, phone]);
  const matches = result?.status === "duplicate" ? result.matches : known;
  const fieldErrors = result?.status === "error" ? result.fieldErrors : undefined;

  // Once, on opening: straight to whichever field the search did not fill.
  useEffect(() => {
    (draft.name && !draft.phone ? phoneRef : nameRef).current?.focus();
  }, []);

  function save() {
    if (inFlight.current || known.length > 0) {
      return;
    }

    inFlight.current = true;
    startTransition(async () => {
      try {
        const next = await createSaleCustomerAction({ name, phone });

        if (next.status === "created") {
          onCreated(next.customer);
          return;
        }

        if (next.status === "error") {
          openUpgrade(next.lockedFeature);
        }

        setResult(next);
      } catch {
        setResult({
          message: "The customer could not be saved. Check the connection and try again.",
          status: "error"
        });
      } finally {
        inFlight.current = false;
      }
    });
  }

  function saveOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    // Enter here means this customer, never the whole sale.
    if (event.key === "Enter") {
      event.preventDefault();
      save();
    }
  }

  return (
    <div className="grid gap-3 rounded-xl border border-[#ececf5] bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <strong className="text-sm">New customer</strong>
        <button className="text-xs font-semibold text-[#6d3cf5]" onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1">
          Name
          <input
            autoComplete="off"
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={saveOnEnter}
            placeholder="Customer name"
            ref={nameRef}
            value={name}
          />
          {fieldErrors?.name ? <span className="field-error">{fieldErrors.name}</span> : null}
        </label>
        <label className="grid gap-1">
          Phone
          <input
            autoComplete="off"
            inputMode="tel"
            maxLength={30}
            onChange={(event) => {
              setPhone(event.target.value);
              setResult(null);
            }}
            onKeyDown={saveOnEnter}
            placeholder="01XXXXXXXXX"
            ref={phoneRef}
            type="tel"
            value={phone}
          />
          {fieldErrors?.phone ? <span className="field-error">{fieldErrors.phone}</span> : null}
        </label>
      </div>

      {matches.length > 0 ? (
        <div className="grid gap-1.5 rounded-lg border border-[#ddd6fe] bg-white p-2">
          <p className="m-0 text-[11px] leading-5 text-[#686a76]">
            {result?.status === "duplicate"
              ? result.message
              : "This number is already a customer here. Use that record instead of adding another."}
          </p>
          {matches.map((match) => (
            <button
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-[#faf9ff]"
              key={match.id}
              onClick={() => onUseExisting(match)}
              type="button"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold">{match.name}</span>
                <span className="text-[#686a76]">{match.phoneMasked}</span>
              </span>
              <span className="font-semibold text-[#6d3cf5]">Use this customer</span>
            </button>
          ))}
        </div>
      ) : null}

      {result?.status === "error" ? <p className="form-error m-0">{result.message}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          className="inline-flex h-9 shrink-0 items-center rounded-lg bg-[#6d3cf5] px-4 text-xs font-semibold text-white disabled:opacity-40"
          disabled={isPending || matches.length > 0}
          onClick={save}
          type="button"
        >
          {isPending ? "Saving..." : "Save customer"}
        </button>
        <span className="text-[11px] leading-5 text-[#686a76]">
          Not saved until you press it — until then the sale stays walk-in.
        </span>
      </div>
    </div>
  );
}
