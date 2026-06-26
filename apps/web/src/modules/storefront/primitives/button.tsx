import Link from "next/link";
import type { ReactNode } from "react";

type StorefrontButtonProps = {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "secondary";
};

export function StorefrontButton({ children, href, variant = "primary" }: StorefrontButtonProps) {
  const className = `sf-foundation-button sf-foundation-button-${variant}`;

  if (href) {
    return (
      <Link className={className} href={href}>
        {children}
      </Link>
    );
  }

  return <button className={className} type="button">{children}</button>;
}
