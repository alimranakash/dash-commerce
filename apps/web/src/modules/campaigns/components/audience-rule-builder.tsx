"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { previewAudienceReachAction } from "../campaign.actions";
import type { AudienceRule, AudienceRules } from "../audience.schema";

/**
 * The rule editor, shared by the audience pages and the campaign form.
 *
 * Rules combine with AND, which the UI states rather than implies. A boolean
 * builder with nesting would cover more cases and be unreadable six weeks later
 * when someone asks who a campaign actually went to — two campaigns beat one
 * unreadable segment.
 */

type RuleKind = AudienceRule["type"];

const ruleOptions: Array<{ label: string; value: RuleKind }> = [
  { label: "All customers", value: "all" },
  { label: "Have ordered before", value: "has_ordered" },
  { label: "Have never ordered", value: "never_ordered" },
  { label: "Placed at least N orders", value: "min_orders" },
  { label: "Spent at least N", value: "min_spend" },
  { label: "No order in the last N days", value: "inactive_days" },
  { label: "Abandoned a cart", value: "has_abandoned_cart" },
  { label: "Has a customer flag", value: "flag_status" }
];

const flagOptions = ["NORMAL", "WATCHLIST", "BLOCKED"] as const;

function defaultRule(type: RuleKind): AudienceRule {
  switch (type) {
    case "min_orders":
      return { minOrders: 2, type };
    case "min_spend":
      return { minSpend: 1000, type };
    case "inactive_days":
      return { days: 90, type };
    case "flag_status":
      return { status: "NORMAL", type };
    default:
      return { type } as AudienceRule;
  }
}

type Reach = { matched: number; optedOut: number; reachable: number; unreachable: number };

type AudienceRuleBuilderProps = {
  currency: string;
  /** Serialised into this hidden input so a plain form POST carries the rules. */
  fieldName?: string;
  onChange?: (rules: AudienceRules) => void;
  value: AudienceRules;
};

export function AudienceRuleBuilder({
  currency,
  fieldName = "rules",
  onChange,
  value
}: AudienceRuleBuilderProps) {
  const [rules, setRules] = useState<AudienceRules>(value.length > 0 ? value : [{ type: "all" }]);
  const [reach, setReach] = useState<Reach | null>(null);

  function update(next: AudienceRules) {
    const settled = next.length === 0 ? ([{ type: "all" }] as AudienceRules) : next;

    setRules(settled);
    onChange?.(settled);
  }

  // Keyed on the serialised rules rather than the array, which is a new object
  // every render and would re-request the count forever.
  const serialised = JSON.stringify(rules);

  useEffect(() => {
    let cancelled = false;

    setReach(null);
    previewAudienceReachAction(JSON.parse(serialised), "SMS")
      .then((result) => {
        if (!cancelled) setReach(result);
      })
      .catch(() => {
        if (!cancelled) setReach(null);
      });

    return () => {
      cancelled = true;
    };
  }, [serialised]);

  return (
    <div className="grid gap-4">
      <input name={fieldName} type="hidden" value={serialised} />

      <div className="grid gap-3">
        {rules.map((rule, index) => (
          <div
            className="flex flex-wrap items-center gap-2.5 rounded-lg border border-[#ececf5] bg-white px-3 py-3"
            key={index}
          >
            {index > 0 ? (
              <span className="rounded bg-[#f3f0ff] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#6d3cf5]">
                and
              </span>
            ) : null}

            <select
              aria-label={`Rule ${index + 1}`}
              className={selectClass}
              onChange={(event) =>
                update(rules.map((r, i) => (i === index ? defaultRule(event.target.value as RuleKind) : r)))
              }
              value={rule.type}
            >
              {ruleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <RuleParameter
              currency={currency}
              onChange={(next) => update(rules.map((r, i) => (i === index ? next : r)))}
              rule={rule}
            />

            {rules.length > 1 ? (
              <button
                aria-label={`Remove rule ${index + 1}`}
                className="ml-auto grid h-8 w-8 place-items-center rounded-md border border-[#e5e3f1] text-[#85869a] transition hover:bg-[#f7f7fb]"
                onClick={() => update(rules.filter((_, i) => i !== index))}
                type="button"
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <button
        className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-[#e5e3f1] px-3.5 py-2 text-xs font-medium text-[#555762] transition hover:bg-[#f7f7fb] disabled:cursor-not-allowed disabled:opacity-50"
        // Matches the schema's cap, so the builder cannot compose something the
        // server would then refuse to save.
        disabled={rules.length >= 10}
        onClick={() => update([...rules, defaultRule("has_ordered")])}
        type="button"
      >
        <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Add rule
      </button>

      <div className="rounded-lg border border-[#ececf5] bg-[#fafaff] px-4 py-4">
        {reach === null ? (
          <p className="m-0 text-sm text-[#85869a]">Counting…</p>
        ) : (
          <>
            <p className="m-0 text-2xl font-semibold text-[#20212a]">
              {reach.reachable.toLocaleString("en")}
            </p>
            <p className="m-0 mt-0.5 text-xs text-[#85869a]">reachable by SMS</p>
            {reach.optedOut > 0 || reach.unreachable > 0 ? (
              <ul className="m-0 mt-3 list-none space-y-1 p-0 text-xs text-[#555762]">
                <li>{reach.matched.toLocaleString("en")} match these rules</li>
                {reach.optedOut > 0 ? (
                  <li>{reach.optedOut.toLocaleString("en")} opted out of marketing SMS</li>
                ) : null}
                {reach.unreachable > 0 ? (
                  <li>{reach.unreachable.toLocaleString("en")} have no usable phone number</li>
                ) : null}
              </ul>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function RuleParameter({
  currency,
  onChange,
  rule
}: {
  currency: string;
  onChange: (rule: AudienceRule) => void;
  rule: AudienceRule;
}) {
  if (rule.type === "min_orders") {
    return (
      <NumberField
        min={1}
        onChange={(n) => onChange({ minOrders: n, type: "min_orders" })}
        suffix="orders"
        value={rule.minOrders}
      />
    );
  }

  if (rule.type === "min_spend") {
    return (
      <NumberField
        min={0}
        onChange={(n) => onChange({ minSpend: n, type: "min_spend" })}
        suffix={currency}
        value={rule.minSpend}
      />
    );
  }

  if (rule.type === "inactive_days") {
    return (
      <NumberField
        min={1}
        onChange={(n) => onChange({ days: n, type: "inactive_days" })}
        suffix="days"
        value={rule.days}
      />
    );
  }

  if (rule.type === "flag_status") {
    return (
      <select
        aria-label="Customer flag"
        className={selectClass}
        onChange={(event) =>
          onChange({ status: event.target.value as (typeof flagOptions)[number], type: "flag_status" })
        }
        value={rule.status}
      >
        {flagOptions.map((flag) => (
          <option key={flag} value={flag}>
            {flag.charAt(0) + flag.slice(1).toLowerCase()}
          </option>
        ))}
      </select>
    );
  }

  return null;
}

function NumberField({
  min,
  onChange,
  suffix,
  value
}: {
  min: number;
  onChange: (value: number) => void;
  suffix: string;
  value: number;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <input
        className="h-10 w-24 rounded-lg border border-[#e5e3f1] bg-white px-3 text-sm outline-none focus:border-[#8b5cf6]"
        min={min}
        onChange={(event) => {
          const next = Number(event.target.value);

          // Ignore anything that is not a usable number rather than writing NaN
          // into the rule, which would fail to serialise and lose the whole set.
          if (Number.isFinite(next)) onChange(Math.max(min, Math.trunc(next)));
        }}
        type="number"
        value={value}
      />
      <span className="text-xs text-[#85869a]">{suffix}</span>
    </span>
  );
}

const selectClass =
  "h-10 rounded-lg border border-[#e5e3f1] bg-white px-3 text-sm text-[#292a34] outline-none focus:border-[#8b5cf6]";
