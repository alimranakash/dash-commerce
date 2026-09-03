"use client";

import { ArrowRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useStorefrontBasePath } from "../../storefront/base-path-provider";
import { ProductPurchasePanel } from "../../storefront/components/product-purchase-panel";
import { StorefrontImage } from "../../storefront/components/storefront-image";
import { formatStorefrontMoney, preorderLabel } from "../../storefront/format";
import { quickViewMaxQuantity, quickViewSavings } from "../quick-view.render";
import type { QuickViewProduct, QuickViewVariant, QuickViewView } from "../quick-view.types";

type QuickViewModalProps = {
  onClose: () => void;
  product: QuickViewProduct | null;
  productSlug: string;
  status: "idle" | "loading" | "ready" | "error";
  storeSlug: string;
  view: QuickViewView;
};

/**
 * The Quick View dialog.
 *
 * Two rules shape everything below.
 *
 * The first is that it is a **glance, not a second product page**. It carries
 * what a shopper needs to decide — the pictures, the price, what it costs
 * against, whether it is in stock, which option, and the button — and stops.
 * Reviews, tabs, shipping tables and related products stay where they are, and
 * "View full details" is the honest exit rather than a footnote.
 *
 * The second is that everything it can do, something else already does. The
 * buy box is the product page's own `ProductPurchasePanel`, so a Quick View add
 * is the same add: the same validation, the same stock check, the same cart
 * event the header counts. This component owns the *presentation* and the
 * option a shopper picked, and nothing about selling.
 *
 * A portal because the trigger sits inside a product card that is itself inside
 * a grid with `overflow` and a stacking context; rendering in place would put
 * the dialog underneath the page it is meant to cover.
 */
export function QuickViewModal({
  onClose,
  product,
  productSlug,
  status,
  storeSlug,
  view
}: QuickViewModalProps) {
  const basePath = useStorefrontBasePath();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const dialog = useRef<HTMLDivElement | null>(null);
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const productHref = `${basePath}/products/${productSlug}`;

  useEffect(() => {
    // Portalled into the storefront's own theme scope rather than into
    // `document.body`. The shop's colours are inline custom properties on that
    // element — `--store-primary`, `--store-bg`, `--store-text` — so a dialog
    // parented to the body would silently fall back to the platform defaults
    // and paint every customised shop's Quick View in somebody else's teal. It
    // carries the template and theme data attributes too, which the templates'
    // own rules key off. The body is the fallback for a context that has no
    // scope, where the defaults are the right answer anyway.
    setHost(document.querySelector<HTMLElement>(".sf-theme-scope") ?? document.body);
  }, []);

  useEffect(() => {
    // Focus lands on the dialog's own close button rather than staying on the
    // card behind it, so the first Tab is inside the dialog and Escape is
    // obviously available. Focus goes back to the trigger on close, which the
    // provider handles because it is the thing that knows what opened.
    closeButton.current?.focus();
    // Keyed to `host` rather than to mount: the dialog renders nothing until the
    // portal target is resolved, so on the first pass there is no button to
    // focus yet.
  }, [host]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab" || !dialog.current) {
        return;
      }

      // A dialog a keyboard can tab out of is a dialog that traps a screen
      // reader in the page behind it — the shopper hears the grid they cannot
      // see and has no way to know they have left.
      const focusable = [
        ...dialog.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ].filter((element) => element.offsetParent !== null || element === document.activeElement);

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) {
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!host) {
    return null;
  }

  return createPortal(
    <div className="sf-quick-view-shell">
      {/* A button rather than a div: closing by clicking away has to be
        reachable without a mouse, and a labelled button is what a screen
        reader can announce. */}
      <button
        aria-label="Close quick view"
        className="sf-quick-view-overlay"
        onClick={onClose}
        type="button"
      />
      <div
        aria-labelledby={product ? titleId : undefined}
        aria-label={product ? undefined : "Quick view"}
        aria-modal="true"
        className="sf-quick-view-dialog"
        ref={dialog}
        role="dialog"
      >
        <button
          aria-label="Close quick view"
          className="sf-quick-view-close"
          onClick={onClose}
          ref={closeButton}
          type="button"
        >
          <X aria-hidden="true" />
        </button>

        {status === "error" ? (
          <QuickViewUnavailable href={productHref} onClose={onClose} />
        ) : status === "ready" && product ? (
          <QuickViewBody
            onClose={onClose}
            product={product}
            productHref={productHref}
            storeSlug={storeSlug}
            titleId={titleId}
            view={view}
          />
        ) : (
          <QuickViewSkeleton />
        )}
      </div>
    </div>,
    host
  );
}

function QuickViewBody({
  onClose,
  product,
  productHref,
  storeSlug,
  titleId,
  view
}: {
  onClose: () => void;
  product: QuickViewProduct;
  productHref: string;
  storeSlug: string;
  titleId: string;
  view: QuickViewView;
}) {
  const [signature, setSignature] = useState(product.variants[0]?.optionSignature ?? "");
  const selected = useMemo(
    () => product.variants.find((variant) => variant.optionSignature === signature) ?? null,
    [product.variants, signature]
  );
  const [activeImage, setActiveImage] = useState(0);

  const price = selected?.price ?? product.price;
  const compareAtPrice = selected?.compareAtPrice ?? product.compareAtPrice;
  const sku = selected?.sku ?? product.sku;
  const stockQuantity = selected?.stockQuantity ?? product.stockQuantity;
  const maxQuantity = quickViewMaxQuantity({
    allowPreorder: product.allowPreorder,
    stockQuantity: product.stockQuantity,
    variant: selected
  });
  /**
   * The gallery, built once and never reordered.
   *
   * Deliberately *not* derived from the selected option. A list that grew a
   * variant's own picture at the front when that option was picked would
   * renumber every thumbnail underneath it, so the index held in state would
   * point at a different photograph than the one it pointed at a moment ago —
   * the shopper taps Blue and the picture jumps to something else entirely.
   * Every variant picture is folded in up front instead, so an index means the
   * same thing for the life of the dialog and picking an option is a lookup.
   */
  const images = useMemo(() => {
    const gallery = product.images.filter((image) => image.url);
    const seen = new Set(gallery.map((image) => image.url));

    for (const variant of product.variants) {
      if (variant.imageUrl && !seen.has(variant.imageUrl)) {
        seen.add(variant.imageUrl);
        gallery.push({ alt: variant.title, url: variant.imageUrl });
      }
    }

    return gallery;
  }, [product.images, product.variants]);
  const activeIndex = Math.min(activeImage, Math.max(images.length - 1, 0));
  const hero = images[activeIndex];
  // Recomputed rather than read off the payload: picking an option changes
  // both numbers, and the server only knew the base product's pair. One rule
  // for it, shared with the server through `quick-view.render.ts`.
  const savings = quickViewSavings(price, compareAtPrice);
  const buttonStyle = {
    "--product-add-button-bg": view.addToCartButtonColor,
    "--product-add-button-radius": `${view.addToCartButtonRadius}px`
  } as CSSProperties;

  function selectVariant(next: QuickViewVariant) {
    setSignature(next.optionSignature);

    if (!next.imageUrl) {
      // An option with no picture of its own leaves the shopper looking at what
      // they were already looking at, rather than snapping back to the first
      // image on every tap.
      return;
    }

    const index = images.findIndex((image) => image.url === next.imageUrl);

    if (index >= 0) {
      setActiveImage(index);
    }
  }

  return (
    <div className="sf-quick-view-body" style={buttonStyle}>
      <div className="sf-quick-view-media">
        <div className="sf-quick-view-hero">
          <StorefrontImage
            alt={hero?.alt ?? product.title}
            fallback="No image"
            src={hero?.url}
          />
          {savings !== null ? (
            <span className="sf-quick-view-savings">{savings}% off</span>
          ) : null}
        </div>
        {view.galleryEnabled && images.length > 1 ? (
          <div className="sf-quick-view-thumbs" role="group" aria-label="Product images">
            {images.slice(0, 6).map((image, index) => (
              <button
                aria-label={`Show image ${index + 1}`}
                aria-pressed={index === activeIndex}
                className="sf-quick-view-thumb"
                key={`${image.url}-${index}`}
                onClick={() => setActiveImage(index)}
                type="button"
              >
                <StorefrontImage alt={image.alt ?? product.title} fallback="" src={image.url} />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="sf-quick-view-details">
        {product.categoryName ? (
          <p className="sf-quick-view-eyebrow">{product.categoryName}</p>
        ) : null}
        <h2 className="sf-quick-view-title" id={titleId}>
          {product.title}
        </h2>

        <div className="sf-quick-view-price">
          <strong>{formatStorefrontMoney(price, product.currency)}</strong>
          {compareAtPrice && Number(compareAtPrice) > Number(price) ? (
            <s>{formatStorefrontMoney(compareAtPrice, product.currency)}</s>
          ) : null}
        </div>

        <QuickViewAvailability
          allowPreorder={product.allowPreorder}
          continueSelling={selected?.continueSelling ?? false}
          preorderReleaseAt={product.preorderReleaseAt}
          stockQuantity={stockQuantity}
        />

        {sku ? <p className="sf-quick-view-sku">SKU: {sku}</p> : null}

        {view.descriptionEnabled && product.description ? (
          <p className="sf-quick-view-description">{product.description}</p>
        ) : null}

        {view.variantEnabled && product.variants.length > 0 ? (
          <div className="sf-quick-view-variants">
            <span className="sf-quick-view-variants-label">Options</span>
            {view.variantStyle === "dropdown" ? (
              <select
                aria-label="Product options"
                className="sf-quick-view-variant-select"
                onChange={(event) => {
                  const next = product.variants.find(
                    (variant) => variant.optionSignature === event.target.value
                  );

                  if (next) {
                    selectVariant(next);
                  }
                }}
                value={signature}
              >
                {product.variants.map((variant) => (
                  <option key={variant.optionSignature} value={variant.optionSignature}>
                    {variant.title}
                  </option>
                ))}
              </select>
            ) : (
              <div className="sf-quick-view-variant-buttons">
                {product.variants.map((variant) => (
                  <button
                    aria-pressed={variant.optionSignature === signature}
                    className="sf-quick-view-variant"
                    key={variant.optionSignature}
                    onClick={() => selectVariant(variant)}
                    type="button"
                  >
                    {variant.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* The product page's own buy box, not a copy of it. A Quick View add
          is the same add — same validation, same stock check, same cart event
          the header counts — and the dialog closes on success so the mini cart
          that opens next is not behind it. */}
        <ProductPurchasePanel
          addToCartButtonColor={view.addToCartButtonColor}
          addToCartButtonRadius={view.addToCartButtonRadius}
          addToCartText={view.addToCartText}
          className="sf-quick-view-purchase"
          directCheckoutEnabled={view.directCheckoutEnabled}
          directCheckoutText={view.directCheckoutText}
          // Remounted per option, so the stepper cannot keep a count the newly
          // picked variant does not have the stock for.
          key={signature || product.id}
          maxQuantity={maxQuantity}
          onCompleted={onClose}
          productId={product.id}
          productSlug={product.slug}
          quantityEnabled={view.quantityEnabled}
          secondaryActionsEnabled={false}
          storeId={product.storeId}
          storeSlug={storeSlug}
          variantId={selected?.id ?? null}
          wishlistEnabled={view.wishlistEnabled}
        />

        <Link className="sf-quick-view-full-link" href={productHref} onClick={onClose}>
          {view.fullDetailsText}
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

/**
 * What a shopper is told while the product is being read.
 *
 * A skeleton in the shape of the answer rather than a spinner: the dialog opens
 * at its final size, so the content does not shove the buttons around under a
 * finger that is already moving towards them.
 */
function QuickViewSkeleton() {
  return (
    <div aria-busy="true" className="sf-quick-view-body sf-quick-view-skeleton">
      <div className="sf-quick-view-media">
        <div className="sf-quick-view-hero sf-quick-view-shimmer" />
        <div className="sf-quick-view-thumbs">
          <span className="sf-quick-view-shimmer" />
          <span className="sf-quick-view-shimmer" />
          <span className="sf-quick-view-shimmer" />
        </div>
      </div>
      <div className="sf-quick-view-details">
        <span className="sf-quick-view-shimmer sf-quick-view-shimmer-line short" />
        <span className="sf-quick-view-shimmer sf-quick-view-shimmer-line title" />
        <span className="sf-quick-view-shimmer sf-quick-view-shimmer-line price" />
        <span className="sf-quick-view-shimmer sf-quick-view-shimmer-line" />
        <span className="sf-quick-view-shimmer sf-quick-view-shimmer-line" />
        <span className="sf-quick-view-shimmer sf-quick-view-shimmer-block" />
      </div>
      <p className="sr-only">Loading product</p>
    </div>
  );
}

/**
 * The product could not be read.
 *
 * Offline, or — the case worth designing for — a product the seller unpublished
 * while this grid sat open in a tab. Either way the modal says so and offers the
 * page, rather than rendering a buy box over numbers nobody can stand behind.
 */
function QuickViewUnavailable({ href, onClose }: { href: string; onClose: () => void }) {
  return (
    <div className="sf-quick-view-body sf-quick-view-empty">
      <h2>This product is not available right now</h2>
      <p>It may have sold out or been taken off the shop since this page loaded.</p>
      <Link className="sf-quick-view-full-link" href={href} onClick={onClose}>
        Open the product page
        <ArrowRight aria-hidden="true" />
      </Link>
    </div>
  );
}

/**
 * Stock, in the shopper's terms.
 *
 * The same three answers the product page gives, in the same order: something
 * sold past its stock is a pre-order with a date, not "out of stock", because a
 * shop that takes the order and then says nothing about when is how a seller
 * loses it.
 */
function QuickViewAvailability({
  allowPreorder,
  continueSelling,
  preorderReleaseAt,
  stockQuantity
}: {
  allowPreorder: boolean;
  continueSelling: boolean;
  preorderReleaseAt: string | null;
  stockQuantity: number;
}) {
  if (stockQuantity > 0) {
    return <p className="sf-quick-view-stock in-stock">{stockQuantity} in stock</p>;
  }

  if (allowPreorder || continueSelling) {
    return <p className="sf-quick-view-stock in-stock">{preorderLabel(preorderReleaseAt)}</p>;
  }

  return <p className="sf-quick-view-stock out-stock">Out of stock</p>;
}
