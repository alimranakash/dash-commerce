/**
 * Save-time validation for the Custom Tracking block — the only place a seller
 * can still supply raw markup.
 *
 * The rule is an allowlist, not a sanitiser: we never silently rewrite what was
 * typed. Either the whole block is something we recognise as tracking code, or
 * the save is rejected with the specific reason. This runs again on read before
 * anything is injected, so an edit made directly against the database cannot
 * bypass it.
 */

/** Hosts a tracking `src`/`iframe` may point at. Same-origin paths are also allowed. */
export const trackingHostAllowlist = [
  "connect.facebook.net",
  "googletagmanager.com",
  "google-analytics.com",
  "googleadservices.com",
  "googleoptimize.com",
  "analytics.tiktok.com",
  "static.hotjar.com",
  "script.hotjar.com",
  "cdn.pdst.fm",
  "sc-static.net",
  "snap.licdn.com",
  "www.facebook.com",
  "www.google.com",
  "px.ads.linkedin.com"
] as const;

const allowedTags = new Set(["script", "noscript", "meta", "img", "iframe", "link", "style"]);

const forbiddenPatterns: { message: string; pattern: RegExp }[] = [
  {
    message: "Inline event handlers (onload, onerror, …) are not allowed.",
    pattern: /\son[a-z]+\s*=/i
  },
  { message: "javascript: URLs are not allowed.", pattern: /javascript\s*:/i },
  { message: "data: URLs are not allowed in tracking code.", pattern: /src\s*=\s*["']?data:/i },
  { message: "document.write is not allowed.", pattern: /document\s*\.\s*write/i },
  {
    message: "Rewriting document.domain or cookies directly is not allowed.",
    pattern: /document\s*\.\s*(domain|cookie)\s*=/i
  },
  { message: "eval() is not allowed.", pattern: /\beval\s*\(/i },
  {
    message: "Loading further scripts via import() or importScripts is not allowed.",
    pattern: /\bimportScripts\s*\(|\bimport\s*\(/i
  },
  { message: "<link rel=\"import\"> is not allowed.", pattern: /rel\s*=\s*["']?import/i }
];

/** Returns one message per problem; an empty array means the block is acceptable. */
export function validateCustomTrackingCode(code: string): string[] {
  const problems: string[] = [];
  const withoutComments = code.replace(/<!--[\s\S]*?-->/g, "");

  for (const { message, pattern } of forbiddenPatterns) {
    if (pattern.test(withoutComments)) {
      problems.push(message);
    }
  }

  for (const tag of readTagNames(withoutComments)) {
    if (!allowedTags.has(tag)) {
      problems.push(`<${tag}> is not allowed here. Use tracking tags only.`);
    }
  }

  for (const src of readExternalUrls(withoutComments)) {
    if (!isAllowedTrackingUrl(src)) {
      problems.push(`${src} is not on the allowed tracking host list.`);
    }
  }

  return [...new Set(problems)];
}

export function isAllowedTrackingUrl(value: string) {
  const trimmed = value.trim();

  // Same-origin: a root-relative path, matching how uploaded media is served.
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return true;
  }

  let host: string;

  try {
    host = new URL(trimmed.startsWith("//") ? `https:${trimmed}` : trimmed).hostname.toLowerCase();
  } catch {
    return false;
  }

  return trackingHostAllowlist.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function readTagNames(code: string) {
  return [...code.matchAll(/<\s*\/?\s*([a-zA-Z][a-zA-Z0-9-]*)/g)]
    .map((match) => match[1]?.toLowerCase())
    .filter((tag): tag is string => Boolean(tag));
}

function readExternalUrls(code: string) {
  return [...code.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)]
    .map((match) => match[1])
    .filter((value): value is string => Boolean(value));
}
