import Script from "next/script";
import type { MarketingTag } from "../marketing-tags";

/**
 * Renders one slot of a `MarketingTagPlan`.
 *
 * Scripts go through `next/script` with `afterInteractive`, which is what every
 * analytics vendor asks for: the tag runs as soon as the page is usable without
 * blocking first paint. `html` tags are noscript fallbacks and verification
 * markup — inert by nature, so `dangerouslySetInnerHTML` is safe for them, and
 * required because React would otherwise escape the markup.
 */
export function MarketingTags({ tags }: { tags: MarketingTag[] }) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <>
      {tags.map((tag) => {
        if (tag.kind === "external") {
          return <Script id={tag.id} key={tag.id} src={tag.src} strategy="afterInteractive" />;
        }

        if (tag.kind === "inline") {
          return (
            <Script id={tag.id} key={tag.id} strategy="afterInteractive">
              {tag.code}
            </Script>
          );
        }

        if (tag.noscript) {
          return (
            <noscript
              dangerouslySetInnerHTML={{ __html: tag.html }}
              key={tag.id}
              suppressHydrationWarning
            />
          );
        }

        // Leftover custom markup (meta, img, link, …). React needs a host
        // element to attach raw HTML to; `display: contents` keeps that wrapper
        // from generating a box, so it cannot disturb the storefront's layout.
        return (
          <div
            dangerouslySetInnerHTML={{ __html: tag.html }}
            key={tag.id}
            style={{ display: "contents" }}
            suppressHydrationWarning
          />
        );
      })}
    </>
  );
}
