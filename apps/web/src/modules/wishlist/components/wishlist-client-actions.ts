import { EMPTY_WISHLIST_STATE, type WishlistState } from "../wishlist.types";

export type WishlistActionResult = {
  message: string;
  ok: boolean;
  state: WishlistState;
};

/**
 * Posts to `/api/wishlist` and hands back the list the server ended up with.
 *
 * The authoritative state comes back in the response rather than being inferred
 * from what was asked for, which is what lets the provider correct an optimistic
 * heart without a page load — and what keeps two tabs from disagreeing about how
 * many products are saved.
 */
export async function submitWishlistAction(
  input: Record<string, string>
): Promise<WishlistActionResult> {
  const body = new FormData();

  for (const [key, value] of Object.entries(input)) {
    body.set(key, value);
  }

  try {
    const response = await fetch("/api/wishlist", {
      body,
      headers: {
        Accept: "application/json",
        "x-wishlist-request": "ajax"
      },
      method: "POST"
    });
    const data = (await response.json()) as Partial<WishlistActionResult>;

    return {
      message: data.message ?? "Wishlist update failed.",
      ok: Boolean(data.ok) && response.ok,
      state: data.state ?? EMPTY_WISHLIST_STATE
    };
  } catch {
    return {
      message: "Wishlist update failed. Please try again.",
      ok: false,
      state: EMPTY_WISHLIST_STATE
    };
  }
}
