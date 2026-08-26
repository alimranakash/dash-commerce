"use client";

import { ShoppingBag, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { StorefrontImage } from "../../storefront/components/storefront-image";
import type { StorefrontMiniCartSettings } from "../../storefront/customization";
import { formatStorefrontMoney } from "../../storefront/format";
import type { Cart, CartItem } from "../cart.types";
import type { CartCrossSellProduct } from "../cart-cross-sell";
import { submitCartAction } from "./cart-client-actions";
import { CartCrossSell } from "./cart-cross-sell";
import { CartNoteField } from "./cart-note-field";
import { QuantitySelector } from "./quantity-selector";
import { ShippingProgress } from "./shipping-progress";

type MiniCartDrawerProps = {
  cart: Cart;
  currency: string;
  homeHref: string;
  settings: StorefrontMiniCartSettings;
  store: {
    id: string;
    name: string;
    slug: string;
  };
};

export function MiniCartDrawer({
  cart,
  currency,
  homeHref,
  settings,
  store
}: MiniCartDrawerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [crossSell, setCrossSell] = useState<CartCrossSellProduct[]>([]);
  const router = useRouter();
  const itemCountLabel = cart.totals.itemCount === 1 ? "1 item" : `${cart.totals.itemCount} items`;
  const checkoutHref = `${homeHref}/checkout`;
  const viewCartHref = storefrontHref(homeHref, settings.viewCartButtonLink);
  const shopHref = storefrontHref(homeHref, settings.freeShippingCtaLink);
  const drawerStyle = {
    "--mini-cart-overlay-opacity": String(settings.overlayOpacity / 100),
    "--mini-cart-width": `${settings.drawerWidth}px`
  } as CSSProperties;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    if (!open) {
      return;
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    function handleCartUpdated() {
      router.refresh();

      if (settings.autoOpenAfterAdd) {
        setOpen(true);
      }
    }

    window.addEventListener("dash-cart-updated", handleCartUpdated);
    window.addEventListener("dash-cart-open", handleCartUpdated);

    return () => {
      window.removeEventListener("dash-cart-updated", handleCartUpdated);
      window.removeEventListener("dash-cart-open", handleCartUpdated);
    };
  }, [router, settings.autoOpenAfterAdd]);

  // Asked for when the drawer opens, and again whenever the cart changes under
  // it, so a suggestion the shopper has just taken leaves the rail.
  const cartSize = cart.totals.itemCount;

  useEffect(() => {
    if (!open || cart.items.length === 0) {
      return;
    }

    const controller = new AbortController();

    void fetch(`/api/cart/cross-sell?storeSlug=${encodeURIComponent(store.slug)}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    })
      .then((response) => response.json() as Promise<{ products?: CartCrossSellProduct[] }>)
      // A rail is a nicety; a cart that errors because one could not be built
      // is not. Failure leaves the last suggestions on screen and says nothing.
      .then((data) => setCrossSell(data.products ?? []))
      .catch(() => undefined);

    return () => controller.abort();
  }, [cart.items.length, cartSize, open, store.slug]);

  if (!settings.enabled) {
    return (
      <Link aria-label="Cart" className="sf-icon-action sf-cart-icon-action" href={`${homeHref}/cart`}>
        <ShoppingBag className="h-4 w-4" />
        {settings.showItemCount ? <span suppressHydrationWarning>{String(cart.totals.itemCount)}</span> : null}
      </Link>
    );
  }

  const drawer = (
    <div className={`mini-cart-shell${open ? " is-open" : ""}`} style={drawerStyle}>
      <button
        aria-label="Close cart drawer"
        className="mini-cart-overlay"
        onClick={() => setOpen(false)}
        tabIndex={open ? 0 : -1}
        type="button"
      />
      <aside aria-modal="true" className="mini-cart-drawer" role="dialog">
        <header className="mini-cart-header">
          <button aria-label="Close cart" className="mini-cart-close" onClick={() => setOpen(false)} type="button">
            <X size={22} strokeWidth={1.7} />
          </button>
          <div>
            <h2>Cart</h2>
            {settings.showItemCount ? <span>{itemCountLabel}</span> : null}
          </div>
        </header>

        {settings.freeShippingEnabled && cart.items.length > 0 ? (
          <ShippingProgress
            amount={settings.freeShippingAmount}
            ctaHref={shopHref}
            ctaText={settings.freeShippingCtaText}
            currency={currency}
            subtotal={cart.totals.subtotal}
            text={settings.freeShippingText}
          />
        ) : null}

        {cart.items.length === 0 ? (
          <EmptyMiniCart continueHref={shopHref} />
        ) : (
          <>
            <div className="mini-cart-items">
              {cart.items.map((item) => (
                <MiniCartItem
                  currency={currency}
                  item={item}
                  key={item.lineId}
                  settings={settings}
                  storeId={store.id}
                  storeName={store.name}
                  storeSlug={store.slug}
                />
              ))}
            </div>
            <CartCrossSell
              currency={currency}
              layout="drawer"
              products={crossSell}
              storeId={store.id}
              storeSlug={store.slug}
              title="Add before you check out"
            />
            <MiniCartSummary
              cart={cart}
              checkoutHref={checkoutHref}
              currency={currency}
              settings={settings}
              storeId={store.id}
              storeSlug={store.slug}
              viewCartHref={viewCartHref}
              onNavigate={() => setOpen(false)}
            />
          </>
        )}
      </aside>
    </div>
  );

  return (
    <>
      <button
        aria-expanded={open}
        aria-label="Open cart"
        className="sf-icon-action sf-cart-icon-action"
        onClick={() => setOpen(true)}
        type="button"
      >
        <ShoppingBag className="h-4 w-4" />
        {settings.showItemCount ? <span suppressHydrationWarning>{String(cart.totals.itemCount)}</span> : null}
      </button>
      {mounted ? createPortal(drawer, document.body) : null}
    </>
  );
}

function MiniCartItem({
  currency,
  item,
  settings,
  storeId,
  storeName,
  storeSlug
}: {
  currency: string;
  item: CartItem;
  settings: StorefrontMiniCartSettings;
  storeId: string;
  storeName: string;
  storeSlug: string;
}) {
  const [quantity, setQuantity] = useState(item.quantity);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function updateQuantity(nextQuantity: number) {
    const previousQuantity = quantity;
    setQuantity(nextQuantity);
    setError("");

    startTransition(async () => {
      const result = await submitCartAction({
        cartAction: "update",
        lineId: item.lineId,
        productId: item.productId,
        quantity: String(nextQuantity),
        storeId,
        storeSlug
      });

      if (!result.ok) {
        setQuantity(previousQuantity);
        setError(result.message);
        return;
      }

      router.refresh();
    });
  }

  function removeItem() {
    setError("");

    startTransition(async () => {
      const result = await submitCartAction({
        cartAction: "remove",
        lineId: item.lineId,
        productId: item.productId,
        storeId,
        storeSlug
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      router.refresh();
    });
  }

  return (
    <article className="mini-cart-item">
      <div className="mini-cart-item-image">
        <StorefrontImage alt={item.title} fallback="Product" src={item.image} />
      </div>
      <div className="mini-cart-item-body">
        {settings.showBrand ? <p>{storeName}</p> : null}
        <h3>{item.title}</h3>
        {settings.showVariant ? <span>{item.variantTitle ?? "Standard"}</span> : null}
        <strong>{formatStorefrontMoney(item.price, currency)}</strong>
        {error ? <small className="mini-cart-error">{error}</small> : null}
      </div>
      <div className="mini-cart-item-actions">
        {settings.showQuantity ? (
          <QuantitySelector disabled={isPending} onChange={updateQuantity} quantity={quantity} />
        ) : null}
        {settings.showRemoveButton ? (
          <button
            aria-label={`Remove ${item.title}`}
            className="mini-cart-remove"
            disabled={isPending}
            onClick={removeItem}
            type="button"
          >
            <Trash2 size={15} strokeWidth={1.7} />
          </button>
        ) : null}
      </div>
    </article>
  );
}

function MiniCartSummary({
  cart,
  checkoutHref,
  currency,
  onNavigate,
  settings,
  storeId,
  storeSlug,
  viewCartHref
}: {
  cart: Cart;
  checkoutHref: string;
  currency: string;
  onNavigate: () => void;
  settings: StorefrontMiniCartSettings;
  storeId: string;
  storeSlug: string;
  viewCartHref: string;
}) {
  const subtotal = Number(cart.totals.subtotal);

  return (
    <footer className="mini-cart-footer">
      {settings.orderNotesEnabled ? (
        <CartNoteField
          className="mini-cart-notes"
          note={cart.note}
          rows={3}
          storeId={storeId}
          storeSlug={storeSlug}
        />
      ) : null}
      <div className="mini-cart-summary-lines">
        <div>
          <span>Subtotal</span>
          <strong>{formatStorefrontMoney(subtotal, currency)}</strong>
        </div>
        <div>
          <span>Delivery Charges</span>
          <strong>Calculated at checkout</strong>
        </div>
        <p>Shipping, taxes and discount codes calculated at checkout</p>
        <div>
          <span>Estimated Total</span>
          <strong>{formatStorefrontMoney(subtotal, currency)}</strong>
        </div>
      </div>
      {settings.checkoutButtonEnabled ? (
        <Link
          className="mini-cart-checkout"
          href={checkoutHref}
          onClick={onNavigate}
          style={{
            backgroundColor: settings.checkoutButtonBackgroundColor,
            borderRadius: `${settings.checkoutButtonBorderRadius}px`,
            color: settings.checkoutButtonTextColor
          }}
        >
          {settings.checkoutButtonText}
        </Link>
      ) : null}
      {settings.viewCartButtonEnabled ? (
        <Link className="mini-cart-view-cart" href={viewCartHref} onClick={onNavigate}>
          {settings.viewCartButtonText}
        </Link>
      ) : null}
    </footer>
  );
}

function EmptyMiniCart({ continueHref }: { continueHref: string }) {
  return (
    <div className="mini-cart-empty">
      <h3>Your cart is empty</h3>
      <p>Add products to your cart and they will appear here.</p>
      <Link href={continueHref}>Continue Shopping</Link>
    </div>
  );
}

function storefrontHref(basePath: string, value: string) {
  if (value.startsWith("http")) {
    return value;
  }

  // Guarded on basePath: on a storefront hostname it is empty, and every value
  // startsWith("") — which would return each link unprefixed by accident rather
  // than by decision.
  if (basePath && value.startsWith(basePath)) {
    return value;
  }

  if (value === "/") {
    return basePath || "/";
  }

  return `${basePath}${value.startsWith("/") ? value : `/${value}`}`;
}
