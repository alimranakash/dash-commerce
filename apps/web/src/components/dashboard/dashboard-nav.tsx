"use client";

import {
  BarChart3,
  ChevronDown,
  CircleDollarSign,
  FileText,
  LayoutDashboard,
  Package,
  Percent,
  ReceiptText,
  Settings,
  ShoppingCart,
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

const reportLinks = [
  { href: "/dashboard/reports", label: "Overview" },
  { href: "/dashboard/reports/orders", label: "Orders" },
  { href: "/dashboard/reports/revenues", label: "Revenues" },
  { href: "/dashboard/reports/products", label: "Products" },
  { href: "/dashboard/reports/customers", label: "Customers" }
];

const mainLinks: NavItem[] = [
  { href: "/dashboard/orders", icon: ReceiptText, label: "Orders" },
  { href: "/dashboard/transactions", icon: CircleDollarSign, label: "Transactions" },
  { href: "/dashboard/customers", icon: Users, label: "Customers" },
  { href: "/dashboard/coupons", icon: Percent, label: "Coupons" }
];

const trailingLinks: NavItem[] = [
  { href: "/dashboard/abandoned-cart", icon: ShoppingCart, label: "Abandoned cart" },
  { href: "/dashboard/settings", icon: Settings, label: "Settings" }
];

const iconColors: Record<string, string> = {
  "Abandoned cart": "text-fuchsia-500",
  Coupons: "text-violet-600",
  Customers: "text-sky-500",
  Orders: "text-blue-600",
  Reports: "text-pink-500",
  Settings: "text-cyan-500",
  Transactions: "text-emerald-500"
};

export function DashboardNav({ onClose, open, storeSlug }: DashboardNavProps) {
  const pathname = usePathname();
  const productRouteActive = ["/dashboard/products", "/dashboard/attributes", "/dashboard/tags", "/dashboard/brands", "/dashboard/categories"].some(
    (route) => pathname.startsWith(route)
  );
  const reportRouteActive = pathname.startsWith("/dashboard/reports");
  const [productsOpen, setProductsOpen] = useState(productRouteActive);
  const [reportsOpen, setReportsOpen] = useState(reportRouteActive);

  useEffect(() => {
    if (productRouteActive) setProductsOpen(true);
  }, [productRouteActive]);

  useEffect(() => {
    if (reportRouteActive) setReportsOpen(true);
  }, [reportRouteActive]);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-[#ececf7] bg-white transition-transform duration-200 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
    >
      <div className="flex h-16 items-center justify-between border-b border-[#f0f0f7] px-5">
        <Link className="flex items-center gap-2" href="/dashboard" onClick={onClose}>
          <span className="bg-[#6941ff] px-2.5 py-1 text-[13px] font-semibold tracking-[0.28em] text-white">DASH</span>
          <span className="text-[10px] font-semibold tracking-wide text-[#111827]">COMMERCE</span>
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
            <span>Products</span>
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
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}

        <div className="mt-1 space-y-1">
          {mainLinks.map((link) => (
            <NavLink
              href={link.href}
              icon={link.icon}
              {...(iconColors[link.label] ? { iconClassName: iconColors[link.label] } : {})}
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
            <span>Reports</span>
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
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}

        <div className="mt-1 space-y-1">
          {trailingLinks.map((link) => (
            <NavLink
              href={link.href}
              icon={link.icon}
              {...(iconColors[link.label] ? { iconClassName: iconColors[link.label] } : {})}
              key={link.href}
              label={link.label}
              onClick={onClose}
              pathname={pathname}
            />
          ))}
        </div>
      </nav>

      <div className="border-t border-[#f0f0f7] p-3">
        <Link
          className="mb-2 flex items-center justify-center gap-2 rounded-lg bg-[#f3f0ff] px-3 py-2 text-xs font-semibold text-[#6d3cf5]"
          href={`/s/${storeSlug}`}
          onClick={onClose}
          target="_blank"
        >
          <BarChart3 className="h-3.5 w-3.5" /> Open Storefront
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

function NavLink({ href, icon: Icon, iconClassName, label, onClick, pathname }: NavItem & { iconClassName?: string; onClick: () => void; pathname: string }) {
  const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition ${active ? "bg-[#f3f0ff] text-[#5b31db]" : "text-[#30313d] hover:bg-[#f7f7fb]"}`}
      href={href}
      onClick={onClick}
    >
      <Icon className={`h-4 w-4 ${iconClassName ?? "text-[#7548f5]"}`} />
      <span>{label}</span>
    </Link>
  );
}
