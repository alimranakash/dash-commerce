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
  Package,
  Percent,
  Receipt,
  ReceiptText,
  ShoppingBag,
  Settings,
  ShoppingCart,
  Store,
  Truck,
  WalletCards,
  Users,
  X
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import { LogoutButton } from "../../modules/auth/logout-button";

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

const productLinks = [
  { href: "/dashboard/products", label: "All Products" },
  { href: "/dashboard/products/new", label: "Add Product" },
  { href: "/dashboard/attributes", label: "Attributes" },
  { href: "/dashboard/categories", label: "Categories" },
  { href: "/dashboard/tags", label: "Tags" },
  { href: "/dashboard/brands", label: "Brands" },
  { href: "/dashboard/products/reviews", label: "Reviews" }
];

const orderLinks = [
  { href: "/dashboard/orders", label: "All Orders" },
  { href: "/dashboard/orders/fake", label: "Fake Orders" },
  { href: "/dashboard/orders/verification", label: "Verification Queue" }
];

const reportLinks = [
  { href: "/dashboard/reports", label: "Overview" },
  { href: "/dashboard/reports/orders", label: "Orders" },
  { href: "/dashboard/reports/revenues", label: "Revenues" },
  { href: "/dashboard/reports/products", label: "Products" },
  { href: "/dashboard/reports/customers", label: "Customers" },
  { href: "/dashboard/reports/abandoned-carts", label: "Abandoned Carts" }
];

const settingsLinks = [
  { href: "/dashboard/settings/general", label: "General" },
  { href: "/dashboard/settings/domains", label: "Domains" },
  { href: "/dashboard/settings/marketing", label: "Marketing" },
  { href: "/dashboard/settings/courier", label: "Courier" },
  { href: "/dashboard/settings/invoice", label: "Invoice" },
  { href: "/dashboard/settings/social", label: "Social" },
  { href: "/dashboard/payments", label: "Payments" },
  { href: "/dashboard/shipping", label: "Shipping" },
  { href: "/dashboard/ai", label: "StoreOS / AI" }
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
  { href: "/dashboard/coupons", icon: Percent, label: "Coupons" },
  { href: "/dashboard/billing", icon: WalletCards, label: "Billing" }
];

const trailingLinks: NavItem[] = [
  { href: "/dashboard/media", icon: Images, label: "Media" },
  { href: "/dashboard/abandoned-cart", icon: ShoppingCart, label: "Abandoned cart" }
];

const iconColors: Record<string, string> = {
  "Abandoned cart": "text-fuchsia-500",
  Billing: "text-violet-600",
  Coupons: "text-violet-600",
  Customers: "text-sky-500",
  Expenses: "text-rose-500",
  Inventory: "text-lime-600",
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

export function DashboardNav({ onClose, open, storeSlug }: DashboardNavProps) {
  const pathname = usePathname() ?? "";
  const productRouteActive = ["/dashboard/products", "/dashboard/attributes", "/dashboard/tags", "/dashboard/brands", "/dashboard/categories"].some(
    (route) => pathname.startsWith(route)
  );
  const orderRouteActive = pathname.startsWith("/dashboard/orders");
  const reportRouteActive = pathname.startsWith("/dashboard/reports");
  const storefrontRouteActive = pathname.startsWith("/dashboard/storefront") || pathname.startsWith("/dashboard/theme");
  const settingsRouteActive = pathname.startsWith("/dashboard/settings") || ["/dashboard/payments", "/dashboard/shipping", "/dashboard/ai"].some(
    (route) => pathname.startsWith(route)
  );
  const [productsOpen, setProductsOpen] = useState(productRouteActive);
  const [ordersOpen, setOrdersOpen] = useState(orderRouteActive);
  const [reportsOpen, setReportsOpen] = useState(reportRouteActive);
  const [storefrontOpen, setStorefrontOpen] = useState(storefrontRouteActive);
  const [settingsOpen, setSettingsOpen] = useState(settingsRouteActive);

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
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-[#ececf7] bg-white transition-transform duration-200 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
    >
      <div className="flex h-16 items-center justify-between border-b border-[#f0f0f7] px-5">
        <Link className="flex items-center gap-2" href="/dashboard" onClick={onClose}>
          <span className="bg-[#6941ff] px-2.5 py-1 text-[13px] font-semibold tracking-[0.28em] text-white" suppressHydrationWarning>{"DASH"}</span>
          <span className="text-[10px] font-semibold tracking-wide text-[#111827]" suppressHydrationWarning>{"COMMERCE"}</span>
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
              </Link>
            ))}
          </div>
        ) : null}

        <div className="mt-1 space-y-1">
          {mainLinks.map((link) => (
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
              </Link>
            ))}
          </div>
        ) : null}

        <div className={`mt-1 flex items-center rounded-lg pr-1 font-medium transition ${storefrontRouteActive ? "bg-[#f3f0ff] text-[#5b31db]" : "text-[#30313d] hover:bg-[#f7f7fb]"}`}>
          <Link className="flex flex-1 items-center gap-3 px-3 py-2.5" href="/dashboard/storefront/themes" onClick={onClose}>
            <Store className="h-4 w-4 text-violet-600" />
            <SafeNavText text="Storefront" />
          </Link>
          <button aria-label="Toggle storefront menu" className="p-2" onClick={() => setStorefrontOpen((current) => !current)} type="button">
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${storefrontOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
        {storefrontOpen ? (
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
            {settingsLinks.map((link) => (
              <Link
                aria-current={isSettingsLinkActive(pathname, link.href) ? "page" : undefined}
                className={`block rounded-md px-3 py-2 text-[12px] transition ${isSettingsLinkActive(pathname, link.href) ? "bg-[#f3f0ff] font-medium text-[#6d3cf5]" : "text-[#4d4f5c] hover:bg-[#f8f7ff]"}`}
                href={link.href}
                key={link.href}
                onClick={onClose}
              >
                <SafeNavText text={link.label} />
              </Link>
            ))}
          </div>
        ) : null}
      </nav>

      <div className="border-t border-[#f0f0f7] p-3">
        <Link
          className="mb-2 flex items-center justify-center gap-2 rounded-lg bg-[#f3f0ff] px-3 py-2 text-xs font-semibold text-[#6d3cf5]"
          href={`/s/${storeSlug}`}
          onClick={onClose}
          target="_blank"
        >
          <BarChart3 className="h-3.5 w-3.5" /> <SafeNavText text="Open Storefront" />
        </Link>
        <LogoutButton />
      </div>
    </aside>
  );
}

function isProductLinkActive(pathname: string, href: string) {
  if (href === "/dashboard/products" || href === "/dashboard/products/new") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function isReportLinkActive(pathname: string, href: string) {
  return href === "/dashboard/reports" ? pathname === href : pathname.startsWith(href);
}

function isOrderLinkActive(pathname: string, href: string) {
  if (href === "/dashboard/orders/fake") {
    return matchesRoute(pathname, href) || matchesRoute(pathname, "/dashboard/orders/fake-orders");
  }

  if (href === "/dashboard/orders/verification") {
    return matchesRoute(pathname, href) || matchesRoute(pathname, "/dashboard/orders/verification-queue");
  }

  return pathname === "/dashboard/orders";
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
    </Link>
  );
}

function SafeNavText({ text }: { text: string }) {
  return <span suppressHydrationWarning>{normalizeLabel(text)}</span>;
}

function normalizeLabel(label: string) {
  return label.trim();
}
