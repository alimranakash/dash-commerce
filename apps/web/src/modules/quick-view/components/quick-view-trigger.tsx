"use client";

import { Eye } from "lucide-react";
import type { MouseEvent } from "react";
import { useQuickView } from "./quick-view-provider";

type QuickViewTriggerProps = {
  className?: string | undefined;
  productSlug: string;
  productTitle: string;
};

/**
 * The button on a product card that opens Quick View.
 *
 * When the seller has the feature off this returns **null** — no markup, not a
 * button hidden in CSS. A hidden button is still in the tab order, still in the
 * page source and still read aloud, and "off" has to mean off. The same call the
 * notification bar makes outside its schedule.
 *
 * It must not be rendered inside an anchor. The storefront's cards are one large
 * link laid behind the card rather than wrapped around it — precisely so a
 * button can sit on top — and this stops the click from also opening the product
 * page the trigger is meant to defer.
 *
 * The label is the seller's word, and it is a real word rather than only an
 * icon: an eye glyph on its own is a guess for anyone who has not seen the
 * pattern before, and the shop's shoppers may not have.
 */
export function QuickViewTrigger({ className, productSlug, productTitle }: QuickViewTriggerProps) {
  const { activeSlug, open, view } = useQuickView();

  if (!view) {
    return null;
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    // The card behind is a link; without this the trigger both opens the modal
    // and navigates out from under it.
    event.preventDefault();
    event.stopPropagation();
    open(productSlug);
  }

  return (
    <button
      // `hover` is a desktop refinement. The stylesheet reveals the button
      // unconditionally on a coarse pointer, because a touch device cannot
      // hover and would otherwise never see it.
      className={`sf-quick-view-trigger sf-quick-view-trigger-${view.triggerStyle}${className ? ` ${className}` : ""}`}
      data-active={activeSlug === productSlug ? "true" : undefined}
      onClick={handleClick}
      type="button"
    >
      <Eye aria-hidden="true" />
      <span>{view.buttonLabel}</span>
      {/* The visible label says "Quick View"; a screen reader needs to know
        which of the forty-eight products on this page it belongs to. */}
      <span className="sr-only">: {productTitle}</span>
    </button>
  );
}
