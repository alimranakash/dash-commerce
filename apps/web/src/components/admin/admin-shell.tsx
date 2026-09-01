"use client";

import {
  CreditCard,
  FileClock,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  PackageOpen,
  ScrollText,
  Shield,
  Store,
  UserRound,
  Users,
  X
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState, type ComponentType, type ReactNode } from "react";

type AdminShellProps = {
  admin: {
    image?: string | null;
    name?: string | null;
  };
  children: ReactNode;
};

type AdminNavItem = {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
};

const adminLinks: AdminNavItem[] = [
  { href: "/admin", icon: LayoutDashboard, label: "Overview" },
  { href: "/admin/users", icon: Users, label: "Users" },
  { href: "/admin/stores", icon: Store, label: "Stores" },
  { href: "/admin/plans", icon: PackageOpen, label: "Plans" },
  { href: "/admin/subscriptions", icon: FileClock, label: "Subscriptions" },
  { href: "/admin/payments", icon: CreditCard, label: "Payments" },
  { href: "/admin/support", icon: HelpCircle, label: "Support" },
  { href: "/admin/messaging", icon: MessageSquare, label: "Messaging" },
  { href: "/admin/logs", icon: ScrollText, label: "Logs" }
];

export function AdminShell({ admin, children }: AdminShellProps) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[#f5f6ff] text-[#20212a]">
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[260px] max-w-[85vw] flex-col border-r border-[#ececf7] bg-white transition-transform duration-200 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 items-center justify-between border-b border-[#f0f0f7] px-5">
          <Link className="flex items-center gap-2" href="/admin" onClick={() => setOpen(false)}>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#7c3aed] text-white"><Shield className="h-4 w-4" /></span>
            <span>
              <b className="block text-sm leading-none text-[#20212a]">StoreIM Admin</b>
              <small className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7b7c88]">Console</small>
            </span>
          </Link>
          <button aria-label="Close admin navigation" className="-mr-1 grid h-9 w-9 place-items-center rounded-lg text-gray-500 hover:bg-[#f7f7fb] lg:hidden" onClick={() => setOpen(false)} type="button">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 text-[13px]" aria-label="Admin navigation">
          {adminLinks.map((link) => {
            const active = link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
            const Icon = link.icon;

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition ${active ? "bg-[#f3f0ff] text-[#5b31db]" : "text-[#30313d] hover:bg-[#f7f7fb] hover:text-[#5b31db]"}`}
                href={link.href}
                key={link.href}
                onClick={() => setOpen(false)}
              >
                <Icon className="h-4 w-4 text-[#7548f5]" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {open ? <button aria-label="Close admin navigation" className="fixed inset-0 z-40 bg-black/20 lg:hidden" onClick={() => setOpen(false)} type="button" /> : null}

      <div className="min-h-screen lg:pl-[260px]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-[#ececf7] bg-white px-4 sm:px-6 lg:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button aria-label="Open admin navigation" className="-ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-gray-600 hover:bg-[#f7f7fb] lg:hidden" onClick={() => setOpen(true)} type="button">
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="m-0 truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7c3aed]">Admin Console</p>
              <h1 className="m-0 truncate text-sm font-semibold text-[#20212a] sm:text-base">Platform Control Center</h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 text-xs sm:gap-3">
            <Link className="hidden rounded-lg border border-[#ddd6fe] px-3 py-2 font-semibold text-[#6d3cf5] hover:bg-[#f7f3ff] sm:inline-flex" href="/dashboard">
              Back to Dashboard
            </Link>
            <div className="hidden items-center gap-2 rounded-full border border-[#ececf5] bg-[#fbfaff] py-1 pl-1 pr-3 sm:flex">
              <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-[#f3f0ff] text-[#6d3cf5]">
                {admin.image ? (
                  <img alt={admin.name ?? "Admin"} className="h-full w-full object-cover" src={admin.image} />
                ) : (
                  <UserRound className="h-4 w-4" />
                )}
              </span>
              <span className="font-semibold text-[#30313d]">{admin.name ?? "Admin"}</span>
            </div>
            <button className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#7c3aed] px-3 text-xs font-semibold text-white hover:bg-[#6d28d9]" onClick={() => signOut({ callbackUrl: "/login" })} type="button">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </header>

        <section className="min-w-0 px-4 py-5 sm:px-6 lg:px-7 lg:py-6">{children}</section>
      </div>
    </main>
  );
}
