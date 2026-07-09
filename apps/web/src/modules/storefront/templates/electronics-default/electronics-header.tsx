"use client";

import { ChevronDown, Menu, Search, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { MiniCartDrawer } from "../../../cart/components/mini-cart-drawer";
import type { Cart } from "../../../cart/cart.types";
import {
  DEFAULT_STOREFRONT_ADVANCED_SETTINGS,
  normalizeAdvancedSettings,
  type StorefrontAdvancedSettings,
  type StorefrontMenuItem
} from "../../customization";
import styles from "./electronics-header.module.css";

type ElectronicsHeaderProps = {
  advancedSettings?: StorefrontAdvancedSettings;
  cart: Cart;
  currency: string;
  logoUrl: string | null;
  storeId: string;
  storeName: string;
  storeSlug: string;
  templateId?: string | null;
};

const electronicsMenuItems = [
  { label: "Features", url: "/products" },
  { label: "Phones", url: "/categories/smartphones" },
  { label: "Laptops", url: "/categories/laptops" },
  { label: "Headphones", url: "/categories/audio" },
  { label: "Speakers", url: "/categories/audio" },
  { label: "Smart Watches", url: "/products?search=watch" },
  { label: "Gaming", url: "/categories/gaming" }
];

const utilityLinks = [
  { label: "Journal", url: "/" },
  { label: "About", url: "/" }
];

export function ElectronicsStorefrontHeader({
  advancedSettings,
  cart,
  currency,
  logoUrl,
  storeId,
  storeName,
  storeSlug,
  templateId
}: ElectronicsHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const settings = normalizeAdvancedSettings(advancedSettings);
  const homeHref = `/s/${storeSlug}`;
  const displayName = storeName.trim() || "Stockmart";
  const logoText = settings.header.logoText || displayName;
  const navItems = isDefaultMenu(settings.header.menuItems)
    ? electronicsMenuItems
    : settings.header.menuItems;

  if (!settings.header.enabled) {
    return null;
  }

  return (
    <div
      className={`${styles.shell}${settings.header.sticky ? ` ${styles.shellSticky}` : ""}`}
      data-storefront-header-template={templateId ?? "electronics-default"}
    >
      <div className={styles.inner}>
        <div className={styles.topRow}>
          <Link className={styles.brand} href={homeHref} onClick={() => setMobileOpen(false)}>
            <span className={styles.brandMark}>
              {logoUrl ? <img alt={`${displayName} logo`} src={logoUrl} /> : "S"}
            </span>
            <span className={styles.brandName}>{logoText}</span>
          </Link>

          <Link className={styles.categoryButton} href={`${homeHref}/products`}>
            <Menu size={18} strokeWidth={2} />
            All categories
          </Link>

          {settings.header.showSearch ? (
            <form action={`${homeHref}/search`} className={styles.searchForm}>
              <input name="q" placeholder="What are You looking for ..." type="search" />
              <button aria-label="Search products" type="submit">
                <Search size={21} strokeWidth={2.1} />
              </button>
            </form>
          ) : <span />}

          <div className={styles.utilities}>
            {utilityLinks.map((item) => (
              <Link className={styles.utilityLink} href={resolveStorefrontHref(homeHref, item.url)} key={item.label}>
                {item.label}
              </Link>
            ))}
            <span className={styles.modeToggle}>
              Dark Mode
              <span className={styles.togglePill} aria-label="Dark mode off">
                <span className={styles.toggleKnob} />
                Off
              </span>
            </span>
            {settings.header.showCurrency ? <span className={styles.country}>CA</span> : null}
            <div className={styles.actions}>
              {settings.header.showAccount ? (
                <Link aria-label="Account" className={styles.iconLink} href={`${homeHref}/account`}>
                  <UserRound size={21} strokeWidth={2} />
                </Link>
              ) : null}
              {settings.header.showCart ? (
                <span className={styles.cartDivider}>
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
                </span>
              ) : null}
              <button
                aria-expanded={mobileOpen}
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                className={styles.mobileButton}
                onClick={() => setMobileOpen((value) => !value)}
                type="button"
              >
                {mobileOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.navRow}>
          <nav className={styles.nav} aria-label="Electronics navigation">
            {navItems.map((item, index) => (
              <Link href={resolveStorefrontHref(homeHref, item.url)} key={`${item.label}-${item.url}`}>
                {item.label}
                {index < 3 ? <ChevronDown size={12} strokeWidth={2.4} /> : null}
              </Link>
            ))}
          </nav>
          <p className={styles.support}>
            Need help? Call Us: <strong>+84 2500 888 33</strong>
          </p>
        </div>
      </div>

      {mobileOpen ? (
        <nav className={styles.mobileNav} aria-label="Mobile electronics navigation">
          <Link href={`${homeHref}/products`} onClick={() => setMobileOpen(false)}>All categories</Link>
          {navItems.map((item) => (
            <Link href={resolveStorefrontHref(homeHref, item.url)} key={`${item.label}-${item.url}`} onClick={() => setMobileOpen(false)}>
              {item.label}
            </Link>
          ))}
          {settings.header.showAccount ? <Link href={`${homeHref}/account`} onClick={() => setMobileOpen(false)}>Account</Link> : null}
          {settings.header.showCart ? <Link href={`${homeHref}/cart`} onClick={() => setMobileOpen(false)}>Cart</Link> : null}
        </nav>
      ) : null}
    </div>
  );
}

function isDefaultMenu(items: StorefrontMenuItem[]) {
  return items.every((item, index) => item.label === DEFAULT_STOREFRONT_ADVANCED_SETTINGS.header.menuItems[index]?.label);
}

function resolveStorefrontHref(homeHref: string, url: string) {
  if (url.startsWith("http") || url.startsWith("mailto:") || url.startsWith("tel:") || url.startsWith("#")) {
    return url;
  }

  if (url === homeHref || url.startsWith(`${homeHref}/`)) {
    return url;
  }

  return `${homeHref}${url === "/" ? "" : url.startsWith("/") ? url : `/${url}`}`;
}
