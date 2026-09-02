"use client";

import { BellRing, ExternalLink, Eye, Loader2, RotateCcw, ShieldCheck, Store } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { minPlanForFeature } from "../../admin/plan-catalog";
import { BILLING_UPGRADE_PATH, PaidBadge } from "../../billing/components/paid-badge";
import { useUpgradePrompt } from "../../billing/components/plan-upgrade-provider";
import type { SalesNotificationSettingsState } from "../sales-notifications.actions";
import { redactBuyerName, resolveLocation } from "../sales-notifications.redact";
import {
  SALES_NOTIFICATION_ORDER_STATUSES,
  SALES_NOTIFICATION_POSITIONS,
  type SalesNotificationEvent,
  type SalesNotificationNameDisplay,
  type SalesNotificationOrderStatus,
  type SalesNotificationPosition,
  type SalesNotificationSettings
} from "../sales-notifications.schema";
import type { SalesNotificationCapability } from "../sales-notifications.service";
import { SalesNotificationCard } from "./sales-notification-card";

/** The key this page is sold under, for the badge and the upgrade dialog. */
const FEATURE = "sales_notifications" as const;

/** Read from the catalog so re-pricing does not leave this page naming a tier. */
const unlockingPlan = minPlanForFeature(FEATURE);

const initialState: SalesNotificationSettingsState = { status: "idle" };

/** What the preview stands in with when the shop has taken no orders yet. */
const EXAMPLE_SAMPLE: PreviewSample = {
  city: "Dhaka",
  customerName: "Rahim Uddin",
  district: null,
  imageUrl: null,
  productTitle: "Colorful T Shirt",
  purchasedAt: new Date(0).toISOString()
};

export type PreviewSample = {
  city: string | null;
  customerName: string;
  district: string | null;
  imageUrl: string | null;
  productTitle: string;
  purchasedAt: string;
};

/**
 * Marketing → Sales Notifications, the whole page below the shell.
 *
 * One client component rather than a server status panel with a form under it,
 * for the reason `shopping-agent-console.tsx` sets out: the badge, the headline
 * and the switch are views of the same facts, and splitting them across a server
 * render and a client form is what produces a page reading "Switched off" above
 * a toggle the seller has just turned on.
 *
 * The preview is the reason this page is worth building rather than shipping a
 * checkbox. Every control changes the card beside it *live*, drawn by the same
 * component the storefront mounts, from this shop's own most recent order and
 * through the same redaction the storefront applies — so "First name + initial"
 * is a thing the seller can read rather than a phrase they have to trust. A
 * privacy setting that can only be evaluated after it is published is not a
 * setting a seller can be expected to get right.
 */
export function SalesNotificationsConsole({
  action,
  canManage,
  capability: initialCapability,
  sample,
  settings,
  storefrontUrl
}: {
  action: (
    state: SalesNotificationSettingsState,
    formData: FormData
  ) => Promise<SalesNotificationSettingsState>;
  canManage: boolean;
  capability: SalesNotificationCapability;
  /** This shop's newest real order, unredacted, or null when it has none. */
  sample: PreviewSample | null;
  settings: SalesNotificationSettings;
  storefrontUrl: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const { openUpgrade } = useUpgradePrompt();

  const capability = state.capability ?? initialCapability;
  const saved = state.settings ?? settings;

  const [draft, setDraft] = useState<SalesNotificationSettings>(saved);
  const [lastSaved, setLastSaved] = useState(saved);
  /** Bumped to remount the preview card, replaying its entrance. */
  const [replayKey, setReplayKey] = useState(0);

  // A save the plan refused opens the same dialog every other gated form opens.
  // Keyed on `state` so a second refused attempt re-opens it after a dismissal.
  useEffect(() => {
    openUpgrade(state.lockedFeature);
  }, [openUpgrade, state]);

  // Adopt the server's word whenever it changes — React's pattern for adjusting
  // state to a changed input, which is why it is a render-phase set rather than
  // an effect. It settles the dirty indicator on a successful save; a refused
  // save returns no settings, so the seller's edits are left where they put
  // them, under the reason they were refused.
  if (saved !== lastSaved) {
    setLastSaved(saved);
    setDraft(saved);
  }

  const isDirty = !sameSettings(draft, saved);
  const live = capability.enabled && capability.entitled;
  const hasOrders = capability.eligibleOrders > 0;

  const previewSample = sample ?? EXAMPLE_SAMPLE;
  const previewEvent = useMemo<SalesNotificationEvent>(
    () => ({
      buyer: redactBuyerName(previewSample.customerName, draft.nameDisplay),
      href: null,
      id: "preview",
      imageUrl: draft.showProductImage ? previewSample.imageUrl : null,
      location: draft.showLocation
        ? resolveLocation(previewSample.city, previewSample.district)
        : null,
      productTitle: previewSample.productTitle,
      // With no real order to show, the card is dated relative to now so the
      // "20 mins ago" line is a plausible example rather than 1970.
      purchasedAt: sample
        ? previewSample.purchasedAt
        : new Date(Date.now() - 20 * 60000).toISOString()
    }),
    [draft.nameDisplay, draft.showLocation, draft.showProductImage, previewSample, sample]
  );

  const set = <K extends keyof SalesNotificationSettings>(
    key: K,
    value: SalesNotificationSettings[K]
  ) => setDraft((current) => ({ ...current, [key]: value }));

  /**
   * Tick a status on or off, refusing to leave the list empty.
   *
   * The last one cannot be unticked: an empty set is a widget that is switched
   * on and can never show anything, and the seller would read that as broken
   * rather than as off. The server refuses it too — this only stops the form
   * reaching a state it would be told off for.
   */
  const toggleStatus = (status: SalesNotificationOrderStatus) => {
    const checked = draft.orderStatuses.includes(status);

    if (checked && draft.orderStatuses.length === 1) {
      return;
    }

    set(
      "orderStatuses",
      checked
        ? draft.orderStatuses.filter((entry) => entry !== status)
        : // Kept in the canonical order rather than click order, so the chips
          // and the saved value read the same way every time.
          SALES_NOTIFICATION_ORDER_STATUSES.filter(
            (entry) => entry === status || draft.orderStatuses.includes(entry)
          )
    );
  };

  const toggleEnabled = () => {
    if (!capability.entitled && !draft.enabled) {
      openUpgrade(FEATURE);

      return;
    }

    set("enabled", !draft.enabled);
  };

  return (
    <form action={formAction} className="snc-console">
      {/* Every value posts as a hidden field, so what the server parses is
          exactly the state this panel is rendering — no control can be visually
          set to one thing and submit another. */}
      <input name="enabled" type="hidden" value={draft.enabled ? "on" : "off"} />
      <input name="nameDisplay" type="hidden" value={draft.nameDisplay} />
      <input name="orderStatuses" type="hidden" value={draft.orderStatuses.join(",")} />
      <input name="position" type="hidden" value={draft.position} />
      <input
        name="requirePublicProduct"
        type="hidden"
        value={draft.requirePublicProduct ? "on" : "off"}
      />
      <input name="showLocation" type="hidden" value={draft.showLocation ? "on" : "off"} />
      <input name="showOnMobile" type="hidden" value={draft.showOnMobile ? "on" : "off"} />
      <input name="showProductImage" type="hidden" value={draft.showProductImage ? "on" : "off"} />
      <input name="showTimeAgo" type="hidden" value={draft.showTimeAgo ? "on" : "off"} />
      <input name="loopFeed" type="hidden" value={draft.loopFeed ? "on" : "off"} />
      <input name="initialDelaySeconds" type="hidden" value={draft.initialDelaySeconds} />
      <input name="displaySeconds" type="hidden" value={draft.displaySeconds} />
      <input name="gapSeconds" type="hidden" value={draft.gapSeconds} />
      <input name="maxPerSession" type="hidden" value={draft.maxPerSession} />
      <input name="lookbackDays" type="hidden" value={draft.lookbackDays} />

      <section className={`snc-hero${live ? " snc-hero-live" : ""}`}>
        <div className="snc-hero-main">
          <p className="snc-hero-state">
            <span aria-hidden="true" className={`snc-dot${live ? " snc-dot-live" : ""}`} />
            {live
              ? hasOrders
                ? "Live on your storefront"
                : "On, but nothing to show yet"
              : capability.entitled
                ? "Switched off"
                : "Locked"}
          </p>

          <h2>
            {live
              ? hasOrders
                ? "Your shoppers can see what other people are buying"
                : "No orders in your window yet"
              : capability.entitled
                ? "Your storefront shows no purchase notifications"
                : "Sales Notifications are not on this plan"}
          </h2>

          <p className="snc-hero-copy">
            {capability.entitled
              ? "Every card is a real order from this shop — a real customer, a real product, at the time it actually happened. There is no way to type one in, which is exactly why a shopper can believe it."
              : unlockingPlan
                ? `Included from the ${unlockingPlan} plan up. Cards are drawn from your real orders, never made up.`
                : "Not included in your current plan."}
          </p>

          <div className="snc-hero-stats">
            <span className="snc-stat">
              <strong>{capability.eligibleOrders}</strong>
              <small>
                {capability.eligibleOrders === 1 ? "order" : "orders"} in the last{" "}
                {draft.lookbackDays} {draft.lookbackDays === 1 ? "day" : "days"}
              </small>
            </span>
            <span className="snc-stat">
              <strong>
                {Math.min(draft.maxPerSession, Math.max(1, capability.eligibleOrders))}
              </strong>
              <small>cards a visitor can see</small>
            </span>
            <Link className="snc-hero-link" href={storefrontUrl} rel="noreferrer" target="_blank">
              <ExternalLink aria-hidden="true" />
              View storefront
            </Link>
          </div>
        </div>

        <button
          aria-checked={draft.enabled}
          className="snc-switch"
          disabled={!canManage || isPending}
          onClick={toggleEnabled}
          role="switch"
          type="button"
        >
          <span aria-hidden="true" className="snc-switch-track">
            <span className="snc-switch-knob" />
          </span>
          <span className="snc-switch-label">
            <strong>
              Show purchase notifications
              {capability.entitled ? null : (
                <span className="ml-1.5 align-middle">
                  <PaidBadge feature={FEATURE} interactive={false} showPlan />
                </span>
              )}
            </strong>
            <small>
              {capability.entitled || draft.enabled
                ? draft.enabled
                  ? "Cards appear on every page of your shop."
                  : "Your storefront shows nothing."
                : unlockingPlan
                  ? `Included from the ${unlockingPlan} plan up.`
                  : "Not included in your current plan."}
            </small>
          </span>
        </button>
      </section>

      <div className="snc-grid">
        <div className="snc-columns">
          <section className="snc-panel">
            <header className="snc-panel-head">
              <ShieldCheck aria-hidden="true" />
              <div>
                <h3>What the card says</h3>
                <p>
                  Your customers did not agree to appear on your storefront. Publish the least that
                  still reads like a person.
                </p>
              </div>
            </header>

            <fieldset className="snc-field">
              <legend>Buyer name</legend>
              <div className="snc-seg" role="group">
                {NAME_DISPLAY_OPTIONS.map((option) => (
                  <button
                    aria-pressed={draft.nameDisplay === option.value}
                    className="snc-seg-item"
                    disabled={!canManage}
                    key={option.value}
                    onClick={() => set("nameDisplay", option.value)}
                    type="button"
                  >
                    <strong>{option.label}</strong>
                    <small>{redactBuyerName(previewSample.customerName, option.value)}</small>
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="snc-toggles">
              <ToggleRow
                checked={draft.showLocation}
                disabled={!canManage}
                hint="Town or district only — never the street."
                label="Show where they are"
                onChange={(value) => set("showLocation", value)}
              />
              <ToggleRow
                checked={draft.showTimeAgo}
                disabled={!canManage}
                hint="&ldquo;20 mins ago&rdquo;, counted from the order."
                label="Show how long ago"
                onChange={(value) => set("showTimeAgo", value)}
              />
              <ToggleRow
                checked={draft.showProductImage}
                disabled={!canManage}
                hint="The product photo, at the size shown opposite."
                label="Show the product photo"
                onChange={(value) => set("showProductImage", value)}
              />
            </div>
          </section>

          <section className="snc-panel">
            <header className="snc-panel-head">
              <Store aria-hidden="true" />
              <div>
                <h3>Where it sits</h3>
                <p>
                  The bottom-left corner is the default. Your chat assistant and the scroll-to-top
                  button already use the bottom corners, so pick the one they are not in.
                </p>
              </div>
            </header>

            <fieldset className="snc-field">
              <legend>Corner</legend>
              <div className="snc-corners" role="group">
                {SALES_NOTIFICATION_POSITIONS.map((option) => (
                  <button
                    aria-label={POSITION_LABELS[option]}
                    aria-pressed={draft.position === option}
                    className="snc-corner"
                    data-position={option}
                    disabled={!canManage}
                    key={option}
                    onClick={() => set("position", option)}
                    type="button"
                  >
                    <span aria-hidden="true" className="snc-corner-dot" />
                  </button>
                ))}
              </div>
              <p className="snc-field-note">{POSITION_LABELS[draft.position]}</p>
            </fieldset>

            <div className="snc-toggles">
              <ToggleRow
                checked={draft.showOnMobile}
                disabled={!canManage}
                hint="On a phone the card sits across the bottom, above the safe area."
                label="Show on phones"
                onChange={(value) => set("showOnMobile", value)}
              />
            </div>
          </section>

          <section className="snc-panel">
            <header className="snc-panel-head">
              <BellRing aria-hidden="true" />
              <div>
                <h3>How often</h3>
                <p>
                  A card that will not stop is the reason people install blockers. These four
                  numbers are the difference between proof and pestering.
                </p>
              </div>
            </header>

            <div className="snc-sliders">
              <SliderRow
                disabled={!canManage}
                hint="Long enough for the page to land first."
                label="Wait before the first card"
                max={120}
                min={0}
                onChange={(value) => set("initialDelaySeconds", value)}
                step={1}
                unit="s"
                value={draft.initialDelaySeconds}
              />
              <SliderRow
                disabled={!canManage}
                hint="Hovering pauses it, so this is a floor and not a limit."
                label="Each card stays for"
                max={30}
                min={3}
                onChange={(value) => set("displaySeconds", value)}
                step={1}
                unit="s"
                value={draft.displaySeconds}
              />
              <SliderRow
                disabled={!canManage}
                hint="Quiet time between one card and the next."
                label="Gap between cards"
                max={300}
                min={5}
                onChange={(value) => set("gapSeconds", value)}
                step={5}
                unit="s"
                value={draft.gapSeconds}
              />
              <SliderRow
                disabled={!canManage}
                hint="Then it stops for the rest of the visit."
                label="Cards per visitor"
                max={30}
                min={1}
                onChange={(value) => set("maxPerSession", value)}
                step={1}
                unit=""
                value={draft.maxPerSession}
              />
            </div>

            <div className="snc-toggles">
              <ToggleRow
                checked={draft.loopFeed}
                disabled={!canManage}
                hint="Off, it stops once every recent order has been shown once."
                label="Start again when the orders run out"
                onChange={(value) => set("loopFeed", value)}
              />
            </div>
          </section>

          <section className="snc-panel">
            <header className="snc-panel-head">
              <Eye aria-hidden="true" />
              <div>
                <h3>Which orders count</h3>
                <p>
                  Every status counts by default, because on cash on delivery most real sales sit in
                  Pending for days. Orders you marked fake are never shown, whatever you pick here.
                </p>
              </div>
            </header>

            <fieldset className="snc-field">
              <legend>Order status</legend>
              <div className="snc-chips" role="group">
                {SALES_NOTIFICATION_ORDER_STATUSES.map((option) => {
                  const checked = draft.orderStatuses.includes(option);

                  return (
                    <button
                      aria-pressed={checked}
                      className="snc-chip"
                      disabled={!canManage}
                      key={option}
                      onClick={() => toggleStatus(option)}
                      type="button"
                    >
                      {ORDER_STATUS_LABELS[option]}
                    </button>
                  );
                })}
              </div>
              <p className="snc-field-note">
                {draft.orderStatuses.includes("CANCELLED")
                  ? "Cancelled is included — a cancelled order is one your shop says did not go through, so a shopper may see a purchase you have already undone."
                  : "Pick at least one. A shopper only ever sees the statuses ticked here."}
              </p>
            </fieldset>

            <div className="snc-toggles">
              <ToggleRow
                checked={draft.requirePublicProduct}
                disabled={!canManage}
                hint="Off, an order for a deleted or hidden product still shows — with the name it was sold under and no link, since there is nowhere to send anyone."
                label="Only advertise products still on sale"
                onChange={(value) => set("requirePublicProduct", value)}
              />
            </div>

            <fieldset className="snc-field">
              <legend>Only orders from the last</legend>
              <div className="snc-chips" role="group">
                {LOOKBACK_OPTIONS.map((option) => (
                  <button
                    aria-pressed={draft.lookbackDays === option}
                    className="snc-chip"
                    disabled={!canManage}
                    key={option}
                    onClick={() => set("lookbackDays", option)}
                    type="button"
                  >
                    {option === 1 ? "24 hours" : `${option} days`}
                  </button>
                ))}
              </div>
              <p className="snc-field-note">
                {hasOrders
                  ? `${capability.eligibleOrders} ${capability.eligibleOrders === 1 ? "order qualifies" : "orders qualify"} right now.`
                  : "No orders qualify right now, so nothing will be shown until one does."}
              </p>
            </fieldset>
          </section>
        </div>

        <aside className="snc-preview-column">
          <div className="snc-preview-head">
            <h3>Live preview</h3>
            <button
              className="snc-replay"
              onClick={() => setReplayKey((current) => current + 1)}
              type="button"
            >
              <RotateCcw aria-hidden="true" />
              Replay
            </button>
          </div>

          <div className="snc-preview" data-position={draft.position}>
            <div className="snc-preview-chrome">
              <span className="snc-preview-dots" />
              <span className="snc-preview-url">{storefrontUrl.replace(/^https?:\/\//, "")}</span>
            </div>
            <div aria-hidden="true" className="snc-preview-page">
              <span className="snc-preview-hero" />
              <span className="snc-preview-tile" />
              <span className="snc-preview-tile" />
              <span className="snc-preview-tile" />
              <span className="snc-preview-tile" />
            </div>
            <div className="snc-preview-slot" key={replayKey}>
              <SalesNotificationCard
                event={previewEvent}
                progressSeconds={draft.displaySeconds}
                showTimeAgo={draft.showTimeAgo}
              />
            </div>
          </div>

          <p className="snc-preview-note">
            {sample
              ? "Drawn from your most recent qualifying order, redacted exactly as a shopper would see it."
              : "An example. Once this shop has an order, the preview uses it instead."}
          </p>
        </aside>
      </div>

      <div className="snc-savebar">
        <p className={`snc-save-state${state.status === "error" ? " snc-save-error" : ""}`}>
          {state.status === "error"
            ? state.message
            : isDirty
              ? "Unsaved changes"
              : (state.message ?? "Everything here is saved.")}
        </p>

        {canManage ? (
          <button className="primary" disabled={isPending || !isDirty} type="submit">
            {isPending ? <Loader2 aria-hidden="true" className="snc-spin" /> : null}
            {isPending ? "Saving…" : "Save changes"}
          </button>
        ) : (
          <p className="snc-save-state">Only the store owner or an admin can change these.</p>
        )}

        {capability.entitled ? null : (
          <Link className="secondary link-button" href={BILLING_UPGRADE_PATH}>
            See plans
          </Link>
        )}
      </div>
    </form>
  );
}

function ToggleRow({
  checked,
  disabled,
  hint,
  label,
  onChange
}: {
  checked: boolean;
  disabled: boolean;
  hint: string;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      aria-checked={checked}
      className="snc-toggle"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span aria-hidden="true" className="snc-switch-track">
        <span className="snc-switch-knob" />
      </span>
      <span className="snc-switch-label">
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
    </button>
  );
}

function SliderRow({
  disabled,
  hint,
  label,
  max,
  min,
  onChange,
  step,
  unit,
  value
}: {
  disabled: boolean;
  hint: string;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  unit: string;
  value: number;
}) {
  return (
    <label className="snc-slider">
      <span className="snc-slider-head">
        <strong>{label}</strong>
        <output>
          {value}
          {unit}
        </output>
      </span>
      <input
        disabled={disabled}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
      <small>{hint}</small>
    </label>
  );
}

const NAME_DISPLAY_OPTIONS: Array<{ label: string; value: SalesNotificationNameDisplay }> = [
  { label: "First name", value: "first_name" },
  { label: "First + initial", value: "initial" },
  { label: "Anonymous", value: "anonymous" }
];

/** Sentence case, matching how the orders table names them. */
const ORDER_STATUS_LABELS: Record<SalesNotificationOrderStatus, string> = {
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  CONFIRMED: "Confirmed",
  PENDING: "Pending",
  PROCESSING: "Processing"
};

const POSITION_LABELS: Record<SalesNotificationPosition, string> = {
  "bottom-left": "Bottom left",
  "bottom-right": "Bottom right",
  "top-left": "Top left",
  "top-right": "Top right"
};

/** The windows a seller actually reaches for, rather than a free number box. */
const LOOKBACK_OPTIONS = [1, 3, 7, 14, 30, 60, 90];

function sameSettings(a: SalesNotificationSettings, b: SalesNotificationSettings) {
  return (
    a.displaySeconds === b.displaySeconds &&
    a.enabled === b.enabled &&
    a.gapSeconds === b.gapSeconds &&
    a.initialDelaySeconds === b.initialDelaySeconds &&
    a.lookbackDays === b.lookbackDays &&
    a.loopFeed === b.loopFeed &&
    a.maxPerSession === b.maxPerSession &&
    a.nameDisplay === b.nameDisplay &&
    a.orderStatuses.join(",") === b.orderStatuses.join(",") &&
    a.position === b.position &&
    a.requirePublicProduct === b.requirePublicProduct &&
    a.showLocation === b.showLocation &&
    a.showOnMobile === b.showOnMobile &&
    a.showProductImage === b.showProductImage &&
    a.showTimeAgo === b.showTimeAgo
  );
}
