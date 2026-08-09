"use client";

import { useEffect, useState } from "react";

// How far down the page has to be scrolled before the button fades in.
const REVEAL_OFFSET_PX = 300;

// One floating button shared by every storefront template. It is mounted once per
// surface (the `[slug]` layout, inside the theme scope) rather than per footer, so
// it stays pinned to the viewport instead of scrolling away with the page. The look
// is driven entirely by CSS (`.sf-scroll-top` in globals.css), which reads the
// storefront primary token, so each template gets its own palette without a prop.
export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;

    const sync = () => {
      frame = 0;
      setVisible(window.scrollY > REVEAL_OFFSET_PX);
    };

    const handleScroll = () => {
      // Coalesce a burst of scroll events into a single state update per frame.
      if (frame !== 0) {
        return;
      }

      frame = window.requestAnimationFrame(sync);
    };

    // Covers restored scroll positions and in-page anchors on first paint.
    sync();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);

      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  return (
    <button
      aria-label="Scroll to top"
      className="sf-scroll-top"
      data-visible={visible ? "true" : "false"}
      onClick={() => {
        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ behavior: prefersReducedMotion ? "auto" : "smooth", left: 0, top: 0 });
      }}
      title="Scroll to top"
      type="button"
    >
      <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
        <path
          d="M12 19V6.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.1"
        />
        <path
          d="m6 12 6-6 6 6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.1"
        />
      </svg>
    </button>
  );
}
