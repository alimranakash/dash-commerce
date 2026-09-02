import Link from "next/link";
import type { CSSProperties } from "react";
import { ProductGrid } from "../../storefront/components/product-listing";
import type {
  StorefrontProductSectionSettings,
  StorefrontShopPageSettings
} from "../../storefront/customization";
import type { Wishlist } from "../wishlist.types";

type WishlistPageProps = {
  basePath: string;
  cardVariant?: string | undefined;
  currency: string;
  feedback: {
    cleared?: string | undefined;
    removed?: string | undefined;
    saved?: string | undefined;
    wishlistError?: string | undefined;
  };
  listingSection: StorefrontProductSectionSettings;
  shopSettings: StorefrontShopPageSettings;
  storeId: string;
  storeName: string;
  storeSlug: string;
  wishlist: Wishlist;
};

/**
 * The saved-products page.
 *
 * Deliberately the shop grid rather than a list of its own: a wishlist is a
 * shortlist of the catalogue, so it gets the store's own card, badges, hover
 * image and money formatting, and inherits the Pages -> Shop width and column
 * settings the way `/products` and `/categories` do. The heart on each card is
 * already showing "saved" here, so pressing it is the remove — there is no
 * second remove control to keep in step with it.
 */
export function WishlistPage({
  basePath,
  cardVariant,
  currency,
  feedback,
  listingSection,
  shopSettings,
  storeId,
  storeName,
  storeSlug,
  wishlist
}: WishlistPageProps) {
  const notice = wishlistNotice(feedback);

  return (
    <>
      <section className="sf-shop-page-header" aria-labelledby="wishlist-title">
        <p>Wishlist</p>
        <span>
          {wishlist.count > 0
            ? `${wishlist.count === 1 ? "1 product" : `${wishlist.count} products`} saved from ${storeName}.`
            : `Products you save at ${storeName} are kept here.`}
        </span>
      </section>
      <section
        className={`sf-shop-page sf-shop-page-${shopSettings.widthMode}`}
        style={
          {
            "--shop-grid-gap": `${shopSettings.gridSpacing}px`,
            "--shop-section-spacing": `${shopSettings.sectionSpacing}px`
          } as CSSProperties
        }
        aria-labelledby="wishlist-title"
      >
        <h1 className="sr-only" id="wishlist-title">
          Wishlist
        </h1>
        {notice ? (
          <p className={feedback.wishlistError ? "sf-alert" : "sf-wishlist-notice"}>{notice}</p>
        ) : null}
        {wishlist.count === 0 ? (
          <EmptyWishlist basePath={basePath} />
        ) : (
          <>
            <ProductGrid
              cardVariant={cardVariant}
              currency={currency}
              products={wishlist.items}
              section={listingSection}
              storeId={storeId}
              storeSlug={storeSlug}
            />
            <form action="/api/wishlist" className="sf-wishlist-clear" method="post">
              <input name="wishlistAction" type="hidden" value="clear" />
              <input name="storeSlug" type="hidden" value={storeSlug} />
              <button type="submit">Clear wishlist</button>
            </form>
          </>
        )}
      </section>
    </>
  );
}

function EmptyWishlist({ basePath }: { basePath: string }) {
  return (
    <div className="general-cart-empty">
      <div className="general-cart-empty-icon" aria-hidden="true">
        <span />
      </div>
      <h2>Your wishlist is empty</h2>
      <p>Tap the heart on any product and it will be waiting for you here.</p>
      <Link className="general-cart-continue" href={`${basePath}/products`}>
        Browse Products
      </Link>
    </div>
  );
}

function wishlistNotice(feedback: WishlistPageProps["feedback"]) {
  if (feedback.wishlistError) {
    return feedback.wishlistError;
  }

  if (feedback.cleared) {
    return "Wishlist cleared.";
  }

  if (feedback.removed) {
    return "Removed from your wishlist.";
  }

  if (feedback.saved) {
    return "Saved to your wishlist.";
  }

  return "";
}
