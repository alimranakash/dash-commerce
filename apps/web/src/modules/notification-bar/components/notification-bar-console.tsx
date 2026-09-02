"use client";

import {
  CalendarClock,
  ExternalLink,
  LayoutTemplate,
  Loader2,
  Megaphone,
  Palette,
  Timer
} from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useState, type CSSProperties } from "react";
import { minPlanForFeature } from "../../admin/plan-catalog";
import { BILLING_UPGRADE_PATH, PaidBadge } from "../../billing/components/paid-badge";
import { useUpgradePrompt } from "../../billing/components/plan-upgrade-provider";
import type { NotificationBarSettingsState } from "../notification-bar.actions";
import {
  barRevision,
  barWindowState,
  isSafeBarHref,
  resolveBarLink
} from "../notification-bar.render";
import {
  NOTIFICATION_BAR_DISPLAYS,
  NOTIFICATION_BAR_HOME_SLOTS,
  NOTIFICATION_BAR_LAYOUTS,
  NOTIFICATION_BAR_POSITIONS,
  NOTIFICATION_BAR_PRODUCT_SLOTS,
  NOTIFICATION_BAR_SHOP_SLOTS,
  NOTIFICATION_BAR_SURFACES,
  type NotificationBarDisplay,
  type NotificationBarHomeSlot,
  type NotificationBarLayout,
  type NotificationBarPosition,
  type NotificationBarProductSlot,
  type NotificationBarSettings,
  type NotificationBarShopSlot,
  type NotificationBarSurface,
  type NotificationBarView
} from "../notification-bar.schema";
import type { NotificationBarCapability } from "../notification-bar.service";
import { NotificationBar } from "./notification-bar";

/** The key this page is sold under, for the badge and the upgrade dialog. */
const FEATURE = "notification_bar" as const;

/** Read from the catalog so re-pricing does not leave this page naming a tier. */
const unlockingPlan = minPlanForFeature(FEATURE);

const initialState: NotificationBarSettingsState = { status: "idle" };

/** What the preview says before the seller has typed their own line. */
const EXAMPLE_HEADLINE = "20% OFF";

/**
 * Marketing → Notification Bar, the whole page below the shell.
 *
 * One client component rather than a server status panel with a form under it,
 * for the reason `sales-notifications-console.tsx` sets out: the badge, the
 * headline and the switch are views of the same facts, and splitting them across
 * a server render and a client form is what produces a page reading "Switched
 * off" above a toggle the seller has just turned on.
 *
 * The preview is why this page is worth building rather than shipping four text
 * inputs. It is the **same component the storefront mounts**, given the same
 * `NotificationBarView` the server would build — the link narrowed by the same
 * `resolveBarLink`, the countdown ticking off the same `endsAt` — so a seller
 * watches their real bar count down in their real colours before a single
 * shopper sees it. A promotion whose deadline can only be checked by publishing
 * it is a promotion that gets published wrong.
 */
export function NotificationBarConsole({
  action,
  canManage,
  capability: initialCapability,
  settings,
  storePrimaryColor,
  storefrontUrl
}: {
  action: (
    state: NotificationBarSettingsState,
    formData: FormData
  ) => Promise<NotificationBarSettingsState>;
  canManage: boolean;
  capability: NotificationBarCapability;
  settings: NotificationBarSettings;
  /** So the preview's "your shop's colour" is actually this shop's colour. */
  storePrimaryColor: string;
  storefrontUrl: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const { openUpgrade } = useUpgradePrompt();

  const capability = state.capability ?? initialCapability;
  const saved = state.settings ?? settings;

  const [draft, setDraft] = useState<NotificationBarSettings>(saved);
  const [lastSaved, setLastSaved] = useState(saved);

  // A save the plan refused opens the same dialog every other gated form opens.
  // Keyed on `state` so a second refused attempt re-opens it after a dismissal.
  useEffect(() => {
    openUpgrade(state.lockedFeature);
  }, [openUpgrade, state]);

  // Adopt the server's word whenever it changes — React's pattern for adjusting
  // state to a changed input, which is why it is a render-phase set rather than
  // an effect. A refused save returns no settings, so the seller's edits are
  // left where they put them, under the reason they were refused.
  if (saved !== lastSaved) {
    setLastSaved(saved);
    setDraft(saved);
  }

  const isDirty = !sameSettings(draft, saved);
  const windowState = barWindowState(draft, Date.now());

  const set = <K extends keyof NotificationBarSettings>(
    key: K,
    value: NotificationBarSettings[K]
  ) => setDraft((current) => ({ ...current, [key]: value }));

  /**
   * The preview's bar, built the way the server builds the real one.
   *
   * `resolveBarLink` is called here for the same reason the redaction preview in
   * Sales Notifications calls the real `redactBuyerName`: a seller who has typed
   * a destination this module will not publish must be able to see that the
   * button is missing *now*, rather than discover it on their storefront. The
   * base path is empty because nothing in the preview is clickable anyway.
   */
  const previewBar = useMemo<NotificationBarView>(() => {
    const headline = draft.headline.trim() === "" ? EXAMPLE_HEADLINE : draft.headline;
    const link = draft.ctaLabel.trim() === "" ? null : resolveBarLink("", draft.ctaHref);

    return {
      backgroundColor: draft.backgroundColor,
      buttonColor: draft.buttonColor,
      buttonTextColor: draft.buttonTextColor,
      cta: link ? { href: link.href, label: draft.ctaLabel, newTab: link.newTab } : null,
      dismissDays: draft.dismissDays,
      dismissible: draft.dismissible,
      display: draft.display,
      endsAt: draft.endsAt,
      gridAfter: draft.gridAfter,
      headline,
      homeSlot: draft.homeSlot,
      layout: draft.layout,
      message: draft.message,
      position: draft.position,
      productSlot: draft.productSlot,
      revision: barRevision({ ...draft, headline }),
      shopSlot: draft.shopSlot,
      showCountdown: draft.showCountdown && draft.endsAt !== null,
      showOnMobile: draft.showOnMobile,
      surfaces: draft.surfaces,
      textColor: draft.textColor
    };
  }, [draft]);

  /**
   * Tick a page on or off, refusing to leave the list empty.
   *
   * The last one cannot be unticked: an inline bar with no page to sit on is
   * switched on and can never appear, which a seller reads as broken rather than
   * as off. The server refuses it too — this only stops the form reaching a
   * state it would be told off for.
   */
  const toggleSurface = (surface: NotificationBarSurface) => {
    const checked = draft.surfaces.includes(surface);

    if (checked && draft.surfaces.length === 1) {
      return;
    }

    set(
      "surfaces",
      checked
        ? draft.surfaces.filter((entry) => entry !== surface)
        : // Kept in the canonical order rather than click order, so the chips and
          // the saved value read the same way every time.
          NOTIFICATION_BAR_SURFACES.filter(
            (entry) => entry === surface || draft.surfaces.includes(entry)
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

  const live = capability.enabled && capability.entitled && windowState === "open";

  return (
    <form action={formAction} className="snc-console">
      {/* Every value posts as a hidden field, so what the server parses is
          exactly the state this panel is rendering — no control can be visually
          set to one thing and submit another. */}
      <input name="enabled" type="hidden" value={draft.enabled ? "on" : "off"} />
      <input name="headline" type="hidden" value={draft.headline} />
      <input name="message" type="hidden" value={draft.message} />
      <input name="ctaLabel" type="hidden" value={draft.ctaLabel} />
      <input name="ctaHref" type="hidden" value={draft.ctaHref} />
      <input name="position" type="hidden" value={draft.position} />
      <input name="layout" type="hidden" value={draft.layout} />
      <input name="backgroundColor" type="hidden" value={draft.backgroundColor} />
      <input name="textColor" type="hidden" value={draft.textColor} />
      <input name="buttonColor" type="hidden" value={draft.buttonColor} />
      <input name="buttonTextColor" type="hidden" value={draft.buttonTextColor} />
      <input name="showCountdown" type="hidden" value={draft.showCountdown ? "on" : "off"} />
      <input name="showOnMobile" type="hidden" value={draft.showOnMobile ? "on" : "off"} />
      <input name="dismissible" type="hidden" value={draft.dismissible ? "on" : "off"} />
      <input name="dismissDays" type="hidden" value={draft.dismissDays} />
      <input name="display" type="hidden" value={draft.display} />
      <input name="surfaces" type="hidden" value={draft.surfaces.join(",")} />
      <input name="homeSlot" type="hidden" value={draft.homeSlot} />
      <input name="shopSlot" type="hidden" value={draft.shopSlot} />
      <input name="productSlot" type="hidden" value={draft.productSlot} />
      <input name="gridAfter" type="hidden" value={draft.gridAfter} />
      <input name="startsAt" type="hidden" value={draft.startsAt ?? ""} />
      <input name="endsAt" type="hidden" value={draft.endsAt ?? ""} />

      <section className={`snc-hero${live ? " snc-hero-live" : ""}`}>
        <div className="snc-hero-main">
          <p className="snc-hero-state">
            <span aria-hidden="true" className={`snc-dot${live ? " snc-dot-live" : ""}`} />
            {stateLabel(capability, windowState)}
          </p>

          <h2>
            {live
              ? "Every shopper sees your announcement"
              : capability.entitled
                ? capability.enabled
                  ? windowState === "scheduled"
                    ? "Waiting for its start time"
                    : "That end time has already passed"
                  : "Your storefront shows no announcement"
                : "The notification bar is not on this plan"}
          </h2>

          <p className="snc-hero-copy">
            {capability.entitled
              ? "One line across your shop, with a deadline that is a real moment rather than a timer that restarts for every visitor. When the countdown runs out the bar comes down by itself — there is no way here to advertise a sale that has finished."
              : unlockingPlan
                ? `Included from the ${unlockingPlan} plan up. One announcement across your whole shop, with a real countdown and a button.`
                : "Not included in your current plan."}
          </p>

          <div className="snc-hero-stats">
            <span className="snc-stat">
              <strong>{draft.endsAt ? formatDeadline(draft.endsAt) : "No end"}</strong>
              <small>
                {draft.endsAt ? "when the bar comes down" : "runs until you switch it off"}
              </small>
            </span>
            <span className="snc-stat">
              <strong>{draft.position === "top" ? "Top" : "Bottom"}</strong>
              <small>{draft.layout === "floating" ? "floating card" : "full-width bar"}</small>
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
              Show the notification bar
              {capability.entitled ? null : (
                <span className="ml-1.5 align-middle">
                  <PaidBadge feature={FEATURE} interactive={false} showPlan />
                </span>
              )}
            </strong>
            <small>
              {capability.entitled || draft.enabled
                ? draft.enabled
                  ? "It appears on every page of your shop."
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
              <Megaphone aria-hidden="true" />
              <div>
                <h3>What it says</h3>
                <p>
                  One short line people read at a glance. The bar is a single row on a phone, so a
                  sentence in it is a sentence nobody finishes.
                </p>
              </div>
            </header>

            <TextRow
              disabled={!canManage}
              hint="The big line. Short and specific beats clever."
              label="Headline"
              maxLength={60}
              onChange={(value) => set("headline", value)}
              placeholder={EXAMPLE_HEADLINE}
              value={draft.headline}
            />
            <TextRow
              disabled={!canManage}
              hint="Optional. The detail under the headline."
              label="Supporting line"
              maxLength={120}
              onChange={(value) => set("message", value)}
              placeholder="On every winter jacket, this week only"
              value={draft.message}
            />
            <TextRow
              disabled={!canManage}
              hint="Leave blank for a bar with no button."
              label="Button text"
              maxLength={28}
              onChange={(value) => set("ctaLabel", value)}
              placeholder="Shop now"
              value={draft.ctaLabel}
            />
            <TextRow
              disabled={!canManage}
              error={
                draft.ctaLabel.trim() !== "" && !isSafeBarHref(draft.ctaHref)
                  ? "A path like /products, an https:// address, or a tel: number."
                  : null
              }
              hint="A page in your shop such as /products, or a full https:// address."
              label="Button link"
              maxLength={500}
              onChange={(value) => set("ctaHref", value)}
              placeholder="/products"
              value={draft.ctaHref}
            />
          </section>

          <section className="snc-panel">
            <header className="snc-panel-head">
              <CalendarClock aria-hidden="true" />
              <div>
                <h3>When it runs</h3>
                <p>
                  The end time is the countdown and the bar&rsquo;s last moment, together. That is
                  deliberate: a timer that finishes while the bar stays up is an offer your shop is
                  still advertising and no longer honouring.
                </p>
              </div>
            </header>

            <div className="nbc-dates">
              <DateRow
                disabled={!canManage}
                hint="Leave blank to start as soon as you save. Before this, your storefront shows nothing at all."
                label="Starts"
                onChange={(value) => set("startsAt", value)}
                value={draft.startsAt}
              />
              <DateRow
                disabled={!canManage}
                hint="Leave blank to run until you switch it off — the countdown needs one."
                label="Ends"
                onChange={(value) => set("endsAt", value)}
                value={draft.endsAt}
              />
            </div>

            <div className="snc-chips" role="group">
              {DEADLINE_PRESETS.map((preset) => (
                <button
                  className="snc-chip"
                  disabled={!canManage}
                  key={preset.label}
                  onClick={() => set("endsAt", new Date(Date.now() + preset.ms).toISOString())}
                  type="button"
                >
                  Ends in {preset.label}
                </button>
              ))}
              <button
                className="snc-chip"
                disabled={!canManage || draft.endsAt === null}
                onClick={() => {
                  set("endsAt", null);
                  set("showCountdown", false);
                }}
                type="button"
              >
                No end
              </button>
            </div>

            <div className="snc-toggles">
              <ToggleRow
                checked={draft.showCountdown && draft.endsAt !== null}
                disabled={!canManage || draft.endsAt === null}
                hint={
                  draft.endsAt === null
                    ? "Set an end time first — that is the number a countdown counts down to."
                    : "Days, hours, minutes and seconds, the same for every shopper in the world."
                }
                label="Show the countdown"
                onChange={(value) => set("showCountdown", value)}
              />
            </div>

            {windowState === "ended" && draft.enabled ? (
              <p className="nbc-warning">
                That end time is in the past, so this cannot be saved while the bar is on. Pick a
                new one, clear it, or switch the bar off.
              </p>
            ) : null}
          </section>

          <section className="snc-panel">
            <header className="snc-panel-head">
              <LayoutTemplate aria-hidden="true" />
              <div>
                <h3>Where it appears</h3>
                <p>
                  A floating bar is pinned to the screen and follows shoppers around your whole
                  shop. Placed in the page, it scrolls with the content and you choose the spot on
                  each page &mdash; which is the one that can sit next to an Add to Cart button.
                </p>
              </div>
            </header>

            <fieldset className="snc-field">
              <legend>How it is attached</legend>
              <div className="snc-seg" role="group">
                {NOTIFICATION_BAR_DISPLAYS.map((option) => (
                  <button
                    aria-pressed={draft.display === option}
                    className="snc-seg-item"
                    disabled={!canManage}
                    key={option}
                    onClick={() => set("display", option)}
                    type="button"
                  >
                    <strong>{DISPLAY_LABELS[option]}</strong>
                    <small>{DISPLAY_HINTS[option]}</small>
                  </button>
                ))}
              </div>
            </fieldset>

            {draft.display === "inline" ? (
              <>
                <fieldset className="snc-field">
                  <legend>Pages</legend>
                  <div className="snc-chips" role="group">
                    {NOTIFICATION_BAR_SURFACES.map((option) => (
                      <button
                        aria-pressed={draft.surfaces.includes(option)}
                        className="snc-chip"
                        disabled={!canManage}
                        key={option}
                        onClick={() => toggleSurface(option)}
                        type="button"
                      >
                        {SURFACE_LABELS[option]}
                      </button>
                    ))}
                  </div>
                  <p className="snc-field-note">
                    Pick at least one. Everywhere else covers your categories, search, cart and
                    account pages, where the bar goes above the content.
                  </p>
                </fieldset>

                {draft.surfaces.includes("home") ? (
                  <SlotRow
                    disabled={!canManage}
                    label="On the home page"
                    labels={HOME_SLOT_LABELS}
                    onChange={(value) => set("homeSlot", value)}
                    options={NOTIFICATION_BAR_HOME_SLOTS}
                    value={draft.homeSlot}
                  />
                ) : null}

                {draft.surfaces.includes("shop") ? (
                  <>
                    <SlotRow
                      disabled={!canManage}
                      label="On the shop page"
                      labels={SHOP_SLOT_LABELS}
                      onChange={(value) => set("shopSlot", value)}
                      options={NOTIFICATION_BAR_SHOP_SLOTS}
                      value={draft.shopSlot}
                    />
                    {draft.shopSlot === "in_grid" ? (
                      <label className="nbc-text">
                        <span className="nbc-text-head">
                          <strong>After how many products</strong>
                          <small>{draft.gridAfter}</small>
                        </span>
                        <input
                          disabled={!canManage}
                          max={24}
                          min={1}
                          onChange={(event) => set("gridAfter", Number(event.target.value))}
                          step={1}
                          type="range"
                          value={draft.gridAfter}
                        />
                        <small>
                          It spans the full width of the grid. On a page showing fewer products than
                          this, it goes after the last one.
                        </small>
                      </label>
                    ) : null}
                  </>
                ) : null}

                {draft.surfaces.includes("product") ? (
                  <SlotRow
                    disabled={!canManage}
                    label="On a product page"
                    labels={PRODUCT_SLOT_LABELS}
                    onChange={(value) => set("productSlot", value)}
                    options={NOTIFICATION_BAR_PRODUCT_SLOTS}
                    value={draft.productSlot}
                  />
                ) : null}
              </>
            ) : (
              <p className="snc-field-note">
                A floating bar shows on every page of your shop. To put it on particular pages, or
                beside your Add to Cart button, place it in the page instead.
              </p>
            )}
          </section>

          <section className="snc-panel">
            <header className="snc-panel-head">
              <Palette aria-hidden="true" />
              <div>
                <h3>How it looks</h3>
                <p>
                  Bottom is the default for a floating bar: the top of your shop already has your
                  name, your menu and your search box, and a bar over them covers the things people
                  came for.
                </p>
              </div>
            </header>

            <fieldset className="snc-field" disabled={draft.display === "inline"}>
              <legend>
                Position
                {draft.display === "inline" ? " (floating bars only)" : ""}
              </legend>
              <div className="snc-seg" role="group">
                {NOTIFICATION_BAR_POSITIONS.map((option) => (
                  <button
                    aria-pressed={draft.position === option}
                    className="snc-seg-item"
                    disabled={!canManage}
                    key={option}
                    onClick={() => set("position", option)}
                    type="button"
                  >
                    <strong>{POSITION_LABELS[option]}</strong>
                    <small>{POSITION_HINTS[option]}</small>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="snc-field">
              <legend>Shape</legend>
              <div className="snc-seg" role="group">
                {NOTIFICATION_BAR_LAYOUTS.map((option) => (
                  <button
                    aria-pressed={draft.layout === option}
                    className="snc-seg-item"
                    disabled={!canManage}
                    key={option}
                    onClick={() => set("layout", option)}
                    type="button"
                  >
                    <strong>{LAYOUT_LABELS[option]}</strong>
                    <small>{LAYOUT_HINTS[option]}</small>
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="nbc-colors">
              <ColorRow
                disabled={!canManage}
                fallback={storePrimaryColor}
                fallbackLabel="Your shop's colour"
                label="Bar"
                onChange={(value) => set("backgroundColor", value)}
                value={draft.backgroundColor}
              />
              <ColorRow
                disabled={!canManage}
                fallback="#ffffff"
                fallbackLabel="White"
                label="Text"
                onChange={(value) => set("textColor", value)}
                value={draft.textColor}
              />
              <ColorRow
                disabled={!canManage}
                fallback="#ffffff"
                fallbackLabel="White"
                label="Button"
                onChange={(value) => set("buttonColor", value)}
                value={draft.buttonColor}
              />
              <ColorRow
                disabled={!canManage}
                fallback={draft.backgroundColor || storePrimaryColor}
                fallbackLabel="Match the bar"
                label="Button text"
                onChange={(value) => set("buttonTextColor", value)}
                value={draft.buttonTextColor}
              />
            </div>
          </section>

          <section className="snc-panel">
            <header className="snc-panel-head">
              <Timer aria-hidden="true" />
              <div>
                <h3>How it behaves</h3>
                <p>
                  A shopper who closes the bar is telling you something. Closing it hides{" "}
                  <em>this</em> announcement only — when you next change what it says, they see the
                  new one.
                </p>
              </div>
            </header>

            <div className="snc-toggles">
              <ToggleRow
                checked={draft.dismissible}
                disabled={!canManage}
                hint="A bar with no way out is the reason people install blockers."
                label="Let shoppers close it"
                onChange={(value) => set("dismissible", value)}
              />
              <ToggleRow
                checked={draft.showOnMobile}
                disabled={!canManage}
                hint="On a phone the bar wraps to two rows and keeps the button full width."
                label="Show on phones"
                onChange={(value) => set("showOnMobile", value)}
              />
            </div>

            <fieldset className="snc-field">
              <legend>Once closed, stay closed for</legend>
              <div className="snc-chips" role="group">
                {DISMISS_OPTIONS.map((option) => (
                  <button
                    aria-pressed={draft.dismissDays === option.days}
                    className="snc-chip"
                    disabled={!canManage || !draft.dismissible}
                    key={option.days}
                    onClick={() => set("dismissDays", option.days)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="snc-field-note">
                Counted from when they close it, and remembered in their browser only.
              </p>
            </fieldset>
          </section>
        </div>

        <aside className="snc-preview-column">
          <div className="snc-preview-head">
            <h3>Live preview</h3>
          </div>

          <div
            className="snc-preview nbc-preview"
            data-position={draft.position}
            // The shop's own primary, so "your shop's colour" is not a promise
            // this panel makes and the storefront keeps differently.
            style={{ "--sf-primary": storePrimaryColor } as CSSProperties}
          >
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
            <div className="nbc-preview-slot">
              <NotificationBar bar={previewBar} preview />
            </div>
          </div>

          <p className="snc-preview-note">
            {draft.endsAt
              ? "The countdown here is the real one, ticking down to the moment you set."
              : "No end time, so no countdown. Set one above to see it."}
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

function TextRow({
  disabled,
  error = null,
  hint,
  label,
  maxLength,
  onChange,
  placeholder,
  value
}: {
  disabled: boolean;
  error?: string | null | undefined;
  hint: string;
  label: string;
  maxLength: number;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="nbc-text">
      <span className="nbc-text-head">
        <strong>{label}</strong>
        <small>
          {value.length}/{maxLength}
        </small>
      </span>
      <input
        disabled={disabled}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type="text"
        value={value}
      />
      <small className={error ? "nbc-text-error" : ""}>{error ?? hint}</small>
    </label>
  );
}

/**
 * A date the seller reads on their own wall clock.
 *
 * `datetime-local` carries no time zone, so the conversion to and from ISO
 * happens here — in the browser, which is the only place that knows which zone
 * the seller meant. Everything below this component is UTC.
 */
function DateRow({
  disabled,
  hint,
  label,
  onChange,
  value
}: {
  disabled: boolean;
  hint: string;
  label: string;
  onChange: (value: string | null) => void;
  value: string | null;
}) {
  return (
    <label className="nbc-text">
      <span className="nbc-text-head">
        <strong>{label}</strong>
      </span>
      <input
        disabled={disabled}
        onChange={(event) => onChange(fromLocalInput(event.target.value))}
        type="datetime-local"
        value={toLocalInput(value)}
      />
      <small>{hint}</small>
    </label>
  );
}

/**
 * A colour, with the shop's own as the way out.
 *
 * The reset is not a nicety: an empty value is what makes the bar follow the
 * storefront's palette when a seller re-themes their shop, and a colour picker
 * has no way to express "unset" on its own — every one of them lands on some
 * hex the moment it is opened.
 */
function ColorRow({
  disabled,
  fallback,
  fallbackLabel,
  label,
  onChange,
  value
}: {
  disabled: boolean;
  fallback: string;
  fallbackLabel: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="nbc-color">
      <span className="nbc-color-head">
        <strong>{label}</strong>
        <small>{value === "" ? fallbackLabel : value}</small>
      </span>
      <div className="nbc-color-controls">
        <input
          aria-label={`${label} colour`}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          type="color"
          value={value === "" ? normaliseHex(fallback) : normaliseHex(value)}
        />
        <button
          className="snc-chip"
          disabled={disabled || value === ""}
          onClick={() => onChange("")}
          type="button"
        >
          {fallbackLabel}
        </button>
      </div>
    </div>
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

/**
 * One "where on this page" row.
 *
 * The three surfaces have different vocabularies — a home page has a hero, a
 * shop page has a grid, a product page has a buy box — but they are the same
 * control, so they share one component rather than three near-copies that would
 * drift in spacing and wording.
 */
function SlotRow<T extends string>({
  disabled,
  label,
  labels,
  onChange,
  options,
  value
}: {
  disabled: boolean;
  label: string;
  labels: Record<T, string>;
  onChange: (value: T) => void;
  options: readonly T[];
  value: T;
}) {
  return (
    <fieldset className="snc-field">
      <legend>{label}</legend>
      <div className="snc-chips" role="group">
        {options.map((option) => (
          <button
            aria-pressed={value === option}
            className="snc-chip"
            disabled={disabled}
            key={option}
            onClick={() => onChange(option)}
            type="button"
          >
            {labels[option]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

const DISPLAY_LABELS: Record<NotificationBarDisplay, string> = {
  inline: "In the page",
  overlay: "Floating"
};

const DISPLAY_HINTS: Record<NotificationBarDisplay, string> = {
  inline: "Scrolls with the content, where you choose",
  overlay: "Pinned to the screen, on every page"
};

const SURFACE_LABELS: Record<NotificationBarSurface, string> = {
  home: "Home page",
  other: "Everywhere else",
  product: "Product page",
  shop: "Shop page"
};

const HOME_SLOT_LABELS: Record<NotificationBarHomeSlot, string> = {
  after_first_section: "After the first section",
  after_hero: "Under the hero",
  before_footer: "Above the footer",
  top: "Above everything"
};

const SHOP_SLOT_LABELS: Record<NotificationBarShopSlot, string> = {
  above_grid: "Above the products",
  before_footer: "Below the products",
  in_grid: "Inside the grid",
  top: "Above the page title"
};

const PRODUCT_SLOT_LABELS: Record<NotificationBarProductSlot, string> = {
  above_cart: "Above Add to Cart",
  below_cart: "Below Add to Cart",
  below_details: "Under the whole product",
  top: "Above everything"
};

const POSITION_LABELS: Record<NotificationBarPosition, string> = {
  bottom: "Bottom",
  top: "Top"
};

const POSITION_HINTS: Record<NotificationBarPosition, string> = {
  bottom: "Clear of your header and menu",
  top: "Over the top of your shop"
};

const LAYOUT_LABELS: Record<NotificationBarLayout, string> = {
  edge: "Full width",
  floating: "Floating"
};

const LAYOUT_HINTS: Record<NotificationBarLayout, string> = {
  edge: "Flush to the edge, square corners",
  floating: "A rounded card laid over the page"
};

/** The windows a seller actually reaches for, rather than a date box alone. */
const DEADLINE_PRESETS = [
  { label: "6 hours", ms: 6 * 60 * 60 * 1000 },
  { label: "24 hours", ms: 24 * 60 * 60 * 1000 },
  { label: "3 days", ms: 3 * 24 * 60 * 60 * 1000 },
  { label: "7 days", ms: 7 * 24 * 60 * 60 * 1000 }
];

const DISMISS_OPTIONS = [
  { days: 0, label: "This visit" },
  { days: 1, label: "A day" },
  { days: 7, label: "A week" },
  { days: 30, label: "A month" }
];

function stateLabel(capability: NotificationBarCapability, windowState: string) {
  if (!capability.entitled) {
    return "Locked";
  }

  if (!capability.enabled) {
    return "Switched off";
  }

  if (windowState === "scheduled") {
    return "Scheduled";
  }

  if (windowState === "ended") {
    return "Finished";
  }

  return "Live on your storefront";
}

/** "12 Mar, 18:00" — the seller's own zone, since it is their deadline. */
function formatDeadline(iso: string) {
  const date = new Date(iso);

  if (!Number.isFinite(date.getTime())) {
    return "No end";
  }

  return date.toLocaleString(undefined, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  });
}

function toLocalInput(iso: string | null) {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);

  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string) {
  if (value === "") {
    return null;
  }

  const date = new Date(value);

  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

/** A colour input will not accept `#abc`, so the short form is expanded for it. */
function normaliseHex(value: string) {
  const colour = value.trim();

  if (/^#[0-9a-fA-F]{6}$/.test(colour)) {
    return colour;
  }

  if (/^#[0-9a-fA-F]{3}$/.test(colour)) {
    return `#${colour
      .slice(1)
      .split("")
      .map((character) => `${character}${character}`)
      .join("")}`;
  }

  return "#2f6bff";
}

function sameSettings(a: NotificationBarSettings, b: NotificationBarSettings) {
  return (
    a.backgroundColor === b.backgroundColor &&
    a.buttonColor === b.buttonColor &&
    a.buttonTextColor === b.buttonTextColor &&
    a.ctaHref === b.ctaHref &&
    a.ctaLabel === b.ctaLabel &&
    a.dismissDays === b.dismissDays &&
    a.dismissible === b.dismissible &&
    a.display === b.display &&
    a.enabled === b.enabled &&
    a.endsAt === b.endsAt &&
    a.gridAfter === b.gridAfter &&
    a.headline === b.headline &&
    a.homeSlot === b.homeSlot &&
    a.layout === b.layout &&
    a.message === b.message &&
    a.position === b.position &&
    a.productSlot === b.productSlot &&
    a.shopSlot === b.shopSlot &&
    a.showCountdown === b.showCountdown &&
    a.showOnMobile === b.showOnMobile &&
    a.startsAt === b.startsAt &&
    a.surfaces.join(",") === b.surfaces.join(",") &&
    a.textColor === b.textColor
  );
}
