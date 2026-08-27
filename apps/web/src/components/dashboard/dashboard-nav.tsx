"use client";

import {
  BarChart3,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Boxes,
  FileText,
  Images,
  LayoutDashboard,
  Megaphone,
  Package,
  Radar,
  Receipt,
  ReceiptText,
  ShoppingBag,
  Settings,
  Store,
  Truck,
  WalletCards,
  Users,
  X
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ComponentType } from "react";
import { LogoutButton } from "../../modules/auth/logout-button";
import { getEntitledFeaturesAction } from "../../modules/billing/billing-features.actions";
import { isPaidFeature } from "../../modules/admin/plan-catalog";
import { PaidBadge } from "../../modules/billing/components/paid-badge";
import type { PlanFeatureKey } from "../../modules/billing/plan-features";
import { getViewerCanManageStoreAction } from "../../modules/stores/store-access.actions";

type DashboardNavProps = {
  onClose: () => void;
  open: boolean;
  storeSlug: string;
};

type NavItem = {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
};

/**
 * Nav routes that map onto a plan feature. Only routes that actually exist are
 * listed — an entitlement badge on a page we do not ship would advertise
 * vapourware.
 */
const NAV_FEATURE_BY_HREF: Record<string, PlanFeatureKey> = {
  "/dashboard/abandoned-cart": "abandoned_cart",
  "/dashboard/expenses": "expenses",
  "/dashboard/marketing/campaigns": "sms_automation",
  "/dashboard/marketing/campaigns/new": "sms_automation",
  "/dashboard/fraud-check": "fraud_check",
  "/dashboard/inventory": "inventory",
  "/dashboard/orders/fake": "fake_orders",
  "/dashboard/orders/incomplete": "abandoned_cart",
  "/dashboard/orders/tracking": "order_tracking",
  "/dashboard/orders/verification": "order_verification",
  "/dashboard/purchases": "purchases",
  "/dashboard/reports/abandoned-carts": "abandoned_cart",
  "/dashboard/reports/incomplete-orders": "abandoned_cart",
  "/dashboard/sales": "sales",
  "/dashboard/settings/courier": "courier_api",
  "/dashboard/settings/domains": "custom_domain",
  "/dashboard/analytics/server-side": "server_side_tracking",
  "/dashboard/suppliers": "suppliers"
};

/**
 * Entitled feature keys, or `null` while still loading. Rendering nothing until
 * it resolves avoids flashing a "Paid" badge at sellers who do have the feature.
 */
const EntitledFeaturesContext = createContext<ReadonlySet<string> | null>(null);

function NavFeatureBadge({ href }: { href: string }) {
  const entitled = useContext(EntitledFeaturesContext);
  const feature = NAV_FEATURE_BY_HREF[href];

  if (!feature || !entitled || entitled.has(feature) || !isPaidFeature(feature)) {
    return null;
  }

  return (
    <span className="ml-1.5 align-middle">
      <PaidBadge feature={feature} interactive={false} />
    </span>
  );
}

const productLinks = [
  { href: "/dashboard/products", label: "All Products" },
  { href: "/dashboard/products/new", label: "Add Product" },
  { href: "/dashboard/attributes", label: "Attributes" },
  { href: "/dashboard/categories", label: "Categories" },
  { href: "/dashboard/tags", label: "Tags" },
  { href: "/dashboard/brands", label: "Brands" },
  { href: "/dashboard/products/reviews", label: "Reviews" },
  // Filed under Products rather than Orders: the question it answers is what to
  // buy, and the seller is looking at the catalog when they ask it.
  { href: "/dashboard/products/preorders", label: "Pre-orders" }
];

const orderLinks = [
  { href: "/dashboard/orders", label: "All Orders" },
  { href: "/dashboard/orders/new", label: "Create Order" },
  // Beside the orders that exist rather than in Marketing with the abandoned
  // carts: a filled-in checkout is an order the seller nearly had, and it is
  // worked from the same screen and the same phone as the rest of this list.
  { href: "/dashboard/orders/incomplete", label: "Incomplete Orders" },
  { href: "/dashboard/orders/tracking", label: "Order Tracking" },
  { href: "/dashboard/orders/returns", label: "Returns" },
  { href: "/dashboard/orders/exchanges", label: "Exchanges" },
  { href: "/dashboard/orders/refunds", label: "Refunds" },
  { href: "/dashboard/orders/fake", label: "Fake Orders" },
  { href: "/dashboard/orders/verification", label: "Verification Queue" },
  { href: "/dashboard/orders/blocked-ips", label: "Blocked IPs" },
  // Lives at /dashboard/fraud-check rather than under /dashboard/orders, so the
  // route checks below have to name it explicitly.
  { href: "/dashboard/fraud-check", label: "Fraud Check" }
];

const reportLinks = [
  { href: "/dashboard/reports", label: "Overview" },
  { href: "/dashboard/reports/orders", label: "Orders" },
  { href: "/dashboard/reports/revenues", label: "Revenues" },
  { href: "/dashboard/reports/products", label: "Products" },
  { href: "/dashboard/reports/customers", label: "Customers" },
  { href: "/dashboard/reports/merchandising", label: "Upsell & Cross-sell" },
  { href: "/dashboard/reports/abandoned-carts", label: "Abandoned Carts" },
  { href: "/dashboard/reports/incomplete-orders", label: "Incomplete Orders" }
];

const settingsLinks = [
  { href: "/dashboard/settings/general", label: "General" },
  { href: "/dashboard/settings/team", label: "Team" },
  { href: "/dashboard/settings/domains", label: "Domains" },
  { href: "/dashboard/settings/courier", label: "Courier" },
  { href: "/dashboard/settings/sms", label: "SMS" },
  { href: "/dashboard/settings/invoice", label: "Invoice" },
  { href: "/dashboard/settings/social", label: "Social" },
  { href: "/dashboard/settings/integrations", label: "Integrations" },
  { href: "/dashboard/payments", label: "Payments" },
  { href: "/dashboard/shipping", label: "Shipping" },
  { href: "/dashboard/ai", label: "StoreIM AI" }
];

const storefrontLinks = [
  { href: "/dashboard/storefront/themes", label: "Themes" },
  { href: "/dashboard/storefront/themes#theme-settings", label: "Customize" },
  { href: "/dashboard/storefront/themes#theme-settings", label: "Homepage" },
  { href: "/dashboard/storefront/themes#header", label: "Header" },
  { href: "/dashboard/storefront/themes#footer-social-preview", label: "Footer" },
  { href: "/dashboard/storefront/themes#header", label: "Navigation" },
  { href: "/dashboard/storefront/themes#colors-layout", label: "Colors & Typography" },
  { href: "/dashboard/storefront/themes#shop-collection-page", label: "Pages" },
  { href: "/dashboard/storefront/search", label: "Search & Discovery" },
  { href: "/dashboard/storefront/demo-content", label: "Demo Content" }
];

const mainLinks: NavItem[] = [
  { href: "/dashboard/sales", icon: ShoppingBag, label: "Sales" },
  { href: "/dashboard/transactions", icon: CircleDollarSign, label: "Transactions" },
  { href: "/dashboard/customers", icon: Users, label: "Customers" },
  { href: "/dashboard/suppliers", icon: Truck, label: "Suppliers" },
  { href: "/dashboard/purchases", icon: ClipboardList, label: "Purchases" },
  { href: "/dashboard/inventory", icon: Boxes, label: "Inventory" },
  { href: "/dashboard/expenses", icon: Receipt, label: "Expenses" },
  { href: "/dashboard/billing", icon: WalletCards, label: "Billing" }
];

/**
 * Everything that reaches a customer on purpose.
 *
 * Coupons and Abandoned cart moved here from the flat lists: both are things a
 * seller does to bring people back, and having them three groups apart from the
 * campaigns that carry them made the sidebar a worse map than the product is.
 * Tracking & Pixels points at the existing settings page — it is read by the
 * same person on the same errand, so it is listed where they will look.
 */
const marketingLinks: Array<{ href: string; label: string }> = [
  { href: "/dashboard/marketing", label: "Overview" },
  { href: "/dashboard/marketing/campaigns", label: "Campaigns" },
  { href: "/dashboard/marketing/campaigns/new", label: "Create Campaign" },
  { href: "/dashboard/marketing/audiences", label: "Audiences" },
  { href: "/dashboard/marketing/templates", label: "Templates" },
  { href: "/dashboard/coupons", label: "Coupons" },
  { href: "/dashboard/marketing/order-bump", label: "Order Bump" },
  { href: "/dashboard/marketing/bundles", label: "Bundles" },
  { href: "/dashboard/abandoned-cart", label: "Abandoned Cart" }
];

/**
 * Pixels, tags and server-side senders — a section of its own rather than a
 * page inside Settings or Marketing.
 *
 * It used to be one long form at /dashboard/settings/marketing. Sellers set
 * these up per platform, following that platform's own documentation, so a page
 * per platform is the shape the work actually has.
 */
const analyticsLinks: Array<{ href: string; label: string }> = [
  { href: "/dashboard/analytics", label: "Overview" },
  { href: "/dashboard/analytics/google-analytics", label: "Google Analytics" },
  { href: "/dashboard/analytics/meta-pixel", label: "Meta Pixel" },
  { href: "/dashboard/analytics/google-ads", label: "Google Ads" },
  { href: "/dashboard/analytics/tiktok-pixel", label: "TikTok Pixel" },
  { href: "/dashboard/analytics/gtm", label: "GTM" },
  { href: "/dashboard/analytics/server-side", label: "Server-Side Tracking" },
  { href: "/dashboard/analytics/custom", label: "Custom Tracking" }
];

const trailingLinks: NavItem[] = [{ href: "/dashboard/media", icon: Images, label: "Media" }];

/**
 * Sections only an owner or admin can act on, hidden from members so the sidebar
 * matches what they can actually do.
 *
 * This is presentation, not protection — every page and action behind these
 * links checks the role again and refuses on its own. Storefront links are not
 * listed individually because the whole group is manager-only; see
 * `isManagerOnlyHref`.
 *
 * Team and StoreIM AI are deliberately absent: a member may open the team page
 * read-only, and asking the assistant a question is ordinary work.
 */
const MANAGER_ONLY_HREFS: ReadonlySet<string> = new Set([
  "/dashboard/billing",
  // Sending a campaign spends the store's SMS allowance, so composing one is
  // not something a member should be invited to start.
  "/dashboard/marketing/campaigns",
  "/dashboard/marketing/campaigns/new",
  "/dashboard/marketing/audiences",
  "/dashboard/marketing/templates",
  // The whole Analytics & Tracking section changes what loads on the storefront
  // for every visitor, so it is manager-only in the same way Storefront is.
  "/dashboard/analytics",
  "/dashboard/payments",
  "/dashboard/settings/courier",
  "/dashboard/settings/domains",
  "/dashboard/settings/general",
  "/dashboard/settings/invoice",
  "/dashboard/settings/sms",
  "/dashboard/settings/social",
  "/dashboard/shipping"
]);

function isManagerOnlyHref(href: string) {
  return (
    MANAGER_ONLY_HREFS.has(href) ||
    href.startsWith("/dashboard/analytics") ||
    href.startsWith("/dashboard/storefront") ||
    href.startsWith("/dashboard/theme")
  );
}

const iconColors: Record<string, string> = {
  Billing: "text-violet-600",
  Customers: "text-sky-500",
  Expenses: "text-rose-500",
  Inventory: "text-lime-600",
  Marketing: "text-fuchsia-500",
  Media: "text-teal-500",
  Orders: "text-blue-600",
  Purchases: "text-indigo-500",
  Reports: "text-pink-500",
  Sales: "text-purple-500",
  Settings: "text-cyan-500",
  Storefront: "text-violet-600",
  Suppliers: "text-amber-500",
  Transactions: "text-emerald-500"
};

export function DashboardNav({ onClose, open }: DashboardNavProps) {
  const pathname = usePathname() ?? "";
  const productRouteActive = ["/dashboard/products", "/dashboard/attributes", "/dashboard/tags", "/dashboard/brands", "/dashboard/categories"].some(
    (route) => pathname.startsWith(route)
  );
  const orderRouteActive =
    pathname.startsWith("/dashboard/orders") || pathname.startsWith("/dashboard/fraud-check");
  const reportRouteActive = pathname.startsWith("/dashboard/reports");
  // Coupons and the abandoned-cart page live under this group now, so standing
  // on either has to light it up even though their paths sit elsewhere.
  const marketingRouteActive =
    pathname.startsWith("/dashboard/marketing") ||
    pathname.startsWith("/dashboard/coupons") ||
    pathname.startsWith("/dashboard/abandoned-cart");
  const analyticsRouteActive = pathname.startsWith("/dashboard/analytics");
  const storefrontRouteActive = pathname.startsWith("/dashboard/storefront") || pathname.startsWith("/dashboard/theme");
  const settingsRouteActive = pathname.startsWith("/dashboard/settings") || ["/dashboard/payments", "/dashboard/shipping", "/dashboard/ai"].some(
    (route) => pathname.startsWith(route)
  );
  const [productsOpen, setProductsOpen] = useState(productRouteActive);
  const [ordersOpen, setOrdersOpen] = useState(orderRouteActive);
  const [reportsOpen, setReportsOpen] = useState(reportRouteActive);
  const [marketingOpen, setMarketingOpen] = useState(marketingRouteActive);
  const [analyticsOpen, setAnalyticsOpen] = useState(analyticsRouteActive);
  const [storefrontOpen, setStorefrontOpen] = useState(storefrontRouteActive);
  const [settingsOpen, setSettingsOpen] = useState(settingsRouteActive);
  const [entitledFeatures, setEntitledFeatures] = useState<ReadonlySet<string> | null>(null);
  // Starts `true` so an owner never sees their settings menu flash away on load.
  // The server refuses members regardless of what is drawn here.
  const [canManage, setCanManage] = useState(true);
  const visibleMainLinks = mainLinks.filter((link) => canManage || !isManagerOnlyHref(link.href));
  const visibleMarketingLinks = marketingLinks.filter(
    (link) => canManage || !isManagerOnlyHref(link.href)
  );
  const visibleSettingsLinks = settingsLinks.filter(
    (link) => canManage || !isManagerOnlyHref(link.href)
  );

  useEffect(() => {
    let cancelled = false;

    getEntitledFeaturesAction()
      .then((keys) => {
        if (!cancelled) setEntitledFeatures(new Set(keys));
      })
      .catch(() => {
        if (!cancelled) setEntitledFeatures(new Set());
      });

    getViewerCanManageStoreAction()
      .then((allowed) => {
        if (!cancelled) setCanManage(allowed);
      })
      .catch(() => {
        if (!cancelled) setCanManage(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (productRouteActive) setProductsOpen(true);
  }, [productRouteActive]);

  useEffect(() => {
    if (orderRouteActive) setOrdersOpen(true);
  }, [orderRouteActive]);

  useEffect(() => {
    if (reportRouteActive) setReportsOpen(true);
  }, [reportRouteActive]);

  useEffect(() => {
    if (storefrontRouteActive) setStorefrontOpen(true);
  }, [storefrontRouteActive]);

  useEffect(() => {
    if (settingsRouteActive) setSettingsOpen(true);
  }, [settingsRouteActive]);

  return (
    <EntitledFeaturesContext.Provider value={entitledFeatures}>
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-[#ececf7] bg-white transition-transform duration-200 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
    >
      <div className="flex h-16 items-center justify-between border-b border-[#f0f0f7] px-5">
        <Link className="flex items-center gap-2" href="/dashboard" onClick={onClose}>
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#6941ff] text-[15px] font-bold leading-none text-white" suppressHydrationWarning>{"S"}</span>
          <span className="text-[15px] font-semibold tracking-tight text-[#111827]" suppressHydrationWarning>{"Store"}<span className="text-[#6941ff]">{"IM"}</span></span>
        </Link>
        <button className="text-gray-500 lg:hidden" onClick={onClose} type="button">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 text-[13px]" aria-label="Dashboard navigation">
        <NavLink href="/dashboard" icon={LayoutDashboard} label="Dashboard" onClick={onClose} pathname={pathname} />

        <div className={`mt-1 flex items-center rounded-lg pr-1 font-medium transition ${productRouteActive ? "bg-[#f3f0ff] text-[#5b31db]" : "text-[#30313d] hover:bg-[#f7f7fb]"}`}>
          <Link className="flex flex-1 items-center gap-3 px-3 py-2.5" href="/dashboard/products" onClick={onClose}>
            <Package className="h-4 w-4 text-orange-500" />
            <SafeNavText text="Products" />
          </Link>
          <button aria-label="Toggle products menu" className="p-2" onClick={() => setProductsOpen((current) => !current)} type="button">
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${productsOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
        {productsOpen ? (
          <div className="ml-5 border-l border-[#ebe9f6] py-1 pl-3">
            {productLinks.map((link) => (
              <Link
                aria-current={isProductLinkActive(pathname, link.href) ? "page" : undefined}
                className={`block rounded-md px-3 py-2 text-[12px] transition ${isProductLinkActive(pathname, link.href) ? "bg-[#f3f0ff] font-medium text-[#6d3cf5]" : "text-[#4d4f5c] hover:bg-[#f8f7ff]"}`}
                href={link.href}
                key={link.href}
                onClick={onClose}
              >
                <SafeNavText text={link.label} />
                <NavFeatureBadge href={link.href} />
              </Link>
            ))}
          </div>
        ) : null}

        <div className={`mt-1 flex items-center rounded-lg pr-1 font-medium transition ${orderRouteActive ? "bg-[#f3f0ff] text-[#5b31db]" : "text-[#30313d] hover:bg-[#f7f7fb]"}`}>
          <Link className="flex flex-1 items-center gap-3 px-3 py-2.5" href="/dashboard/orders" onClick={onClose}>
            <ReceiptText className="h-4 w-4 text-blue-600" />
            <SafeNavText text="Orders" />
          </Link>
          <button aria-label="Toggle orders menu" className="p-2" onClick={() => setOrdersOpen((current) => !current)} type="button">
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${ordersOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
        {ordersOpen ? (
          <div className="ml-5 border-l border-[#ebe9f6] py-1 pl-3">
            {orderLinks.map((link) => (
              <Link
                aria-current={isOrderLinkActive(pathname, link.href) ? "page" : undefined}
                className={`block rounded-md px-3 py-2 text-[12px] transition ${isOrderLinkActive(pathname, link.href) ? "bg-[#f3f0ff] font-medium text-[#6d3cf5]" : "text-[#4d4f5c] hover:bg-[#f8f7ff]"}`}
                href={link.href}
                key={link.href}
                onClick={onClose}
              >
                <SafeNavText text={link.label} />
                <NavFeatureBadge href={link.href} />
              </Link>
            ))}
          </div>
        ) : null}

        <div className="mt-1 space-y-1">
          {visibleMainLinks.map((link) => (
            <NavLink
              href={link.href}
              icon={link.icon}
              {...(iconColors[normalizeLabel(link.label)] ? { iconClassName: iconColors[normalizeLabel(link.label)] } : {})}
              key={link.href}
              label={link.label}
              onClick={onClose}
              pathname={pathname}
            />
          ))}
        </div>

        <div className={`mt-1 flex items-center rounded-lg pr-1 font-medium transition ${reportRouteActive ? "bg-[#f3f0ff] text-[#5b31db]" : "text-[#30313d] hover:bg-[#f7f7fb]"}`}>
          <Link className="flex flex-1 items-center gap-3 px-3 py-2.5" href="/dashboard/reports" onClick={onClose}>
            <FileText className="h-4 w-4 text-pink-500" />
            <SafeNavText text="Reports" />
          </Link>
          <button aria-label="Toggle reports menu" className="p-2" onClick={() => setReportsOpen((current) => !current)} type="button">
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${reportsOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
        {reportsOpen ? (
          <div className="ml-5 border-l border-[#ebe9f6] py-1 pl-3">
            {reportLinks.map((link) => (
              <Link
                aria-current={isReportLinkActive(pathname, link.href) ? "page" : undefined}
                className={`block rounded-md px-3 py-2 text-[12px] transition ${isReportLinkActive(pathname, link.href) ? "bg-[#f3f0ff] font-medium text-[#6d3cf5]" : "text-[#4d4f5c] hover:bg-[#f8f7ff]"}`}
                href={link.href}
                key={link.href}
                onClick={onClose}
              >
                <SafeNavText text={link.label} />
                <NavFeatureBadge href={link.href} />
              </Link>
            ))}
          </div>
        ) : null}

        <div className={`mt-1 flex items-center rounded-lg pr-1 font-medium transition ${marketingRouteActive ? "bg-[#f3f0ff] text-[#5b31db]" : "text-[#30313d] hover:bg-[#f7f7fb]"}`}>
          <Link className="flex flex-1 items-center gap-3 px-3 py-2.5" href="/dashboard/marketing" onClick={onClose}>
            <Megaphone className="h-4 w-4 text-fuchsia-500" />
            <SafeNavText text="Marketing" />
          </Link>
          <button aria-label="Toggle marketing menu" className="p-2" onClick={() => setMarketingOpen((current) => !current)} type="button">
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${marketingOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
        {marketingOpen ? (
          <div className="ml-5 border-l border-[#ebe9f6] py-1 pl-3">
            {visibleMarketingLinks.map((link) => (
              <Link
                aria-current={isMarketingLinkActive(pathname, link.href) ? "page" : undefined}
                className={`block rounded-md px-3 py-2 text-[12px] transition ${isMarketingLinkActive(pathname, link.href) ? "bg-[#f3f0ff] font-medium text-[#6d3cf5]" : "text-[#4d4f5c] hover:bg-[#f8f7ff]"}`}
                href={link.href}
                key={link.href}
                onClick={onClose}
              >
                <SafeNavText text={link.label} />
                <NavFeatureBadge href={link.href} />
              </Link>
            ))}
          </div>
        ) : null}

        {/* Every page here changes what loads on the storefront for visitors, so
            members do not get the group at all rather than a list of dead ends. */}
        {canManage ? (
        <div className={`mt-1 flex items-center rounded-lg pr-1 font-medium transition ${analyticsRouteActive ? "bg-[#f3f0ff] text-[#5b31db]" : "text-[#30313d] hover:bg-[#f7f7fb]"}`}>
          <Link className="flex flex-1 items-center gap-3 px-3 py-2.5" href="/dashboard/analytics" onClick={onClose}>
            <Radar className="h-4 w-4 text-sky-500" />
            <SafeNavText text="Analytics & Tracking" />
          </Link>
          <button aria-label="Toggle analytics menu" className="p-2" onClick={() => setAnalyticsOpen((current) => !current)} type="button">
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${analyticsOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
        ) : null}
        {canManage && analyticsOpen ? (
          <div className="ml-5 border-l border-[#ebe9f6] py-1 pl-3">
            {analyticsLinks.map((link) => (
              <Link
                aria-current={isAnalyticsLinkActive(pathname, link.href) ? "page" : undefined}
                className={`block rounded-md px-3 py-2 text-[12px] transition ${isAnalyticsLinkActive(pathname, link.href) ? "bg-[#f3f0ff] font-medium text-[#6d3cf5]" : "text-[#4d4f5c] hover:bg-[#f8f7ff]"}`}
                href={link.href}
                key={link.href}
                onClick={onClose}
              >
                <SafeNavText text={link.label} />
                <NavFeatureBadge href={link.href} />
              </Link>
            ))}
          </div>
        ) : null}

        {/* The whole group edits the customer-facing storefront, so members do
            not get it at all rather than an expandable section of dead ends. */}
        {canManage ? (
        <div className={`mt-1 flex items-center rounded-lg pr-1 font-medium transition ${storefrontRouteActive ? "bg-[#f3f0ff] text-[#5b31db]" : "text-[#30313d] hover:bg-[#f7f7fb]"}`}>
          <Link className="flex flex-1 items-center gap-3 px-3 py-2.5" href="/dashboard/storefront/themes" onClick={onClose}>
            <Store className="h-4 w-4 text-violet-600" />
            <SafeNavText text="Storefront" />
          </Link>
          <button aria-label="Toggle storefront menu" className="p-2" onClick={() => setStorefrontOpen((current) => !current)} type="button">
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${storefrontOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
        ) : null}
        {canManage && storefrontOpen ? (
          <div className="ml-5 border-l border-[#ebe9f6] py-1 pl-3">
            {storefrontLinks.map((link) => (
              <Link
                aria-current={isStorefrontLinkActive(pathname, link.href, link.label) ? "page" : undefined}
                className={`block rounded-md px-3 py-2 text-[12px] transition ${isStorefrontLinkActive(pathname, link.href, link.label) ? "bg-[#f3f0ff] font-medium text-[#6d3cf5]" : "text-[#4d4f5c] hover:bg-[#f8f7ff]"}`}
                href={link.href}
                key={`${link.href}-${link.label}`}
                onClick={onClose}
              >
                <SafeNavText text={link.label} />
                <NavFeatureBadge href={link.href} />
              </Link>
            ))}
          </div>
        ) : null}

        <div className="mt-1 space-y-1">
          {trailingLinks.map((link) => (
            <NavLink
              href={link.href}
              icon={link.icon}
              {...(iconColors[normalizeLabel(link.label)] ? { iconClassName: iconColors[normalizeLabel(link.label)] } : {})}
              key={link.href}
              label={link.label}
              onClick={onClose}
              pathname={pathname}
            />
          ))}
        </div>

        <div className={`mt-1 flex items-center rounded-lg pr-1 font-medium transition ${settingsRouteActive ? "bg-[#f3f0ff] text-[#5b31db]" : "text-[#30313d] hover:bg-[#f7f7fb]"}`}>
          <Link className="flex flex-1 items-center gap-3 px-3 py-2.5" href="/dashboard/settings" onClick={onClose}>
            <Settings className="h-4 w-4 text-cyan-500" />
            <SafeNavText text="Settings" />
          </Link>
          <button aria-label="Toggle settings menu" className="p-2" onClick={() => setSettingsOpen((current) => !current)} type="button">
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${settingsOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
        {settingsOpen ? (
          <div className="ml-5 border-l border-[#ebe9f6] py-1 pl-3">
            {visibleSettingsLinks.map((link) => (
              <Link
                aria-current={isSettingsLinkActive(pathname, link.href) ? "page" : undefined}
                className={`block rounded-md px-3 py-2 text-[12px] transition ${isSettingsLinkActive(pathname, link.href) ? "bg-[#f3f0ff] font-medium text-[#6d3cf5]" : "text-[#4d4f5c] hover:bg-[#f8f7ff]"}`}
                href={link.href}
                key={link.href}
                onClick={onClose}
              >
                <SafeNavText text={link.label} />
                <NavFeatureBadge href={link.href} />
              </Link>
            ))}
          </div>
        ) : null}
      </nav>

      <div className="border-t border-[#f0f0f7] p-3">
        <Link
          className="mb-2 flex items-center justify-center gap-2 rounded-lg bg-[#f3f0ff] px-3 py-2 text-xs font-semibold text-[#6d3cf5]"
          href="/dashboard/open-storefront"
          onClick={onClose}
          target="_blank"
        >
          <BarChart3 className="h-3.5 w-3.5" /> <SafeNavText text="Open Storefront" />
        </Link>
        <LogoutButton />
      </div>
    </aside>
    </EntitledFeaturesContext.Provider>
  );
}

function isProductLinkActive(pathname: string, href: string) {
  if (href === "/dashboard/products" || href === "/dashboard/products/new") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function isAnalyticsLinkActive(pathname: string, href: string) {
  // Overview owns only its own path; every other page sits beneath it and would
  // otherwise light Overview up as well as itself.
  return href === "/dashboard/analytics" ? pathname === href : matchesRoute(pathname, href);
}

function isMarketingLinkActive(pathname: string, href: string) {
  // Overview owns only its own path. Without this, every page in the group
  // would light up "Overview" as well as itself, since they all sit under it.
  if (href === "/dashboard/marketing" || href === "/dashboard/marketing/campaigns/new") {
    return pathname === href;
  }

  // "Campaigns" covers the detail and edit pages beneath it, but must not claim
  // /campaigns/new — that is its sibling, listed separately above.
  if (href === "/dashboard/marketing/campaigns") {
    return matchesRoute(pathname, href) && pathname !== "/dashboard/marketing/campaigns/new";
  }

  return matchesRoute(pathname, href);
}

function isReportLinkActive(pathname: string, href: string) {
  return href === "/dashboard/reports" ? pathname === href : pathname.startsWith(href);
}

function isOrderLinkActive(pathname: string, href: string) {
  // All Orders owns only its own path; every other page in this group sits
  // beneath it and would otherwise light it up as well as itself.
  //
  // Written this way round rather than as a list of the sub-routes. The list
  // version treated anything it did not recognise as All Orders, so each link
  // added to the group afterwards lit up on /dashboard/orders until someone
  // remembered to extend it — which is how Incomplete Orders arrived broken.
  if (href === "/dashboard/orders") {
    return pathname === href;
  }

  // These two also answer to the paths they used to live at.
  if (href === "/dashboard/orders/fake") {
    return matchesRoute(pathname, href) || matchesRoute(pathname, "/dashboard/orders/fake-orders");
  }

  if (href === "/dashboard/orders/verification") {
    return matchesRoute(pathname, href) || matchesRoute(pathname, "/dashboard/orders/verification-queue");
  }

  // Everything else, /dashboard/fraud-check included — it is listed in this
  // group even though it does not sit under /dashboard/orders.
  return matchesRoute(pathname, href);
}

function isStorefrontLinkActive(pathname: string, href: string, label: string) {
  const hrefPath = href.split("#")[0] ?? href;

  if (label === "Themes" && hrefPath === "/dashboard/storefront/themes") {
    return pathname === hrefPath || pathname === "/dashboard/theme";
  }

  return pathname === hrefPath && !href.includes("#");
}

function matchesRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isSettingsLinkActive(pathname: string, href: string) {
  if (href === "/dashboard/settings/general") {
    return pathname === "/dashboard/settings" || pathname.startsWith(href);
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ href, icon: Icon, iconClassName, label, onClick, pathname }: NavItem & { iconClassName?: string; onClick: () => void; pathname: string }) {
  const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  const navLabel = normalizeLabel(label);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition ${active ? "bg-[#f3f0ff] text-[#5b31db]" : "text-[#30313d] hover:bg-[#f7f7fb]"}`}
      href={href}
      onClick={onClick}
    >
      <Icon className={`h-4 w-4 ${iconClassName ?? "text-[#7548f5]"}`} />
      <span suppressHydrationWarning>{navLabel}</span>
      <NavFeatureBadge href={href} />
    </Link>
  );
}

function SafeNavText({ text }: { text: string }) {
  return <span suppressHydrationWarning>{normalizeLabel(text)}</span>;
}

function normalizeLabel(label: string) {
  return label.trim();
}
