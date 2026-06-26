"use client";

import { Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export type DefaultStorefrontHeaderProps = {
  announcementText: string | null;
  cartCount?: number;
  logoUrl: string | null;
  storeName: string;
  storeSlug: string;
};

const navigationItems = [
  { label: "Home", path: "" },
  { label: "Shop", path: "/products" },
  { label: "Categories", path: "/categories" },
  { label: "Search", path: "/search" }
];

export function DefaultStorefrontHeader({
  announcementText,
  cartCount = 0,
  logoUrl,
  storeName,
  storeSlug
}: DefaultStorefrontHeaderProps) {
  const [open, setOpen] = useState(false);
  const homeHref = `/s/${storeSlug}`;

  return (
    <div className="sf-header-shell">
      {announcementText ? <div className="sf-announcement-bar">{announcementText}</div> : null}
      <header className="sf-header">
        <Link className="sf-brand" href={homeHref} onClick={() => setOpen(false)}>
          <span className="sf-brand-mark">
            {logoUrl ? <img alt={`${storeName} logo`} src={logoUrl} /> : storeName.slice(0, 1).toUpperCase()}
          </span>
          <span className="sf-brand-name">{storeName}</span>
        </Link>

        <nav className="sf-nav sf-desktop-nav" aria-label="Storefront navigation">
          {navigationItems.map((item) => (
            <Link href={`${homeHref}${item.path}`} key={item.label}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sf-header-actions">
          <Link aria-label="Search" className="sf-icon-action" href={`${homeHref}/search`}>
            <Search className="h-4 w-4" />
          </Link>
          <Link aria-label="Account" className="sf-icon-action" href={`${homeHref}/account`}>
            <UserRound className="h-4 w-4" />
          </Link>
          <Link aria-label="Cart" className="sf-icon-action sf-cart-icon-action" href={`${homeHref}/cart`}>
            <ShoppingBag className="h-4 w-4" />
            <span>{cartCount}</span>
          </Link>
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

      {open ? (
        <nav className="sf-mobile-nav" aria-label="Mobile storefront navigation">
          {navigationItems.map((item) => (
            <Link href={`${homeHref}${item.path}`} key={item.label} onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          ))}
          <Link href={`${homeHref}/account`} onClick={() => setOpen(false)}>
            Account
          </Link>
          <Link href={`${homeHref}/cart`} onClick={() => setOpen(false)}>
            Cart
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
