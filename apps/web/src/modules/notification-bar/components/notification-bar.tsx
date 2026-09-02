"use client";

import { X } from "lucide-react";
import { Fragment, useEffect, useMemo, useState, type CSSProperties } from "react";
import { countdownParts, padCountdown, toTimestamp } from "../notification-bar.render";
import type { NotificationBarView } from "../notification-bar.schema";

/**
 * The bar itself.
 *
 * Presentational and shared: the storefront mounts it for real, and the
 * dashboard console renders the same component as its live preview. That is the
 * point — a preview drawn by a second, simpler component is a preview that is
 * allowed to be wrong, and this is the one line of copy a seller is putting in
 * front of every customer they have.
 *
 * Four behaviours are the feature, and each is a decision rather than a detail:
 *
 * - **It takes itself down when the countdown ends.** The deadline is the bar's
 *   life, so a shopper who leaves a tab open across the end of a sale does not
 *   sit looking at "00 : 00 : 00 : 00" beside a discount that has finished. This
 *   happens whether or not the timer is visible: `endsAt` is the offer's end,
 *   not the widget's decoration.
 * - **It renders nothing until the browser has decided.** The whole bar is
 *   client-side, so a shopper who already closed it never sees it flash and
 *   vanish — the usual failure of a dismissible banner that server-renders. The
 *   trade is that it needs JavaScript, which a live countdown needs regardless.
 * - **An X is honoured, and it is about this announcement.** The dismissal is
 *   filed under the bar's own revision, so closing "20% off winter coats" does
 *   not also silence next month's Eid sale. `dismissDays: 0` keeps it to the one
 *   visit, which is what `sessionStorage` is for.
 * - **It never covers the shop's own furniture.** The dock's CSS lifts the
 *   scroll-to-top button and the sales-notification card clear of a bottom bar,
 *   and the bar sits under the shopping assistant's panel in the stack: a
 *   shopper mid-conversation is doing something more deliberate than reading an
 *   advert.
 */

const MOBILE_QUERY = "(max-width: 640px)";

/** Days, hours, minutes, seconds — the four blocks, in the order a clock reads. */
const COUNTDOWN_UNITS = ["days", "hours", "minutes", "seconds"] as const;

const COUNTDOWN_LABELS: Record<(typeof COUNTDOWN_UNITS)[number], string> = {
  days: "Days",
  hours: "Hours",
  minutes: "Minutes",
  seconds: "Seconds"
};

export type NotificationBarProps = {
  bar: NotificationBarView;
  /**
   * Dashboard preview: laid out in place rather than fixed to the viewport,
   * never dismissed, and never remembered. The countdown still ticks, because
   * the seller is deciding whether the deadline they picked reads as urgent.
   */
  preview?: boolean | undefined;
  /** Scopes the dismissal, so one shop's X is not another's. */
  storeSlug?: string | undefined;
};

export function NotificationBar({ bar, preview = false, storeSlug = "" }: NotificationBarProps) {
  const endsAtMs = useMemo(() => toTimestamp(bar.endsAt), [bar.endsAt]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  // Starts closed for everyone. The effect below opens it once the browser has
  // said whether this shopper already closed this announcement, which is what
  // keeps a dismissed bar from flashing on every page they open.
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [hiddenOnMobile, setHiddenOnMobile] = useState(false);

  useEffect(() => {
    if (preview) {
      setVisible(true);

      return;
    }

    setVisible(!isDismissed(storeSlug, bar.revision));
  }, [bar.revision, preview, storeSlug]);

  // The seller's "not on phones" switch, honoured live rather than at first
  // paint, so a rotated tablet does not keep a bar that should have gone.
  useEffect(() => {
    if (bar.showOnMobile || preview) {
      return;
    }

    const query = window.matchMedia(MOBILE_QUERY);
    const sync = () => setHiddenOnMobile(query.matches);

    sync();
    query.addEventListener("change", sync);

    return () => query.removeEventListener("change", sync);
  }, [bar.showOnMobile, preview]);

  // One second is the resolution the bar displays, so it is the resolution it
  // ticks at. No interval at all when there is no deadline: a permanent
  // announcement should not wake the page up sixty times a minute.
  useEffect(() => {
    if (endsAtMs === null) {
      return;
    }

    setNowMs(Date.now());

    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);

    return () => window.clearInterval(timer);
  }, [endsAtMs]);

  const remaining = endsAtMs === null ? null : countdownParts(endsAtMs, nowMs);
  // The deadline is the offer's end, not the timer's. A bar whose seller hid the
  // countdown still comes down at the moment it was promised to.
  const expired = !preview && remaining !== null && remaining.totalMs <= 0;

  if (!visible || dismissed || hiddenOnMobile || expired) {
    return null;
  }

  const dismiss = () => {
    setDismissed(true);
    rememberDismissal(storeSlug, bar.revision, bar.dismissDays);
  };

  return (
    <div
      className="nb-dock"
      // `data-display` is what decides fixed-versus-in-flow in CSS, and it is
      // also what the corner-widget rules key off: only an overlay pinned to the
      // bottom of the viewport can cover the scroll-to-top button, so only that
      // one lifts it.
      data-display={preview ? "inline" : bar.display}
      data-layout={bar.layout}
      // Meaningless inline — the anchor decides where an inline bar sits — but
      // still emitted so one rule set can serve both and the preview can show a
      // top-anchored overlay leaning the right way.
      data-position={bar.position}
      data-preview={preview ? "true" : "false"}
      style={barColors(bar)}
    >
      {/* `role="region"` with a name rather than an alert: this is the shop's
          own marketing, and it is on the page when the page loads. Announcing
          it would talk over whatever a screen-reader user came here to do, while
          a named landmark still lets them find and read it deliberately. */}
      <section aria-label="Store announcement" className="nb-bar">
        <div className="nb-lede">
          <p className="nb-headline">{bar.headline}</p>
          {bar.message ? <p className="nb-message">{bar.message}</p> : null}
        </div>

        {bar.showCountdown && remaining ? (
          // No `suppressHydrationWarning` needed anywhere in here: the bar does
          // not exist until the effect above opens it, so the digits are never
          // server-rendered and there is no server clock for the browser's to
          // disagree with.
          <div className="nb-countdown">
            {COUNTDOWN_UNITS.map((unit, index) => (
              <Fragment key={unit}>
                {index > 0 ? (
                  <span aria-hidden="true" className="nb-unit-sep">
                    :
                  </span>
                ) : null}
                <span className="nb-unit">
                  <span className="nb-unit-value">{padCountdown(remaining[unit])}</span>
                  <span className="nb-unit-label">{COUNTDOWN_LABELS[unit]}</span>
                </span>
              </Fragment>
            ))}
          </div>
        ) : null}

        {bar.cta ? (
          <a
            className="nb-cta"
            href={bar.cta.href}
            {...(bar.cta.newTab ? { rel: "noopener noreferrer", target: "_blank" } : {})}
          >
            {bar.cta.label}
          </a>
        ) : null}

        {bar.dismissible && !preview ? (
          <button
            aria-label="Close announcement"
            className="nb-close"
            onClick={dismiss}
            type="button"
          >
            <X aria-hidden="true" />
          </button>
        ) : null}
      </section>
    </div>
  );
}

/**
 * The seller's colours, as inline custom properties.
 *
 * Inline rather than classes because they are the merchant's own values, and
 * inline is also what keeps them out of dark mode's reach — the generated
 * stylesheet cannot re-declare a property set on the element, which is the rule
 * CLAUDE.md states for `--store-primary` and `--sf-header-bg`. An empty setting
 * declares nothing at all, so the CSS falls through to the shop's `--sf-primary`
 * rather than to a blue that belongs to no storefront.
 */
function barColors(bar: NotificationBarView) {
  return {
    ...(bar.backgroundColor ? { "--nb-bg": bar.backgroundColor } : {}),
    ...(bar.textColor ? { "--nb-fg": bar.textColor } : {}),
    ...(bar.buttonColor ? { "--nb-button-bg": bar.buttonColor } : {}),
    ...(bar.buttonTextColor ? { "--nb-button-fg": bar.buttonTextColor } : {})
  } as CSSProperties;
}

function dismissKey(storeSlug: string, revision: string) {
  return `storeim.notification-bar.${storeSlug}.${revision}`;
}

/**
 * Whether this shopper closed *this* announcement, and whether that is still
 * current.
 *
 * The expiry is stored with the flag rather than trusted from today's setting:
 * a seller who shortens "remember for 30 days" to one day should not have to
 * wait a month for the change to reach the people who already closed the bar.
 * Both stores are read, because a bar saved for the visit only lives in one and
 * a bar saved for a week lives in the other, and a seller may have changed which.
 */
function isDismissed(storeSlug: string, revision: string) {
  const key = dismissKey(storeSlug, revision);

  try {
    if (window.sessionStorage.getItem(key) === "1") {
      return true;
    }

    const until = Number(window.localStorage.getItem(key));

    if (Number.isFinite(until) && until > Date.now()) {
      return true;
    }

    if (until) {
      // Expired, so it is litter. Cleared here rather than left to accumulate a
      // key per campaign in every shopper's browser.
      window.localStorage.removeItem(key);
    }
  } catch {
    // Private mode, or storage switched off. Nothing to remember; show the bar.
  }

  return false;
}

function rememberDismissal(storeSlug: string, revision: string, dismissDays: number) {
  const key = dismissKey(storeSlug, revision);

  try {
    if (dismissDays <= 0) {
      window.sessionStorage.setItem(key, "1");

      return;
    }

    window.localStorage.setItem(key, String(Date.now() + dismissDays * 24 * 60 * 60 * 1000));
  } catch {
    // Nothing to remember it with. The bar still goes for this page.
  }
}
