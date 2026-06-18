"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "../../modules/auth/logout-button";

type DashboardNavProps = {
  storeSlug: string;
};

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/products", label: "Products" },
  { href: "/dashboard/categories", label: "Categories" },
  { href: "/dashboard/settings", label: "Settings" }
];

export function DashboardNav({ storeSlug }: DashboardNavProps) {
  const pathname = usePathname();

  return (
    <aside className="seller-sidebar">
      <Link className="seller-brand" href="/dashboard">
        Dash OS
      </Link>
      <nav className="seller-nav" aria-label="Dashboard navigation">
        {links.map((link) => (
          <Link
            aria-current={pathname === link.href ? "page" : undefined}
            className={pathname === link.href ? "active" : undefined}
            href={link.href}
            key={link.href}
          >
            {link.label}
          </Link>
        ))}
        <Link href={`/s/${storeSlug}`} target="_blank">
          Storefront
        </Link>
      </nav>
      <LogoutButton />
    </aside>
  );
}
