import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type DashboardButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "secondary" | "ghost";
};

const variants = {
  ghost: "border-transparent bg-transparent text-[#6d3cf5] hover:bg-[#f3f0ff]",
  primary: "border-[#7c3aed] bg-[#7c3aed] text-white shadow-sm hover:bg-[#6d28d9]",
  secondary: "border-[#7c3aed] bg-white text-[#6d3cf5] hover:bg-[#f7f5ff]"
};

export function DashboardButton({ children, className = "", href, variant = "primary", ...props }: DashboardButtonProps) {
  const styles = `inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border px-3.5 text-xs font-semibold transition ${variants[variant]} ${className}`;

  if (href) return <Link className={styles} href={href}>{children}</Link>;

  return <button className={styles} {...props}>{children}</button>;
}
