import { permanentRedirect } from "next/navigation";

/**
 * These settings moved out of Settings and into their own Analytics & Tracking
 * section, split one page per platform.
 *
 * Kept as a redirect rather than deleted: this path has been the marketing
 * settings page for the life of the product, so it is in bookmarks and in
 * whatever documentation sellers wrote for themselves.
 */
export default function MarketingSettingsRedirectPage() {
  permanentRedirect("/dashboard/analytics");
}
