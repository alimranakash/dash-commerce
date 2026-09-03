"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import type { QuickViewProduct, QuickViewView } from "../quick-view.types";
import { QuickViewModal } from "./quick-view-modal";

/**
 * Quick View, published once for the whole storefront.
 *
 * One provider rather than a modal per card. A shop listing forty-eight products
 * would otherwise mount forty-eight dialogs, forty-eight scroll locks and
 * forty-eight escape handlers to show one of them; here the cards own nothing
 * but a button, and the single modal below moves between them.
 *
 * It also survives navigation, being mounted from the storefront layout: a
 * shopper who opens a card, closes it and walks to the next page does not
 * re-download anything they have already looked at.
 *
 * Rendering outside the provider is not an error — `useQuickView` answers with a
 * null view, and `QuickViewTrigger` renders nothing for that — so a card can be
 * dropped into a context that never mounted one without knowing.
 */
type QuickViewContextValue = {
  /** The slug currently open, so a card can mark its own trigger active. */
  activeSlug: string | null;
  close: () => void;
  open: (productSlug: string) => void;
  /** Null when the seller has Quick View switched off. */
  view: QuickViewView | null;
};

const QuickViewContext = createContext<QuickViewContextValue | null>(null);

type QuickViewStatus = "idle" | "loading" | "ready" | "error";

export function QuickViewProvider({
  children,
  storeSlug,
  view
}: {
  children: ReactNode;
  storeSlug: string;
  view: QuickViewView | null;
}) {
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [product, setProduct] = useState<QuickViewProduct | null>(null);
  const [status, setStatus] = useState<QuickViewStatus>("idle");
  // Products already fetched this session. A shopper comparing two things taps
  // between them repeatedly, and the second look should be instant. It is a ref
  // rather than state because filling it must not re-render the grid.
  const cache = useRef(new Map<string, QuickViewProduct>());
  // The element that opened the dialog, so focus goes back where it came from
  // rather than to the top of the document.
  const opener = useRef<HTMLElement | null>(null);
  // Which request is current. A shopper who opens one card and immediately opens
  // another must not have the first response land in the second modal.
  const request = useRef(0);

  const close = useCallback(() => {
    request.current += 1;
    setActiveSlug(null);
    setProduct(null);
    setStatus("idle");

    const previous = opener.current;
    opener.current = null;

    if (previous?.isConnected) {
      previous.focus();
    }
  }, []);

  const open = useCallback(
    (productSlug: string) => {
      if (!view || !productSlug) {
        return;
      }

      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setActiveSlug(productSlug);

      const cached = cache.current.get(productSlug);

      if (cached) {
        setProduct(cached);
        setStatus("ready");
        return;
      }

      setProduct(null);
      setStatus("loading");

      const ticket = (request.current += 1);

      void (async () => {
        const loaded = await fetchQuickViewProduct(storeSlug, productSlug);

        if (ticket !== request.current) {
          return;
        }

        if (!loaded) {
          setStatus("error");
          return;
        }

        cache.current.set(productSlug, loaded);
        setProduct(loaded);
        setStatus("ready");
      })();
    },
    [storeSlug, view]
  );

  useEffect(() => {
    if (!activeSlug) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    // The page behind a dialog must not scroll under it; restored on close so a
    // shopper lands back exactly where they were reading.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [activeSlug, close]);

  useEffect(() => {
    // A basket that changed is stock that changed. The cache exists so a
    // shopper comparing two products gets the second look instantly, but
    // holding a count from before they took three of the last three would have
    // the dialog quoting a number the checkout is about to disagree with.
    function handleCartUpdated() {
      cache.current.clear();
    }

    window.addEventListener("dash-cart-updated", handleCartUpdated);

    return () => window.removeEventListener("dash-cart-updated", handleCartUpdated);
  }, []);

  const value = useMemo<QuickViewContextValue>(
    () => ({ activeSlug, close, open, view }),
    [activeSlug, close, open, view]
  );

  return (
    <QuickViewContext.Provider value={value}>
      {children}
      {/* Nothing at all when the seller has it off, and nothing until the first
        card is tapped: the dialog's markup never reaches a page nobody opened
        it on. */}
      {view && activeSlug ? (
        <QuickViewModal
          // Keyed to the product, so opening a second one starts clean. The
          // dialog holds the picked option and the shown photograph in state,
          // and without this a shopper who moved from one product to another
          // would carry the first one's selection into the second.
          key={activeSlug}
          onClose={close}
          productSlug={activeSlug}
          product={product}
          status={status}
          storeSlug={storeSlug}
          view={view}
        />
      ) : null}
    </QuickViewContext.Provider>
  );
}

export function useQuickView(): QuickViewContextValue {
  const context = useContext(QuickViewContext);

  return (
    context ?? {
      activeSlug: null,
      close: () => undefined,
      open: () => undefined,
      view: null
    }
  );
}

/**
 * The product, re-read from the catalogue.
 *
 * Both parameters are slugs and the store is the one the shopper is already on,
 * so this asks the server for exactly what `/products/<slug>` would have shown
 * them. Any failure — offline, a 404 for a product the seller unpublished while
 * the grid sat open, a body that is not what we expect — comes back as null and
 * the modal says so, rather than rendering a buy box over stale numbers.
 */
async function fetchQuickViewProduct(storeSlug: string, productSlug: string) {
  try {
    const response = await fetch(
      `/api/storefront/quick-view?store=${encodeURIComponent(storeSlug)}&product=${encodeURIComponent(productSlug)}`,
      { headers: { Accept: "application/json" } }
    );

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { product?: QuickViewProduct };

    return data.product ?? null;
  } catch {
    return null;
  }
}
