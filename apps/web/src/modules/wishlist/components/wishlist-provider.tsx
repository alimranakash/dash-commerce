"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { EMPTY_WISHLIST_STATE, type WishlistState } from "../wishlist.types";
import { submitWishlistAction } from "./wishlist-client-actions";

/**
 * The saved-product ids, published once for the whole storefront.
 *
 * Every heart on a page needs the same one answer — is this product saved? — and
 * a grid of thirty cards asking the server thirty times would be thirty round
 * trips for one row of ids. The layout reads it once and this provider hands it
 * down, exactly as `StorefrontBasePathProvider` does with the link prefix.
 *
 * Rendering outside the provider is not an error: a card in a context that never
 * mounted one reads an empty list and its heart works as a link to the wishlist
 * page would, so no component has to know whether it is inside one.
 */
type WishlistContextValue = {
  count: number;
  error: string;
  isPending: (productId: string) => boolean;
  isSaved: (productId: string) => boolean;
  storeSlug: string;
  toggle: (productId: string, productSlug?: string) => Promise<void>;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({
  children,
  state,
  storeSlug
}: {
  children: ReactNode;
  state: WishlistState;
  storeSlug: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState<string[]>(state.productIds);
  const [pending, setPending] = useState<string[]>([]);
  const [error, setError] = useState("");
  // A joined key rather than the array: the layout builds a fresh array on every
  // render, so depending on the array itself would resync (and stamp out an
  // optimistic heart) on renders that changed nothing.
  const seedKey = state.productIds.join(",");

  useEffect(() => {
    setSaved(seedKey ? seedKey.split(",") : []);
  }, [seedKey]);

  const toggle = useCallback(
    async (productId: string, productSlug?: string) => {
      setError("");
      setPending((current) => (current.includes(productId) ? current : [...current, productId]));
      // Optimistic, because a heart that waits for a round trip reads as broken.
      // The server's answer replaces this a moment later either way.
      setSaved((current) =>
        current.includes(productId)
          ? current.filter((id) => id !== productId)
          : [productId, ...current]
      );

      const result = await submitWishlistAction({
        productId,
        ...(productSlug ? { productSlug } : {}),
        storeSlug,
        wishlistAction: "toggle"
      });

      setPending((current) => current.filter((id) => id !== productId));

      if (!result.ok) {
        setError(result.message);
      }

      setSaved(result.ok ? result.state.productIds : (current) => rollback(current, productId));

      if (result.ok) {
        // So the wishlist page and the header count behind this component agree
        // with the heart that was just pressed.
        router.refresh();
      }
    },
    [router, storeSlug]
  );

  const value = useMemo<WishlistContextValue>(
    () => ({
      count: saved.length,
      error,
      isPending: (productId: string) => pending.includes(productId),
      isSaved: (productId: string) => saved.includes(productId),
      storeSlug,
      toggle
    }),
    [error, pending, saved, storeSlug, toggle]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const context = useContext(WishlistContext);

  return (
    context ?? {
      count: EMPTY_WISHLIST_STATE.count,
      error: "",
      isPending: () => false,
      isSaved: () => false,
      storeSlug: "",
      toggle: async () => undefined
    }
  );
}

/** Undoes exactly the optimistic flip above, leaving any other change alone. */
function rollback(current: string[], productId: string) {
  return current.includes(productId)
    ? current.filter((id) => id !== productId)
    : [productId, ...current];
}
