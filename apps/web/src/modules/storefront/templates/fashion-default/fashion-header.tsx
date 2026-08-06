"use client";

import { Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { MiniCartDrawer } from "../../../cart/components/mini-cart-drawer";
import type { Cart } from "../../../cart/cart.types";
import {
  DEFAULT_STOREFRONT_ADVANCED_SETTINGS,
  normalizeAdvancedSettings,
  type StorefrontAdvancedSettings
} from "../../customization";

type FashionHeaderProps = {
  advancedSettings?: StorefrontAdvancedSettings;
  announcementText: string | null;
  cart: Cart;
  currency: string;
  logoUrl: string | null;
  storeId: string;
  storeName: string;
  storeSlug: string;
  templateId?: string | null;
};

const fashionMenuItems = [
  { label: "SHOP", url: "/products" },
  { label: "BRANDS", url: "/products" },
  { label: "OUR WORLD", url: "#fashion-featured-look" },
  { label: "PRESETS", url: "#fashion-featured-collections" },
  { label: "FEATURES", url: "#fashion-new-collection" }
];

export function FashionStorefrontHeader({
  advancedSettings,
  announcementText,
  cart,
  currency,
  logoUrl,
  storeId,
  storeName,
  storeSlug,
  templateId
}: FashionHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [overlay, setOverlay] = useState(true);
  const [messageIndex, setMessageIndex] = useState(0);
  const settings = normalizeAdvancedSettings(advancedSettings);
  const homeHref = `/s/${storeSlug}`;
  const displayName = storeName.trim() || "Store";
  const logoText = settings.header.logoText || displayName;
  const navItems = isDefaultMenu(settings.header.menuItems)
    ? fashionMenuItems
    : settings.header.menuItems;
  const messages = settings.announcement.messages.length > 0
    ? settings.announcement.messages
    : DEFAULT_STOREFRONT_ADVANCED_SETTINGS.announcement.messages;
  const announcementEnabled = settings.announcement.enabled;
  // This shell shows one message at a time instead of a marquee, so the
  // Messages list rotates on a timer driven by the Scroll speed setting.
  const rotationMs = ANNOUNCEMENT_ROTATION_MS[settings.announcement.scrollSpeed];
  const shellStyle = {
    "--fashion-announcement-bg": settings.announcement.backgroundColor || "#151313",
    "--fashion-announcement-color": settings.announcement.textColor || "#ffffff",
    "--fashion-announcement-font-size": `${settings.announcement.fontSize}px`,
    "--fashion-header-bg": settings.header.backgroundColor,
    "--fashion-header-color": settings.header.textColor,
    "--fashion-header-height": `${settings.header.height}px`
  } as CSSProperties;

  useEffect(() => {
    const onScroll = () => setOverlay(window.scrollY <= 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!announcementEnabled || messages.length < 2) {
      return;
    }

    const timer = window.setInterval(() => {
      setMessageIndex((index) => (index + 1) % messages.length);
    }, rotationMs);

    return () => window.clearInterval(timer);
  }, [announcementEnabled, messages.length, rotationMs]);

  return (
    <div
      className={`fashion-header-shell${overlay ? " fashion-header-shell-overlay" : ""}${announcementEnabled ? " fashion-header-shell-has-announcement" : ""}${settings.header.sticky ? "" : " fashion-header-shell-static"}`}
      data-storefront-header-template={templateId ?? "fashion-default"}
      style={shellStyle}
    >
      {announcementEnabled ? (
        <div className="fashion-announcement">
          <div className="fashion-announcement-message">
            {resolveAnnouncement(messages, messageIndex, announcementText, homeHref)}
          </div>
          {settings.header.showCurrency ? <span>{currency || "BDT"} · EN</span> : null}
        </div>
      ) : null}

      {settings.header.enabled ? (
        <header className="fashion-header">
          <nav className="fashion-header-nav fashion-desktop-nav" aria-label="Fashion storefront navigation">
            {navItems.map((item) => (
              <Link href={resolveStorefrontHref(homeHref, item.url)} key={`${item.label}-${item.url}`}>
                {item.label}
              </Link>
            ))}
          </nav>

          <button
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            className="fashion-mobile-menu-button"
            onClick={() => setMobileOpen((value) => !value)}
            type="button"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link className="fashion-brand" href={homeHref} onClick={() => setMobileOpen(false)}>
            {logoUrl ? <img alt={`${displayName} logo`} src={logoUrl} /> : null}
            <span>{logoText}</span>
          </Link>

          <div className="fashion-header-actions">
            {settings.header.showAccount ? (
              <Link aria-label="Account" href={`${homeHref}/account`}>
                <UserRound className="h-5 w-5" />
              </Link>
            ) : null}
            {settings.header.showSearch ? (
              <Link aria-label="Search" href={`${homeHref}/search`}>
                <Search className="h-5 w-5" />
              </Link>
            ) : null}
            {settings.header.showCart ? (
              <MiniCartDrawer
                cart={cart}
                currency={currency}
                homeHref={homeHref}
                settings={settings.miniCart}
                store={{
                  id: storeId,
                  name: displayName,
                  slug: storeSlug
                }}
              />
            ) : (
              <Link aria-label="Cart" href={`${homeHref}/cart`}>
                <ShoppingBag className="h-5 w-5" />
              </Link>
            )}
          </div>
        </header>
      ) : null}

      {settings.header.enabled && mobileOpen ? (
        <nav className="fashion-mobile-nav" aria-label="Mobile fashion navigation">
          {navItems.map((item) => (
            <Link href={resolveStorefrontHref(homeHref, item.url)} key={`${item.label}-${item.url}`} onClick={() => setMobileOpen(false)}>
              {item.label}
            </Link>
          ))}
          {settings.header.showSearch ? <Link href={`${homeHref}/search`} onClick={() => setMobileOpen(false)}>SEARCH</Link> : null}
          {settings.header.showAccount ? <Link href={`${homeHref}/account`} onClick={() => setMobileOpen(false)}>ACCOUNT</Link> : null}
          {settings.header.showCart ? <Link href={`${homeHref}/cart`} onClick={() => setMobileOpen(false)}>CART</Link> : null}
        </nav>
      ) : null}
    </div>
  );
}

const ANNOUNCEMENT_ROTATION_MS: Record<"slow" | "normal" | "fast", number> = {
  fast: 2500,
  normal: 4500,
  slow: 7000
};

function resolveAnnouncement(
  messages: Array<{ link?: string; text: string }>,
  index: number,
  fallbackText: string | null,
  homeHref: string
) {
  const message = messages[index % Math.max(messages.length, 1)]
    ?? messages[0]
    ?? (fallbackText ? { text: fallbackText } : null);

  if (!message) {
    return <span>Swim Capsule. Be the first to shop the drop.</span>;
  }

  return message.link ? (
    <Link href={resolveStorefrontHref(homeHref, message.link)}>{message.text}</Link>
  ) : (
    <span>{message.text}</span>
  );
}

function isDefaultMenu(items: StorefrontAdvancedSettings["header"]["menuItems"]) {
  return items.every((item, index) => item.label === DEFAULT_STOREFRONT_ADVANCED_SETTINGS.header.menuItems[index]?.label);
}

function resolveStorefrontHref(homeHref: string, url: string) {
  if (url.startsWith("http") || url.startsWith("mailto:") || url.startsWith("tel:")) {
    return url;
  }

  if (url.startsWith("#")) {
    return `${homeHref}${url}`;
  }

  if (url === homeHref || url.startsWith(`${homeHref}/`)) {
    return url;
  }

  return `${homeHref}${url === "/" ? "" : url.startsWith("/") ? url : `/${url}`}`;
}
