"use client";

import { BadgeCheck, MapPin, ShoppingBag, X } from "lucide-react";
import { StorefrontImage } from "../../storefront/components/storefront-image";
import type { SalesNotificationEvent } from "../sales-notifications.schema";

/**
 * One sales-notification card.
 *
 * Presentational and shared: the storefront feed renders it for real, and the
 * dashboard renders the same component as its live preview. That is the point —
 * a preview drawn by a second, simpler component is a preview that is allowed to
 * be wrong, and this is a widget a seller is deciding whether to put in front of
 * every customer they have.
 *
 * Four things it does that the reference design does not:
 *
 * - **Says where the sentence came from.** The "Verified order" chip is not
 *   decoration; this widget only ever renders real orders, and that is the whole
 *   reason a shopper should believe it. A card that could have been typed into a
 *   settings box does not deserve the chip, and this codebase has nowhere to
 *   type one.
 * - **A progress bar rather than a card that vanishes.** The shopper can see how
 *   long they have to read it, and hovering pauses it — the feed owns that
 *   timer, so the bar is told to pause with the same flag.
 * - **The whole card is the link.** Social proof that cannot be acted on is an
 *   advert; this one goes to the product, and the close button sits above it as
 *   a real button rather than a link inside a link.
 * - **The product image carries a fallback.** A deleted upload leaves a labelled
 *   tile, not a broken-image icon in the corner of the shop.
 */
export function SalesNotificationCard({
  event,
  onDismiss,
  paused = false,
  progressSeconds = null,
  showTimeAgo = true,
  state = "entering"
}: {
  event: SalesNotificationEvent;
  /** Omitted in the dashboard preview, where there is nothing to dismiss. */
  onDismiss?: (() => void) | undefined;
  paused?: boolean | undefined;
  /** How long the card is on screen, for the bar. Null hides it. */
  progressSeconds?: number | null | undefined;
  showTimeAgo?: boolean | undefined;
  state?: "entering" | "leaving" | undefined;
}) {
  const meta = [
    event.location ? `from ${event.location}` : null,
    showTimeAgo ? formatTimeAgo(event.purchasedAt) : null
  ].filter((part): part is string => Boolean(part));

  const body = (
    <>
      {/* No tile at all when there is no image, rather than a tile with a
          placeholder in it. The seller who switched the photo off asked for the
          card without one, and a product whose upload has gone reads better
          without an empty square than with one. The fallback below is for the
          third case: an image that exists and fails to load. */}
      {event.imageUrl ? (
        <span className="sn-media">
          <StorefrontImage
            alt=""
            fallback={
              <span className="sn-media-fallback">
                <ShoppingBag aria-hidden="true" />
              </span>
            }
            src={event.imageUrl}
          />
        </span>
      ) : null}

      <span className="sn-body">
        <span className="sn-lede">
          <strong>{event.buyer}</strong> just purchased
        </span>
        <span className="sn-title">{event.productTitle}</span>
        {meta.length > 0 ? (
          // The relative time is computed from the clock at render, so a card
          // rendered on the server and hydrated a second later can straddle a
          // minute boundary. That is the case this attribute exists for — the
          // storefront card never server-renders, but the dashboard preview
          // does.
          <span className="sn-meta" suppressHydrationWarning>
            {event.location ? <MapPin aria-hidden="true" className="sn-meta-icon" /> : null}
            {meta.join(" · ")}
          </span>
        ) : null}
      </span>
    </>
  );

  return (
    <article className="sn-card" data-media={event.imageUrl ? "true" : "false"} data-state={state}>
      {event.href ? (
        <a className="sn-card-link" href={event.href}>
          {body}
        </a>
      ) : (
        <span className="sn-card-link">{body}</span>
      )}

      <span className="sn-verified" title="Drawn from a real order in this shop">
        <BadgeCheck aria-hidden="true" />
        Verified order
      </span>

      {onDismiss ? (
        <button
          aria-label="Hide purchase notifications"
          className="sn-close"
          onClick={onDismiss}
          type="button"
        >
          <X aria-hidden="true" />
        </button>
      ) : null}

      {progressSeconds ? (
        <span aria-hidden="true" className="sn-progress">
          <span
            className="sn-progress-fill"
            style={{
              animationDuration: `${progressSeconds}s`,
              animationPlayState: paused ? "paused" : "running"
            }}
          />
        </span>
      ) : null}
    </article>
  );
}

/**
 * "20 mins ago", from an ISO timestamp.
 *
 * Formatted here, on each render, rather than on the server: a storefront page
 * can sit open for an hour, and a card that was rendered with the page would go
 * on saying "2 mins ago" for as long as the tab is open. Anything under a minute
 * is "just now" — "0 mins ago" is not a thing people say.
 */
export function formatTimeAgo(iso: string) {
  const then = new Date(iso).getTime();

  if (!Number.isFinite(then)) {
    return "recently";
  }

  const minutes = Math.floor((Date.now() - then) / 60000);

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? "min" : "mins"} ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }

  const days = Math.floor(hours / 24);

  return days === 1 ? "yesterday" : `${days} days ago`;
}
