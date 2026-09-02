"use client";

import { useEffect, useRef, useState } from "react";
import { SalesNotificationCard } from "./sales-notification-card";
import type {
  SalesNotificationEvent,
  SalesNotificationPosition
} from "../sales-notifications.schema";

/**
 * The queue behind the cards.
 *
 * A social-proof widget is judged almost entirely on when it shuts up, so the
 * timing rules are the feature and are worth stating:
 *
 * - **Hovering pauses it.** A shopper reading the card, or reaching for the
 *   product it names, is the one moment it must not disappear. The progress bar
 *   pauses with it, so the pause is visible rather than a guess.
 * - **A hidden tab pauses it.** Otherwise a shop left open in a background tab
 *   burns the whole session's cards on nobody, and the shopper who comes back
 *   sees none.
 * - **Closing it ends the session, not the card.** A shopper who presses X is
 *   telling the shop they do not want these, and answering that by showing the
 *   next one twenty seconds later is how widgets like this earn their
 *   reputation. The choice is remembered in `sessionStorage`, so it lasts the
 *   visit and is forgotten afterwards — it is a preference about a browsing
 *   session, not something to follow anyone around with.
 * - **It stops on its own.** `maxPerSession` is a hard ceiling; when the queue
 *   runs out and looping is off, it stops for good.
 *
 * Nothing renders until the first delay has elapsed, so the server and the first
 * client render agree on empty and there is no hydration mismatch to guard.
 */

/** Matches the exit animation in globals.css. */
const EXIT_MS = 320;

const MOBILE_QUERY = "(max-width: 640px)";

type Phase =
  | { delayMs: number; index: number; kind: "waiting"; shown: number }
  | { index: number; kind: "showing"; shown: number }
  | { index: number; kind: "leaving"; shown: number }
  | { kind: "done" };

export type SalesNotificationFeedProps = {
  displaySeconds: number;
  events: SalesNotificationEvent[];
  gapSeconds: number;
  initialDelaySeconds: number;
  loopFeed: boolean;
  maxPerSession: number;
  position: SalesNotificationPosition;
  showOnMobile: boolean;
  showTimeAgo: boolean;
  /** Scopes the "not interested" flag, so one shop's X is not another's. */
  storeSlug: string;
};

export function SalesNotificationFeed({
  displaySeconds,
  events,
  gapSeconds,
  initialDelaySeconds,
  loopFeed,
  maxPerSession,
  position,
  showOnMobile,
  showTimeAgo,
  storeSlug
}: SalesNotificationFeedProps) {
  const [phase, setPhase] = useState<Phase>(() => ({
    delayMs: Math.max(0, initialDelaySeconds) * 1000,
    index: 0,
    kind: "waiting",
    shown: 0
  }));
  const [hovered, setHovered] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const [suppressed, setSuppressed] = useState(false);
  const remainingRef = useRef(Math.max(0, initialDelaySeconds) * 1000);

  const paused = hovered || tabHidden;

  // A shopper who closed one of these does not get the rest of them this visit.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(dismissKey(storeSlug)) === "1") {
        setSuppressed(true);
      }
    } catch {
      // Private mode, or storage switched off. Nothing to remember; show them.
    }
  }, [storeSlug]);

  // The seller's "not on phones" switch, honoured live rather than at first
  // paint, so a rotated tablet does not keep a card that should have gone.
  useEffect(() => {
    if (showOnMobile) {
      return;
    }

    const query = window.matchMedia(MOBILE_QUERY);
    const sync = () => setSuppressed((current) => current || query.matches);

    sync();
    query.addEventListener("change", sync);

    return () => query.removeEventListener("change", sync);
  }, [showOnMobile]);

  useEffect(() => {
    const sync = () => setTabHidden(document.visibilityState === "hidden");

    sync();
    document.addEventListener("visibilitychange", sync);

    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  // Runs before the timer effect below on every phase change, so the timer
  // always starts from the new phase's full duration. The timer's own cleanup
  // subtracts the elapsed time, which is what makes a pause resume where it
  // stopped instead of restarting.
  useEffect(() => {
    remainingRef.current = phaseDuration(phase, displaySeconds);
  }, [displaySeconds, phase]);

  useEffect(() => {
    if (phase.kind === "done" || paused || suppressed || events.length === 0) {
      return;
    }

    const startedAt = Date.now();
    const timer = window.setTimeout(() => {
      setPhase((current) =>
        nextPhase(current, {
          eventCount: events.length,
          gapSeconds,
          loopFeed,
          maxPerSession
        })
      );
    }, remainingRef.current);

    return () => {
      window.clearTimeout(timer);
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAt));
    };
  }, [events.length, gapSeconds, loopFeed, maxPerSession, paused, phase, suppressed]);

  if (suppressed || (phase.kind !== "showing" && phase.kind !== "leaving")) {
    return null;
  }

  const event = events[phase.index];

  if (!event) {
    return null;
  }

  return (
    // No `aria-live`: this is unsolicited marketing that reappears every few
    // seconds, and announcing it would talk over whatever a screen-reader user
    // is actually doing. The card stays in the DOM, reachable and readable, with
    // a properly labelled close button — it just does not interrupt.
    <div
      className="sn-dock"
      data-position={position}
      onBlurCapture={() => setHovered(false)}
      onFocusCapture={() => setHovered(true)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <SalesNotificationCard
        event={event}
        onDismiss={() => {
          setSuppressed(true);

          try {
            window.sessionStorage.setItem(dismissKey(storeSlug), "1");
          } catch {
            // Nothing to remember it with. The card still goes for this page.
          }
        }}
        paused={paused}
        progressSeconds={displaySeconds}
        showTimeAgo={showTimeAgo}
        state={phase.kind === "leaving" ? "leaving" : "entering"}
      />
    </div>
  );
}

function dismissKey(storeSlug: string) {
  return `storeim.sales-notifications.dismissed.${storeSlug}`;
}

function phaseDuration(phase: Phase, displaySeconds: number) {
  switch (phase.kind) {
    case "waiting":
      return phase.delayMs;
    case "showing":
      return Math.max(1, displaySeconds) * 1000;
    case "leaving":
      return EXIT_MS;
    default:
      return 0;
  }
}

/**
 * The state machine, as a pure function of the current phase.
 *
 * Pure on purpose: the counters live in the phase rather than in refs, so React
 * calling the updater twice — which it does in development — cannot skip a card
 * or end the session early.
 */
function nextPhase(
  phase: Phase,
  options: { eventCount: number; gapSeconds: number; loopFeed: boolean; maxPerSession: number }
): Phase {
  if (phase.kind === "waiting") {
    return { index: phase.index, kind: "showing", shown: phase.shown };
  }

  if (phase.kind === "showing") {
    return { index: phase.index, kind: "leaving", shown: phase.shown };
  }

  if (phase.kind === "leaving") {
    const shown = phase.shown + 1;

    if (shown >= options.maxPerSession) {
      return { kind: "done" };
    }

    const nextIndex = phase.index + 1;

    if (nextIndex >= options.eventCount) {
      // Out of orders. Looping starts the queue again — the same handful of real
      // purchases, not new ones — and a seller who would rather it stopped than
      // repeat itself switches looping off.
      if (!options.loopFeed || options.eventCount === 0) {
        return { kind: "done" };
      }

      return { delayMs: options.gapSeconds * 1000, index: 0, kind: "waiting", shown };
    }

    return { delayMs: options.gapSeconds * 1000, index: nextIndex, kind: "waiting", shown };
  }

  return { kind: "done" };
}
