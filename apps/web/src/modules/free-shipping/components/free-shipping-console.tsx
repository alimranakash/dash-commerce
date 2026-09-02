"use client";

import { Loader2, Truck } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { ShippingProgress } from "../../cart/components/shipping-progress";
import { formatStorefrontMoney } from "../../storefront/format";
import type { FreeShippingSettingsState } from "../free-shipping.actions";
import {
  formatFreeShippingMessage,
  freeShippingProgress,
  resolveShippingCharge
} from "../free-shipping.render";
import {
  FREE_SHIPPING_SURFACES,
  toFreeShippingRule,
  type FreeShippingSettings,
  type FreeShippingSurface
} from "../free-shipping.schema";

const initialState: FreeShippingSettingsState = { status: "idle" };

export type FreeShippingZone = {
  id: string;
  name: string;
  /** The rates in this zone, so the panel can show what is being given away. */
  rates: Array<{ amount: string; name: string }>;
};

/**
 * Shipping → Free shipping.
 *
 * On the shipping page rather than under Marketing, because the thing this
 * panel edits is a *price*: switching it on means orders over the threshold stop
 * paying for delivery. The bar is only how that is announced, and putting the
 * announcement somewhere else would have re-created the split this module was
 * written to close — a marketing screen promising a discount no shipping screen
 * knew about.
 *
 * The preview is the real `ShippingProgress`, fed by the real
 * `freeShippingProgress`, against a cart the seller moves with a slider. What
 * they watch here is exactly what a shopper sees, including the sentence
 * changing at the moment it is earned.
 */
export function FreeShippingConsole({
  action,
  canManage,
  currency,
  settings,
  zones
}: {
  action: (
    state: FreeShippingSettingsState,
    formData: FormData
  ) => Promise<FreeShippingSettingsState>;
  canManage: boolean;
  currency: string;
  settings: FreeShippingSettings;
  zones: FreeShippingZone[];
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const saved = state.settings ?? settings;

  const [draft, setDraft] = useState<FreeShippingSettings>(saved);
  const [lastSaved, setLastSaved] = useState(saved);
  /** Where the seller has dragged the example cart, as a fraction of the threshold. */
  const [previewFraction, setPreviewFraction] = useState(0.6);

  if (saved !== lastSaved) {
    setLastSaved(saved);
    setDraft(saved);
  }

  const set = <K extends keyof FreeShippingSettings>(key: K, value: FreeShippingSettings[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const isDirty = !sameSettings(draft, saved);
  const rule = useMemo(() => toFreeShippingRule(draft), [draft]);
  const exampleSubtotal = draft.threshold > 0 ? draft.threshold * previewFraction : 0;
  const progress = freeShippingProgress(rule, exampleSubtotal);

  const toggleSurface = (surface: FreeShippingSurface) => {
    const checked = draft.surfaces.includes(surface);

    set(
      "surfaces",
      checked
        ? draft.surfaces.filter((entry) => entry !== surface)
        : FREE_SHIPPING_SURFACES.filter(
            (entry) => entry === surface || draft.surfaces.includes(entry)
          )
    );
  };

  const toggleZone = (zoneId: string) => {
    const checked = draft.zoneIds.includes(zoneId);

    set(
      "zoneIds",
      checked ? draft.zoneIds.filter((entry) => entry !== zoneId) : [...draft.zoneIds, zoneId]
    );
  };

  return (
    <form action={formAction} className="snc-console">
      <input name="enabled" type="hidden" value={draft.enabled ? "on" : "off"} />
      <input name="barEnabled" type="hidden" value={draft.barEnabled ? "on" : "off"} />
      <input name="threshold" type="hidden" value={String(draft.threshold)} />
      <input name="zoneIds" type="hidden" value={draft.zoneIds.join(",")} />
      <input name="surfaces" type="hidden" value={draft.surfaces.join(",")} />
      <input name="barText" type="hidden" value={draft.barText} />
      <input name="barSuccessText" type="hidden" value={draft.barSuccessText} />

      <section className={`snc-hero${draft.enabled ? " snc-hero-live" : ""}`}>
        <div className="snc-hero-main">
          <p className="snc-hero-state">
            <span aria-hidden="true" className={`snc-dot${draft.enabled ? " snc-dot-live" : ""}`} />
            {draft.enabled ? "Free shipping is on" : "Every order pays for delivery"}
          </p>

          <h2>
            {draft.enabled
              ? `Orders over ${formatStorefrontMoney(draft.threshold, currency)} ship free`
              : "No order gets free delivery yet"}
          </h2>

          <p className="snc-hero-copy">
            This is a price, not a banner. Switching it on means checkout stops charging delivery on
            orders that reach your threshold — and the progress bar in the cart is simply that rule,
            said out loud. There is no way here to advertise an offer your checkout will not give.
          </p>
        </div>

        <button
          aria-checked={draft.enabled}
          className="snc-switch"
          disabled={!canManage || isPending}
          onClick={() => set("enabled", !draft.enabled)}
          role="switch"
          type="button"
        >
          <span aria-hidden="true" className="snc-switch-track">
            <span className="snc-switch-knob" />
          </span>
          <span className="snc-switch-label">
            <strong>Give free shipping over a set order value</strong>
            <small>
              {draft.enabled
                ? "Qualifying orders are not charged for delivery."
                : "Your normal delivery rates apply to every order."}
            </small>
          </span>
        </button>
      </section>

      <div className="snc-grid">
        <div className="snc-columns">
          <section className="snc-panel">
            <header className="snc-panel-head">
              <Truck aria-hidden="true" />
              <div>
                <h3>The rule</h3>
                <p>
                  The cart subtotal that earns free delivery. This is the number the bar counts
                  towards and the number checkout charges by &mdash; there is only one of it.
                </p>
              </div>
            </header>

            <label className="nbc-text">
              <span className="nbc-text-head">
                <strong>Free shipping over</strong>
                <small>{formatStorefrontMoney(draft.threshold, currency)}</small>
              </span>
              <input
                disabled={!canManage}
                inputMode="decimal"
                min="0"
                onChange={(event) => set("threshold", Number(event.target.value) || 0)}
                step="1"
                type="number"
                value={draft.threshold || ""}
              />
              <small>
                Counted on the cart subtotal, before delivery. To make delivery free for everyone,
                set your rates to 0 instead of using a threshold.
              </small>
            </label>

            <fieldset className="snc-field">
              <legend>Which zones it covers</legend>
              <div className="snc-chips" role="group">
                {zones.map((zone) => (
                  <button
                    aria-pressed={draft.zoneIds.length === 0 || draft.zoneIds.includes(zone.id)}
                    className="snc-chip"
                    disabled={!canManage}
                    key={zone.id}
                    onClick={() => toggleZone(zone.id)}
                    type="button"
                  >
                    {zone.name}
                  </button>
                ))}
              </div>
              <p className="snc-field-note">
                {draft.zoneIds.length === 0
                  ? "Every zone, including any you add later."
                  : `Only ${draft.zoneIds.length} of ${zones.length} zones. Orders to the others still pay delivery.`}
              </p>
            </fieldset>

            {/* What the seller is actually giving away, in their own numbers. A
              threshold is easy to set without doing this arithmetic. */}
            <div className="nbc-warning" hidden={!draft.enabled}>
              {zones
                .filter((zone) => draft.zoneIds.length === 0 || draft.zoneIds.includes(zone.id))
                .flatMap((zone) => zone.rates.map((rate) => `${rate.name} ${rate.amount}`))
                .slice(0, 4)
                .join(" · ") || "No enabled rates in the zones you picked."}
              {" — "}
              this is what you absorb on every qualifying order.
            </div>
          </section>

          <section className="snc-panel">
            <header className="snc-panel-head">
              <Truck aria-hidden="true" />
              <div>
                <h3>The bar</h3>
                <p>
                  How the offer is announced. It cannot be switched on without the rule above,
                  because a progress bar with nothing behind it is the thing this page replaced.
                </p>
              </div>
            </header>

            <button
              aria-checked={draft.barEnabled}
              className="snc-toggle"
              disabled={!canManage || !draft.enabled}
              onClick={() => set("barEnabled", !draft.barEnabled)}
              role="switch"
              type="button"
            >
              <span aria-hidden="true" className="snc-switch-track">
                <span className="snc-switch-knob" />
              </span>
              <span className="snc-switch-label">
                <strong>Show the progress bar</strong>
                <small>
                  {draft.enabled
                    ? "Shoppers see how close they are to earning it."
                    : "Switch free shipping on first."}
                </small>
              </span>
            </button>

            <fieldset className="snc-field" disabled={!draft.barEnabled}>
              <legend>Where it appears</legend>
              <div className="snc-chips" role="group">
                {FREE_SHIPPING_SURFACES.map((surface) => (
                  <button
                    aria-pressed={draft.surfaces.includes(surface)}
                    className="snc-chip"
                    disabled={!canManage || !draft.barEnabled}
                    key={surface}
                    onClick={() => toggleSurface(surface)}
                    type="button"
                  >
                    {SURFACE_LABELS[surface]}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="nbc-text">
              <span className="nbc-text-head">
                <strong>While they are short</strong>
                <small>{draft.barText.length}/120</small>
              </span>
              <input
                disabled={!canManage || !draft.barEnabled}
                maxLength={120}
                onChange={(event) => set("barText", event.target.value)}
                type="text"
                value={draft.barText}
              />
              <small>
                <code>{"{amount}"}</code> becomes how much more they need.
              </small>
            </label>

            <label className="nbc-text">
              <span className="nbc-text-head">
                <strong>Once they have earned it</strong>
                <small>{draft.barSuccessText.length}/120</small>
              </span>
              <input
                disabled={!canManage || !draft.barEnabled}
                maxLength={120}
                onChange={(event) => set("barSuccessText", event.target.value)}
                type="text"
                value={draft.barSuccessText}
              />
              <small>Shown from the moment the cart reaches your threshold.</small>
            </label>
          </section>
        </div>

        <aside className="snc-preview-column">
          <div className="snc-preview-head">
            <h3>Live preview</h3>
          </div>

          <div className="fsc-preview">
            {progress ? (
              <ShippingProgress
                bar={{
                  message: progress.qualifies
                    ? formatFreeShippingMessage(
                        draft.barSuccessText,
                        formatStorefrontMoney(progress.threshold, currency)
                      )
                    : formatFreeShippingMessage(
                        draft.barText,
                        formatStorefrontMoney(progress.remaining, currency)
                      ),
                  percent: progress.percent,
                  qualifies: progress.qualifies
                }}
                ctaHref="#"
                ctaText=""
              />
            ) : (
              <p className="snc-field-note">
                Set a threshold and switch free shipping on to see the bar.
              </p>
            )}
          </div>

          <label className="nbc-text">
            <span className="nbc-text-head">
              <strong>Example cart</strong>
              <small>{formatStorefrontMoney(exampleSubtotal, currency)}</small>
            </span>
            <input
              max={120}
              min={0}
              onChange={(event) => setPreviewFraction(Number(event.target.value) / 100)}
              step={5}
              type="range"
              value={Math.round(previewFraction * 100)}
            />
            <small>
              Drag past the threshold to see what a shopper is told once they have earned it.
            </small>
          </label>

          {/* The arithmetic that matters, said plainly: at this cart, this is
            what the shopper is charged for delivery. */}
          <p className="snc-preview-note">
            {draft.enabled && draft.threshold > 0
              ? `At this cart, delivery costs ${formatStorefrontMoney(
                  Number(
                    resolveShippingCharge(rule, {
                      rateAmount: zones[0]?.rates[0]?.amount ?? "0",
                      subtotal: exampleSubtotal,
                      zoneId: zones[0]?.id ?? ""
                    })
                  ),
                  currency
                )} on your ${zones[0]?.name ?? "first"} rate.`
              : "Free shipping is off, so every order pays your normal delivery rate."}
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
      </div>
    </form>
  );
}

const SURFACE_LABELS: Record<FreeShippingSurface, string> = {
  cart: "Cart page",
  mini_cart: "Cart drawer",
  product: "Product page"
};

function sameSettings(a: FreeShippingSettings, b: FreeShippingSettings) {
  return (
    a.barEnabled === b.barEnabled &&
    a.barSuccessText === b.barSuccessText &&
    a.barText === b.barText &&
    a.enabled === b.enabled &&
    a.surfaces.join(",") === b.surfaces.join(",") &&
    a.threshold === b.threshold &&
    a.zoneIds.join(",") === b.zoneIds.join(",")
  );
}
