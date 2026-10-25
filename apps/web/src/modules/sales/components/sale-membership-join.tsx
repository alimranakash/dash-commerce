"use client";

import { useRef, useState, useTransition } from "react";
import { useUpgradePrompt } from "../../billing/components/plan-upgrade-provider";
import { enrollSaleCustomerAction, type SaleMembershipResult } from "../sale.actions";
import type { SaleCustomerOption } from "../sale-customer";

type SaleMembershipJoinProps = {
  customer: SaleCustomerOption;
  /** The customer as the server now reads them, membership and all, and what to tell staff. */
  onJoined: (result: Extract<SaleMembershipResult, { status: "enrolled" | "existing" }>) => void;
  /** Staff chose the record that already holds the number. */
  onUseHolder: (customer: SaleCustomerOption) => void;
};

/**
 * The counter's one membership question, for a chosen customer who is not a
 * member while the programme is running.
 *
 * It starts at No, and nothing is sent until staff answer Yes and then press
 * the button — two deliberate steps, because joining is the customer's choice
 * and an accidental member is worse than a missed one. Buttons rather than a
 * checkbox: nothing here is posted with the sale, and a pressed No/Yes reads as
 * the question it is. The button sends the
 * customer's id alone; the plan, the switch, the store and the number are all
 * re-read on the server. A refusal is said here and leaves the sale exactly as
 * it was, so the sale can always be saved without the membership.
 */
export function SaleMembershipJoin({ customer, onJoined, onUseHolder }: SaleMembershipJoinProps) {
  const { openUpgrade } = useUpgradePrompt();
  const [wantsToJoin, setWantsToJoin] = useState(false);
  const [result, setResult] = useState<SaleMembershipResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const inFlight = useRef(false);

  function enroll() {
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    startTransition(async () => {
      try {
        const next = await enrollSaleCustomerAction(customer.id);

        if (next.status === "enrolled" || next.status === "existing") {
          onJoined(next);
          return;
        }

        if (next.status === "error") {
          openUpgrade(next.lockedFeature);
        }

        setResult(next);
      } catch {
        setResult({
          message: "The membership could not be added. Check the connection and try again.",
          status: "error"
        });
      } finally {
        inFlight.current = false;
      }
    });
  }

  function answer(yes: boolean) {
    setWantsToJoin(yes);
    setResult(null);
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <span className="text-xs font-medium text-[#20212a]">
          Customer wants to join the loyalty membership?
        </span>
        <div
          aria-label="Customer wants to join the loyalty membership?"
          className="inline-flex shrink-0 rounded-lg border border-[#e4e3ee] bg-white p-0.5"
          role="group"
        >
          <AnswerButton onClick={() => answer(false)} pressed={!wantsToJoin}>
            No
          </AnswerButton>
          <AnswerButton onClick={() => answer(true)} pressed={wantsToJoin}>
            Yes
          </AnswerButton>
        </div>
      </div>

      {wantsToJoin ? (
        <div className="grid gap-2 rounded-lg border border-[#ececf5] bg-white p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="m-0 min-w-0 flex-1 text-[11px] leading-5 text-[#686a76]">
              Joins on <strong className="text-[#20212a]">{customer.phoneMasked}</strong>. Points on
              this sale stay a separate choice.
            </p>
            <button
              className="inline-flex h-8 shrink-0 items-center rounded-lg bg-[#6d3cf5] px-3 text-xs font-semibold text-white disabled:opacity-40"
              disabled={isPending}
              onClick={enroll}
              type="button"
            >
              {isPending ? "Adding..." : "Add as member"}
            </button>
          </div>

          {result?.status === "conflict" ? (
            <div className="grid gap-1 border-t border-[#ececf5] pt-2 text-[11px] leading-5">
              <p className="m-0 text-[#686a76]">{result.message}</p>
              {result.holder ? (
                <button
                  className="text-left font-semibold text-[#6d3cf5]"
                  onClick={() => result.holder && onUseHolder(result.holder)}
                  type="button"
                >
                  Use {result.holder.name} ({result.holder.phoneMasked}) instead
                </button>
              ) : null}
              <span className="text-[#686a76]">Or carry on without a membership.</span>
            </div>
          ) : null}

          {result?.status === "error" ? (
            <p className="form-error m-0 text-[11px]">{result.message}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AnswerButton({
  children,
  onClick,
  pressed
}: {
  children: string;
  onClick: () => void;
  pressed: boolean;
}) {
  return (
    <button
      aria-pressed={pressed}
      className={`h-7 min-w-11 rounded-md px-3 text-xs font-semibold ${
        pressed ? "bg-[#6d3cf5] text-white" : "text-[#565762]"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
