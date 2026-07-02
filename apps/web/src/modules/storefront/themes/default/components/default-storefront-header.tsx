"use client";

import { Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useState, type CSSProperties } from "react";
import {
  DEFAULT_STOREFRONT_ADVANCED_SETTINGS,
  normalizeAdvancedSettings,
  type StorefrontAdvancedSettings
} from "../../../customization";

export type DefaultStorefrontHeaderProps = {
  advancedSettings?: StorefrontAdvancedSettings;
  announcementText: string | null;
  cartCount?: number;
  logoUrl: string | null;
  storeName: string;
  storeSlug: string;
  templateId?: string | null;
};

export function DefaultStorefrontHeader({
  advancedSettings,
  announcementText,
  cartCount = 0,
  logoUrl,
  storeName,
  storeSlug,
  templateId
}: DefaultStorefrontHeaderProps) {
  const [open, setOpen] = useState(false);
  const settings = normalizeAdvancedSettings(advancedSettings);
  const homeHref = `/s/${storeSlug}`;
  const displayName = storeName.trim() || "Store";
  const logoText = settings.header.logoText || displayName;
  const brandInitial = displayName.charAt(0).toUpperCase();
  const cartCountLabel = String(cartCount);
  const navItems = settings.header.menuItems.length > 0
    ? settings.header.menuItems
    : DEFAULT_STOREFRONT_ADVANCED_SETTINGS.header.menuItems;
  const announcementMessages = settings.announcement.messages.length > 0
    ? settings.announcement.messages
    : DEFAULT_STOREFRONT_ADVANCED_SETTINGS.announcement.messages;
  const shellStyle = {
    "--sf-announcement-bg": settings.announcement.backgroundColor,
    "--sf-announcement-color": settings.announcement.textColor,
    "--sf-announcement-font-size": `${settings.announcement.fontSize}px`,
    "--sf-header-bg": settings.header.backgroundColor,
    "--sf-header-color": settings.header.textColor,
    "--sf-header-height": `${settings.header.height}px`,
    "--sf-header-spacing": `${settings.header.spacing}px`
  } as CSSProperties;

  return (
    <div
      className={`sf-header-shell${settings.header.sticky ? " sf-header-shell-sticky" : ""}`}
      data-storefront-header-template={templateId ?? "general-default"}
      style={shellStyle}
    >
      {settings.announcement.enabled ? (
        <AnnouncementBar
          messages={announcementMessages}
          scrollSpeed={settings.announcement.scrollSpeed}
          fallbackText={announcementText}
        />
      ) : null}
      {settings.header.enabled ? (
      <header className="sf-header">
        <Link className="sf-brand" href={homeHref} onClick={() => setOpen(false)}>
          <span className="sf-brand-mark" suppressHydrationWarning>
            {logoUrl ? <img alt={`${displayName} logo`} src={logoUrl} /> : brandInitial}
          </span>
          <span className="sf-brand-name">{logoText}</span>
        </Link>

        <nav className="sf-nav sf-desktop-nav" aria-label="Storefront navigation">
          {navItems.map((item) => (
            <Link href={resolveStorefrontHref(homeHref, item.url)} key={`${item.label}-${item.url}`}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sf-header-actions">
          {settings.header.showCurrency ? <span className="sf-currency-label">BDT - EN</span> : null}
          {settings.header.showSearch ? <Link aria-label="Search" className="sf-icon-action" href={`${homeHref}/search`}>
            <Search className="h-4 w-4" />
          </Link> : null}
          {settings.header.showAccount ? <Link aria-label="Account" className="sf-icon-action" href={`${homeHref}/account`}>
            <UserRound className="h-4 w-4" />
          </Link> : null}
          {settings.header.showCart ? <Link aria-label="Cart" className="sf-icon-action sf-cart-icon-action" href={`${homeHref}/cart`}>
            <ShoppingBag className="h-4 w-4" />
            <span suppressHydrationWarning>{cartCountLabel}</span>
          </Link> : null}
          <button
            aria-expanded={open}
            aria-label={open ? "Close storefront menu" : "Open storefront menu"}
            className="sf-mobile-menu-button"
            onClick={() => setOpen((value) => !value)}
            type="button"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>
      ) : null}

      {settings.header.enabled && open ? (
        <nav className="sf-mobile-nav" aria-label="Mobile storefront navigation">
          {navItems.map((item) => (
            <Link href={resolveStorefrontHref(homeHref, item.url)} key={`${item.label}-${item.url}`} onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          ))}
          {settings.header.showSearch ? <Link href={`${homeHref}/search`} onClick={() => setOpen(false)}>
            Search
          </Link> : null}
          {settings.header.showAccount ? <Link href={`${homeHref}/account`} onClick={() => setOpen(false)}>
            Account
          </Link> : null}
          {settings.header.showCart ? <Link href={`${homeHref}/cart`} onClick={() => setOpen(false)}>
            Cart
          </Link> : null}
        </nav>
      ) : null}
    </div>
  );
}

function AnnouncementBar({
  fallbackText,
  messages,
  scrollSpeed
}: {
  fallbackText: string | null;
  messages: Array<{ link?: string; text: string }>;
  scrollSpeed: "slow" | "normal" | "fast";
}) {
  const visibleMessages = messages.length > 0 ? messages : fallbackText ? [{ text: fallbackText }] : [];

  if (visibleMessages.length === 0) {
    return null;
  }

  return (
    <div className="sf-announcement-bar" data-speed={scrollSpeed}>
      <div className="sf-announcement-track">
        {[...visibleMessages, ...visibleMessages, ...visibleMessages].map((message, index) =>
          message.link ? (
            <Link href={message.link} key={`${message.text}-${index}`}>
              {message.text}
            </Link>
          ) : (
            <span key={`${message.text}-${index}`}>{message.text}</span>
          )
        )}
      </div>
    </div>
  );
}

function resolveStorefrontHref(homeHref: string, url: string) {
  if (url.startsWith("http")) {
    return url;
  }

  return `${homeHref}${url === "/" ? "" : url.startsWith("/") ? url : `/${url}`}`;
}
