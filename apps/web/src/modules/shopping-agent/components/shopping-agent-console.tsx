"use client";

import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  MessagesSquare,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import type { AiSettingsView } from "../../ai-provider/ai-provider.schema";
import { BILLING_UPGRADE_PATH } from "../../billing/components/paid-badge";
import type { ShoppingAgentSettingsState } from "../shopping-agent.actions";
import type { ShoppingAgentCapability } from "../shopping-agent.service";

const initialState: ShoppingAgentSettingsState = { status: "idle" };

/** Where a seller changes which engine answers. Not a setting this page owns. */
const AI_SETTINGS_PATH = "/dashboard/ai/settings";

/**
 * StoreIM AI → AI Shopping Agent, the whole page below the shell.
 *
 * One client component rather than a server-rendered status panel with a form
 * bolted underneath it, and that is a correctness decision before it is a design
 * one. The badge, the headline and the switch are three views of the same three
 * facts — a plan or a key, the seller's switch, and which engine answers — so
 * when they were split across a server page and a client form, saving updated
 * the form and left the header reading "Switched off" above a toggle the seller
 * had just turned on. They only disagreed until the next full page load, which
 * is exactly long enough for a seller to conclude the button is broken.
 *
 * Now the action returns the recomputed capability and this component renders
 * every one of them from it. Nothing on the page can lag behind the save.
 *
 * The second thing it fixes is that the old card never said whether what was on
 * screen had been saved. A checkbox that flips instantly and a Save button that
 * looks identical either way is a form with no state: `isDirty` drives both the
 * button and the line beside it, so "I changed this" and "this is live" are
 * never the same picture.
 */
export function ShoppingAgentConsole({
  action,
  canManage,
  capability: initialCapability,
  settings,
  storefrontUrl,
  storeName
}: {
  action: (
    state: ShoppingAgentSettingsState,
    formData: FormData
  ) => Promise<ShoppingAgentSettingsState>;
  canManage: boolean;
  capability: ShoppingAgentCapability;
  settings: AiSettingsView;
  /** The shop's public address, for the one link that proves this is real. */
  storefrontUrl: string;
  storeName: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const capability = state.capability ?? initialCapability;
  const view = state.view ?? settings;
  const saved = view.shoppingAgentEnabled;

  const [enabled, setEnabled] = useState(saved);
  const [lastSaved, setLastSaved] = useState(saved);

  // Adopt the server's word whenever it changes — React's own pattern for
  // adjusting state to a changed input, which is why it is a render-phase set
  // and not an effect. What it buys is that `isDirty` below measures the toggle
  // against what is *stored*, not against what this component started with, so a
  // successful save settles the panel instead of leaving it looking unsaved.
  //
  // A refused save returns no view, so `saved` does not move and the seller's
  // toggle is left where they put it, under the error explaining why. That is
  // deliberate: snapping it back would hide what they had just tried to do.
  if (saved !== lastSaved) {
    setLastSaved(saved);
    setEnabled(saved);
  }

  const isDirty = enabled !== saved;
  const live = capability.enabled && capability.entitled;
  const engineLabel = capability.providerLabel;

  return (
    <form action={formAction} className="sfa-console">
      {/* The switch travels as a hidden field so the visible control can be a
          real switch — role, keyboard and all — rather than a checkbox styled
          to look like one. */}
      <input name="shoppingAgentEnabled" type="hidden" value={enabled ? "on" : "off"} />

      <section className={`sfa-hero${live ? " sfa-hero-live" : ""}`}>
        <div className="sfa-hero-main">
          <p className="sfa-hero-state">
            <span aria-hidden="true" className={`sfa-dot${live ? " sfa-dot-live" : ""}`} />
            {live ? "Live on your storefront" : capability.entitled ? "Switched off" : "Locked"}
          </p>

          <h2>
            {live
              ? engineLabel
                ? `${engineLabel} is answering your customers`
                : "Your catalogue is answering your customers"
              : capability.entitled
                ? "Nothing is answering your customers yet"
                : "StoreIM AI is not on this plan"}
          </h2>

          <p className="sfa-hero-copy">
            {live
              ? engineLabel
                ? `Every reply is written by ${engineLabel} on your own key, from your live products, prices and stock — never from anything it made up.`
                : "Replies are searched straight from your catalogue. Add a Gemini or OpenAI key and it will answer in its own words instead."
              : capability.entitled
                ? "Turn it on and a chat button appears on every page of your shop. You can switch it off again at any time and it disappears immediately."
                : "Upgrade your plan, or add your own Gemini or OpenAI key — a key you own works on any plan, because you are paying that bill."}
          </p>

          <div className="sfa-switch-row">
            <button
              aria-checked={enabled}
              className="sfa-switch"
              disabled={!canManage || !capability.entitled || isPending}
              onClick={() => setEnabled((current) => !current)}
              role="switch"
              type="button"
            >
              <span aria-hidden="true" className="sfa-switch-track">
                <span className="sfa-switch-knob" />
              </span>
              <span className="sfa-switch-label">
                <strong>Answer customers on my storefront</strong>
                <small>
                  {enabled
                    ? "The chat button shows on every page of your shop."
                    : "Your storefront shows no chat button."}
                </small>
              </span>
            </button>
          </div>

          <div className="sfa-engine">
            <span className="sfa-engine-chip">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
              {engineLabel ? `Engine: ${engineLabel}` : "Engine: your catalogue"}
            </span>
            <Link className="sfa-engine-link" href={AI_SETTINGS_PATH}>
              {engineLabel ? "Change engine" : "Add your own key"}
              <ArrowRight aria-hidden="true" className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* A small, honest picture of what a customer sees. It is the fastest
            way to answer the question a seller is actually asking on this page,
            which is "what will this look like in my shop?" */}
        <aside aria-hidden="true" className="sfa-preview">
          <div className={`sfa-preview-frame${live ? "" : " sfa-preview-dim"}`}>
            <div className="sfa-preview-head">
              <span className="sfa-preview-avatar">
                <Sparkles className="h-3 w-3" />
              </span>
              <div>
                <strong>Shopping assistant</strong>
                <span>{storeName}</span>
              </div>
            </div>
            <div className="sfa-preview-body">
              <p className="sfa-preview-bubble sfa-preview-them">
                Something under 2000 for a gift?
              </p>
              <p className="sfa-preview-bubble sfa-preview-us">Here are three that would work.</p>
              <div className="sfa-preview-card">
                <span className="sfa-preview-thumb" />
                <div>
                  <strong />
                  <em />
                  <span className="sfa-preview-cta">Add to cart</span>
                </div>
              </div>
            </div>
          </div>
          <p className="sfa-preview-caption">
            <MessagesSquare aria-hidden="true" className="h-3 w-3" />
            What your customers see
          </p>
        </aside>

        <footer className="sfa-hero-footer">
          <p className="sfa-save-state">
            {state.status === "error" ? (
              <span className="sfa-save-error">{state.message}</span>
            ) : isDirty ? (
              <span className="sfa-save-dirty">
                {enabled ? "Not saved yet — this will go live on your shop." : "Not saved yet."}
              </span>
            ) : state.status === "success" ? (
              <span className="sfa-save-ok">
                <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                {state.message}
              </span>
            ) : (
              <span className="sfa-save-idle">
                {live ? "Live and saved." : "Everything here is saved."}
              </span>
            )}
          </p>

          <div className="sfa-hero-actions">
            {live ? (
              <Link className="sfa-secondary" href={storefrontUrl} rel="noreferrer" target="_blank">
                <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                Open your shop
              </Link>
            ) : capability.entitled ? null : (
              <Link className="sfa-secondary" href={BILLING_UPGRADE_PATH}>
                See plans
              </Link>
            )}

            {canManage ? (
              <button
                className="sfa-primary"
                disabled={!capability.entitled || isPending || !isDirty}
                type="submit"
              >
                {isPending ? (
                  <>
                    <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : isDirty ? (
                  "Save changes"
                ) : (
                  "Saved"
                )}
              </button>
            ) : null}
          </div>
        </footer>
      </section>

      {!canManage ? (
        <p className="sfa-notice">
          <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
          Only the store owner or an admin can switch the storefront assistant on or off.
        </p>
      ) : null}

      {/* The flow, because "AI can place orders" is the sentence that decides
          whether a seller trusts this, and the honest answer is a chain with a
          confirmation in it rather than a yes or a no. */}
      <section className="sfa-panel">
        <header className="sfa-panel-head">
          <h3>How a conversation turns into an order</h3>
          <p>Every step runs on the shop you already have — nothing here is a separate system.</p>
        </header>
        <ol className="sfa-flow">
          {FLOW.map((step, index) => (
            <li key={step.title}>
              <span className="sfa-flow-index">{index + 1}</span>
              <div>
                <strong>{step.title}</strong>
                <span>{step.detail}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="sfa-panel">
        <header className="sfa-panel-head">
          <h3>What it is allowed to do</h3>
          <p>Three things, each one a button your customer presses themselves.</p>
        </header>
        <div className="sfa-cards">
          {CAPABILITIES.map((entry) => (
            <article className="sfa-card" key={entry.title}>
              <span className="sfa-card-icon">{entry.icon}</span>
              <strong>{entry.title}</strong>
              <p>{entry.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="sfa-panel">
        <header className="sfa-panel-head">
          <h3>What it will never do</h3>
          <p>The limits are in the code, not in the wording of a prompt.</p>
        </header>
        <ul className="sfa-guardrails">
          {GUARDRAILS.map((line) => (
            <li key={line}>
              <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>
    </form>
  );
}

const FLOW: Array<{ detail: string; title: string }> = [
  {
    detail:
      "A customer describes what they want, in English or Bangla, with a budget if they have one.",
    title: "They ask"
  },
  {
    detail: "Your catalogue is searched the same way your own search box searches it.",
    title: "It searches"
  },
  {
    detail: "Matching products come back as cards with your live price, stock and photo.",
    title: "It recommends"
  },
  {
    detail: "Adding a line and placing the order both go through your normal cart and checkout.",
    title: "They buy"
  },
  {
    detail: "The order lands in your dashboard like any other, and they get a link to pay.",
    title: "You get the order"
  }
];

const CAPABILITIES: Array<{ detail: string; icon: ReactNode; title: string }> = [
  {
    detail:
      "Only products that are active and public in your shop, at the price your product page shows. It cannot surface a draft or a hidden one.",
    icon: <Search className="h-4 w-4" />,
    title: "Find and compare"
  },
  {
    detail:
      "The same cart as your Add to cart buttons, so the header count and the cart page agree. The customer confirms every line.",
    icon: <ShoppingBag className="h-4 w-4" />,
    title: "Add to the cart"
  },
  {
    detail:
      "Through your normal checkout, so stock, coupons, delivery charges and your order limits all apply. They see the full order before they confirm.",
    icon: <CreditCard className="h-4 w-4" />,
    title: "Place the order"
  }
];

const GUARDRAILS = [
  "Recommend a product your shop does not sell — every card is read back from your catalogue.",
  "Quote a price, a stock level or a delivery charge it made up.",
  "Add anything to a cart, or place an order, without the customer confirming it first.",
  "Change your products, prices, coupons or any order. It can only read and sell.",
  "See your cost prices, your margins, or another customer's details."
];
