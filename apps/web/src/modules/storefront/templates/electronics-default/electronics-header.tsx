"use client";

import { useStorefrontBasePath } from "../../base-path-provider";
import type { FreeShippingBarView } from "../../../free-shipping/free-shipping.schema";
import { ChevronDown, Menu, UserRound, X } from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode
} from "react";
import { PredictiveSearch } from "../../../search/components/predictive-search";
import { MiniCartDrawer } from "../../../cart/components/mini-cart-drawer";
import type { Cart } from "../../../cart/cart.types";
import { ThemeModeToggle } from "../../../theme-mode/components/theme-mode-toggle";
import { WishlistHeaderLink } from "../../../wishlist/components/wishlist-header-link";
import {
  DEFAULT_STOREFRONT_ADVANCED_SETTINGS,
  normalizeAdvancedSettings,
  type StorefrontAdvancedSettings,
  type StorefrontMenuItem
} from "../../customization";
import type {
  ElectronicsHeaderBrand,
  ElectronicsHeaderCategory
} from "./electronics-header-data";
import styles from "./electronics-header.module.css";

type ElectronicsHeaderProps = {
  advancedSettings?: StorefrontAdvancedSettings;
  announcementText: string | null;
  brands: ElectronicsHeaderBrand[];
  cart: Cart;
  categories: ElectronicsHeaderCategory[];
  currency: string;
  freeShippingBar: FreeShippingBarView | null;
  logoUrl: string | null;
  storeId: string;
  storeName: string;
  storeSlug: string;
  templateId?: string | null;
};

const electronicsMenuItems = [
  { label: "Features", url: "/products" },
  { label: "Phones", url: "/categories/mobile-accessories" },
  { label: "Laptops", url: "/categories/computing" },
  { label: "Headphones", url: "/categories/audio" },
  { label: "Speakers", url: "/categories/audio" },
  { label: "Smart Watches", url: "/search?q=watch" },
  { label: "Gaming", url: "/categories/gaming" }
];

const dropdownLabels = new Set(["features", "phones", "laptops"]);

export function ElectronicsStorefrontHeader({
  advancedSettings,
  announcementText,
  brands,
  cart,
  categories,
  currency,
  freeShippingBar,
  logoUrl,
  storeId,
  storeName,
  storeSlug,
  templateId
}: ElectronicsHeaderProps) {
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const settings = normalizeAdvancedSettings(advancedSettings);
  const homeHref = useStorefrontBasePath();
  const displayName = storeName.trim() || "Stockmart";
  const logoText = settings.header.logoText || displayName;
  const navItems = isDefaultMenu(settings.header.menuItems)
    ? electronicsMenuItems
    : settings.header.menuItems;
  const announcementMessages = settings.announcement.messages.length > 0
    ? settings.announcement.messages
    : DEFAULT_STOREFRONT_ADVANCED_SETTINGS.announcement.messages;
  const shellStyle = {
    "--electronics-announcement-bg": settings.announcement.backgroundColor,
    "--electronics-announcement-color": settings.announcement.textColor,
    "--electronics-announcement-font-size": `${settings.announcement.fontSize}px`,
    "--electronics-header-bg": settings.header.backgroundColor,
    "--electronics-header-color": settings.header.textColor,
    "--electronics-header-height": `${settings.header.height}px`,
    "--electronics-nav-gap": `${settings.header.spacing}px`
  } as CSSProperties;

  useEffect(() => {
    function closeFromOutside(event: PointerEvent) {
      if (!shellRef.current?.contains(event.target as Node)) {
        closeMenus();
      }
    }

    function closeFromEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      const activeMenu = categoryOpen ? "categories" : openDropdown;
      closeMenus();
      shellRef.current
        ?.querySelector<HTMLButtonElement>(`[data-menu-trigger="${activeMenu ?? ""}"]`)
        ?.focus();
    }

    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromEscape);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromEscape);
    };
  }, [categoryOpen, openDropdown]);

  if (!settings.header.enabled) {
    return settings.announcement.enabled ? (
      <ElectronicsAnnouncementBar
        fallbackText={announcementText}
        homeHref={homeHref}
        messages={announcementMessages}
        scrollSpeed={settings.announcement.scrollSpeed}
        style={shellStyle}
      />
    ) : null;
  }

  function closeMenus() {
    setCategoryOpen(false);
    setOpenDropdown(null);
    setMobileSection(null);
  }

  function openAndFocus(menu: "categories" | string) {
    if (menu === "categories") {
      setCategoryOpen(true);
      setOpenDropdown(null);
    } else {
      setOpenDropdown(menu);
      setCategoryOpen(false);
    }

    requestAnimationFrame(() => {
      shellRef.current
        ?.querySelector<HTMLElement>(`[data-menu-panel="${menu}"] a`)
        ?.focus();
    });
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLButtonElement>, menu: string) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openAndFocus(menu);
    }
  }

  return (
    <div
      className={`${styles.shell}${settings.header.sticky ? ` ${styles.shellSticky}` : ""}`}
      data-storefront-header-template={templateId ?? "electronics-default"}
      ref={shellRef}
      style={shellStyle}
    >
      {settings.announcement.enabled ? (
        <ElectronicsAnnouncementBar
          fallbackText={announcementText}
          homeHref={homeHref}
          messages={announcementMessages}
          scrollSpeed={settings.announcement.scrollSpeed}
        />
      ) : null}

      <div className={styles.inner}>
        <div className={styles.topRow}>
          <Link className={styles.brand} href={homeHref || "/"} onClick={() => setMobileOpen(false)}>
            <span className={styles.brandMark}>
              {logoUrl ? <img alt={`${displayName} logo`} src={logoUrl} /> : "S"}
            </span>
            <span className={styles.brandName}>{logoText}</span>
          </Link>

          <div className={styles.categoryMenuWrap}>
            <button
              aria-expanded={categoryOpen}
              aria-haspopup="menu"
              className={styles.categoryButton}
              data-menu-trigger="categories"
              onClick={() => {
                setCategoryOpen((value) => !value);
                setOpenDropdown(null);
              }}
              onKeyDown={(event) => handleMenuKeyDown(event, "categories")}
              type="button"
            >
              <Menu size={18} strokeWidth={2} />
              All categories
              <ChevronDown className={categoryOpen ? styles.chevronOpen : undefined} size={14} />
            </button>
            {categoryOpen ? (
              <div className={styles.categoryDropdown} data-menu-panel="categories" role="menu">
                <div className={styles.dropdownHeading}>
                  <strong>Shop categories</strong>
                  <span>{categories.length} available</span>
                </div>
                <div className={styles.categoryList}>
                  {categories.length > 0 ? categories.map((category) => (
                    <Link
                      href={`${homeHref}/categories/${category.slug}`}
                      key={category.id}
                      onClick={closeMenus}
                      role="menuitem"
                    >
                      <span className={styles.categoryVisual}>
                        {category.imageUrl ? (
                          <img alt="" src={category.imageUrl} />
                        ) : (
                          category.name.slice(0, 2).toUpperCase()
                        )}
                      </span>
                      <span>{category.name}</span>
                    </Link>
                  )) : (
                    <span className={styles.menuEmpty}>No categories available yet.</span>
                  )}
                </div>
                <Link className={styles.viewAllLink} href={`${homeHref}/categories`} onClick={closeMenus}>
                  View all categories
                </Link>
              </div>
            ) : null}
          </div>

          {settings.header.showSearch ? (
            <PredictiveSearch
              className={styles.searchSlot}
              currency={currency}
              placeholder="What are You looking for ..."
              storeSlug={storeSlug}
            />
          ) : <span />}

          <div className={styles.utilities}>
            {settings.header.showCurrency ? (
              <span className={styles.currencyLabel}>{currency || "BDT"} - EN</span>
            ) : null}
            <div className={styles.actions}>
              {settings.header.showAccount ? (
                <Link aria-label="Account" className={styles.iconLink} href={`${homeHref}/account`}>
                  <UserRound size={21} strokeWidth={2} />
                </Link>
              ) : null}
              <WishlistHeaderLink className={styles.iconLink} iconSize={21} />
              <ThemeModeToggle className={styles.iconLink} iconSize={21} />
              {settings.header.showCart ? (
                <span className={styles.cartDivider}>
                  <MiniCartDrawer
                    cart={cart}
                    freeShippingBar={freeShippingBar}
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
            {navItems.map((item) => {
              const menuKey = item.label.toLowerCase();
              const menuBrands = dropdownLabels.has(menuKey) ? brandsForMenu(brands, menuKey) : [];

              return menuBrands.length > 0 ? (
                <div
                  className={styles.navMenu}
                  key={`${item.label}-${item.url}`}
                  onMouseEnter={() => setOpenDropdown(menuKey)}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  <button
                    aria-expanded={openDropdown === menuKey}
                    aria-haspopup="menu"
                    data-menu-trigger={menuKey}
                    onClick={() => setOpenDropdown((value) => value === menuKey ? null : menuKey)}
                    onKeyDown={(event) => handleMenuKeyDown(event, menuKey)}
                    type="button"
                  >
                    {item.label}
                    <ChevronDown className={openDropdown === menuKey ? styles.chevronOpen : undefined} size={12} strokeWidth={2.4} />
                  </button>
                  {openDropdown === menuKey ? (
                    <div className={styles.navDropdown} data-menu-panel={menuKey} role="menu">
                      <span className={styles.navDropdownLabel}>Shop by brand</span>
                      {menuBrands.map((brand) => (
                        <Link
                          href={`${homeHref}/products?brand=${encodeURIComponent(brand.slug)}`}
                          key={brand.id}
                          onClick={closeMenus}
                          role="menuitem"
                        >
                          {brand.name}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <Link href={resolveStorefrontHref(homeHref, item.url)} key={`${item.label}-${item.url}`}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <p className={styles.support}>
            {settings.electronics.supportText}
          </p>
        </div>
      </div>

      {mobileOpen ? (
        <nav className={styles.mobileNav} aria-label="Mobile electronics navigation">
          <MobileMenuSection
            expanded={mobileSection === "categories"}
            label="All categories"
            onToggle={() => setMobileSection((value) => value === "categories" ? null : "categories")}
          >
            {categories.map((category) => (
              <Link href={`${homeHref}/categories/${category.slug}`} key={category.id} onClick={() => setMobileOpen(false)}>
                {category.name}
              </Link>
            ))}
          </MobileMenuSection>

          {navItems.map((item) => {
            const menuKey = item.label.toLowerCase();
            const menuBrands = dropdownLabels.has(menuKey) ? brandsForMenu(brands, menuKey) : [];

            return menuBrands.length > 0 ? (
              <MobileMenuSection
                expanded={mobileSection === menuKey}
                key={`${item.label}-${item.url}`}
                label={item.label}
                onToggle={() => setMobileSection((value) => value === menuKey ? null : menuKey)}
              >
                {menuBrands.map((brand) => (
                  <Link
                    href={`${homeHref}/products?brand=${encodeURIComponent(brand.slug)}`}
                    key={brand.id}
                    onClick={() => setMobileOpen(false)}
                  >
                    {brand.name}
                  </Link>
                ))}
              </MobileMenuSection>
            ) : (
              <Link href={resolveStorefrontHref(homeHref, item.url)} key={`${item.label}-${item.url}`} onClick={() => setMobileOpen(false)}>
                {item.label}
              </Link>
            );
          })}
          {/* The icon row collapses on a phone, so this is the wishlist's only
            way in below the header's mobile breakpoint. */}
          <Link href={`${homeHref}/wishlist`} onClick={() => setMobileOpen(false)}>
            Wishlist
          </Link>
        </nav>
      ) : null}
    </div>
  );
}

function ElectronicsAnnouncementBar({
  fallbackText,
  homeHref,
  messages,
  scrollSpeed,
  style
}: {
  fallbackText: string | null;
  homeHref: string;
  messages: Array<{ link?: string; text: string }>;
  scrollSpeed: "slow" | "normal" | "fast";
  style?: CSSProperties;
}) {
  const visibleMessages = messages.length > 0 ? messages : fallbackText ? [{ text: fallbackText }] : [];

  if (visibleMessages.length === 0) {
    return null;
  }

  return (
    <div className={styles.announcement} data-speed={scrollSpeed} style={style}>
      <div className={styles.announcementTrack}>
        {[...visibleMessages, ...visibleMessages, ...visibleMessages].map((message, index) =>
          message.link ? (
            <Link href={resolveStorefrontHref(homeHref, message.link)} key={`${message.text}-${index}`}>
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

function MobileMenuSection({
  children,
  expanded,
  label,
  onToggle
}: {
  children: ReactNode;
  expanded: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <div className={styles.mobileSection}>
      <button aria-expanded={expanded} onClick={onToggle} type="button">
        {label}
        <ChevronDown className={expanded ? styles.chevronOpen : undefined} size={15} />
      </button>
      {expanded ? <div className={styles.mobileSubmenu}>{children}</div> : null}
    </div>
  );
}

function brandsForMenu(brands: ElectronicsHeaderBrand[], menuKey: string) {
  if (menuKey === "features") {
    return brands;
  }

  const categoryTerms = menuKey === "phones"
    ? ["phone", "smartphone", "mobile"]
    : ["laptop", "notebook", "computer"];
  const relevantBrands = brands.filter((brand) =>
    brand.categorySlugs.some((slug) => categoryTerms.some((term) => slug.toLowerCase().includes(term)))
  );

  return relevantBrands.length > 0 ? relevantBrands : brands;
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

  if (url === "/") {
    // On a storefront hostname homeHref is empty, and an empty href is not a link.
    return homeHref || "/";
  }

  return `${homeHref}${url.startsWith("/") ? url : `/${url}`}`;
}
