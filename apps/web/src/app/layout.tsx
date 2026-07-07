import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const storefrontFont = DM_Sans({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-storefront"
});

export const metadata: Metadata = {
  title: "Dash Commerce OS",
  description: "The multi-tenant commerce operating system."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={storefrontFont.variable} suppressHydrationWarning>{children}</body>
    </html>
  );
}
