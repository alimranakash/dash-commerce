"use client";

import { Bot, ChevronRight, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserAvatarMenu } from "./user-avatar-menu";

type DashboardTopbarProps = {
  onMenuClick: () => void;
};

const labels: Record<string, string> = {
  ai: "AI Assistant",
  categories: "Categories",
  expenses: "Expenses",
  fake: "Fake Orders",
  inventory: "Inventory",
  media: "Media",
  new: "Add Product",
  orders: "Orders",
  payments: "Payments",
  profile: "Profile",
  products: "Products",
  purchases: "Purchases",
  returns: "Returns",
  sales: "Sales",
  settings: "Settings",
  shipping: "Shipping",
  storefront: "Storefront",
  suppliers: "Suppliers",
  theme: "Theme",
  themes: "Themes",
  verification: "Verification Queue"
};

export function DashboardTopbar({ onMenuClick }: DashboardTopbarProps) {
  const pathname = usePathname() ?? "";
  const segments = pathname.split("/").filter(Boolean).slice(1);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#ececf7] bg-white px-4 sm:px-6 lg:px-7">
      <div className="flex min-w-0 items-center gap-3">
        <button className="text-gray-600 lg:hidden" onClick={onMenuClick} type="button">
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-[#7b7c88]">
          <Link className="font-medium text-[#383946]" href="/dashboard">Dashboard</Link>
          {segments.map((segment, index) => (
            <span className="flex min-w-0 items-center gap-1.5" key={`${segment}-${index}`}>
              <ChevronRight className="h-3 w-3 shrink-0 text-[#8b5cf6]" />
              <span className="truncate text-[#6d3cf5]">{labels[segment] ?? titleCase(segment)}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 text-[11px]">
        <Link className="hidden text-[#6d3cf5] hover:underline md:block" href="/dashboard/settings">Addons</Link>
        <Link className="hidden text-[#30313d] hover:text-[#6d3cf5] lg:block" href="/dashboard/settings">Contact Support</Link>
        <Link className="hidden text-[#30313d] hover:text-[#6d3cf5] xl:block" href="/dashboard/settings">Share Feedback</Link>
        <Link className="flex items-center gap-1.5 rounded-lg bg-[#7c3aed] px-3 py-2 font-semibold text-white shadow-sm hover:bg-[#6d28d9]" href="/dashboard/ai">
          <Bot className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">AI Assistant</span>
        </Link>
        <UserAvatarMenu />
      </div>
    </header>
  );
}

function titleCase(value: string) {
  return value.replace(/-/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
