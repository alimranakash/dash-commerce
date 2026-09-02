import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { ThemeModeScript } from "../modules/theme-mode/components/theme-mode-script";
import "./globals.css";

const storefrontFont = DM_Sans({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-storefront"
});

export const metadata: Metadata = {
  title: "StoreIM — The Operating System for Commerce",
  description: "The multi-tenant commerce operating system."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={storefrontFont.variable} suppressHydrationWarning>
        {/* First thing in the document, before any surface paints: it stamps the
          stored theme on <html> so a reader who chose dark never sees the light
          page flash while React catches up. */}
        <ThemeModeScript />
        {children}
      </body>
    </html>
  );
}
