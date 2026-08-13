import Script from "next/script";

/**
 * The browser half of the Purchase event.
 *
 * `eventID` here must equal the `event_id` the Conversions API sender used, so
 * Meta collapses the pair into one conversion instead of counting two. Both come
 * from `metaEventIdForOrder`, which is derived from the order id — so a customer
 * refreshing the thank-you page also dedupes against the same event rather than
 * inflating the seller's numbers.
 *
 * Renders nothing unless a pixel is configured; `fbq` is initialised by the
 * storefront layout, which runs earlier in the tree.
 */
export function MetaPurchaseEvent({
  currency,
  eventId,
  pixelId,
  value
}: {
  currency: string;
  eventId: string;
  pixelId: string | null;
  value: number;
}) {
  if (!pixelId) {
    return null;
  }

  return (
    <Script id={`meta-purchase-${eventId}`} strategy="afterInteractive">
      {`if (typeof fbq === 'function') { fbq('track', 'Purchase', ${JSON.stringify({
        currency,
        value
      })}, ${JSON.stringify({ eventID: eventId })}); }`}
    </Script>
  );
}
