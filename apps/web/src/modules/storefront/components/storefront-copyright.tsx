import { Fragment } from "react";
import {
  STOREIM_BRAND_TOKEN,
  STOREIM_SITE_URL,
  splitStorefrontCopyright
} from "../footer-content";

/**
 * The footer's copyright line, with every mention of StoreIM linked to the
 * platform's own site.
 *
 * One component rather than three copies because all three template footers
 * print the same line, and the link — where it points, that it opens away from
 * the shop, how it is styled — should be decided once.
 *
 * A seller on a paid plan owns this text and may write it without the credit, in
 * which case there is nothing to link and this renders as plain text. On the
 * free tier the default line always carries it; see `footer_branding` in
 * `plan-features.ts` and the correction in `storefront-footer.tsx`.
 */
export function StorefrontCopyright({
  storeName,
  template
}: {
  storeName: string;
  template: string;
}) {
  const segments = splitStorefrontCopyright(template, storeName);

  return (
    <>
      {segments.map((segment, index) => (
        <Fragment key={index}>
          {index > 0 ? (
            <a
              href={STOREIM_SITE_URL}
              rel="noreferrer"
              // Away from the shop rather than out of it: a shopper who taps the
              // credit mid-browse should still have the store where they left it.
              target="_blank"
              // Inline rather than a class so the credit inherits its footer's
              // colour in all three templates, two of which style their footers
              // from stylesheets this component cannot see.
              style={{ color: "inherit", textDecoration: "underline" }}
            >
              {STOREIM_BRAND_TOKEN}
            </a>
          ) : null}
          {segment}
        </Fragment>
      ))}
    </>
  );
}
