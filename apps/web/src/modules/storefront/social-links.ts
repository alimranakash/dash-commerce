import type { SocialProfileLinksInput } from "../settings/settings.schema";

export type StorefrontSocialLink = {
  href: string;
  label: string;
  shortLabel: string;
};

type SocialLinkSources = {
  facebookUrl?: string | null | undefined;
  instagramUrl?: string | null | undefined;
  whatsappNumber?: string | null | undefined;
};

// Every footer used to hardcode placeholder anchors (`#youtube`, `#tiktok`) next
// to the two real links. One resolver instead, so a network only appears once
// the seller has actually saved a URL for it.
export function resolveStorefrontSocialLinks(
  settings: SocialLinkSources | null | undefined,
  profiles?: SocialProfileLinksInput | null | undefined
): StorefrontSocialLink[] {
  const whatsappDigits = settings?.whatsappNumber?.replace(/\D/g, "");

  return [
    link(settings?.facebookUrl, "Facebook", "f"),
    link(settings?.instagramUrl, "Instagram", "ig"),
    link(profiles?.youtubeUrl, "YouTube", "yt"),
    link(profiles?.tiktokUrl, "TikTok", "tk"),
    link(profiles?.twitterUrl, "X", "x"),
    link(profiles?.linkedinUrl, "LinkedIn", "in"),
    link(whatsappDigits ? `https://wa.me/${whatsappDigits}` : null, "WhatsApp", "wa")
  ].filter((item): item is StorefrontSocialLink => Boolean(item));
}

function link(href: string | null | undefined, label: string, shortLabel: string) {
  return href ? { href, label, shortLabel } : null;
}
