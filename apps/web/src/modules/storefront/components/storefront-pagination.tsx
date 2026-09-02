import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

type PaginationSlot = number | "gap";

type StorefrontPaginationProps = {
  /** Builds the href for a page number; each page owns its own query string. */
  buildHref: (page: number) => string;
  currentPage: number;
  itemNoun?: string | undefined;
  /** The `aria-label` for the nav landmark, e.g. "Product pagination". */
  label: string;
  /** The seller's Shop Page setting. `load-more` drops the numbers. */
  mode?: "load-more" | "pagination" | undefined;
  perPage?: number | undefined;
  totalItems?: number | undefined;
  totalPages: number;
};

// Seven number slots is what fits beside two labelled steps before the row has
// to wrap on a phone-width viewport, and it is an odd number, so the current
// page sits in the middle of the window rather than off to one side.
const MAX_VISIBLE_PAGES = 7;

/**
 * The storefront's shared pager: numbered pages with first/last always
 * reachable, ellipses for the pages in between, and a "Page x of y" line that
 * takes over from the numbers on a narrow screen.
 *
 * A single page is not pagination, so it renders nothing — the three listing
 * pages can hand it their totals unconditionally.
 */
export function StorefrontPagination({
  buildHref,
  currentPage,
  itemNoun = "products",
  label,
  mode = "pagination",
  perPage,
  totalItems,
  totalPages
}: StorefrontPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const slots = paginationWindow(currentPage, totalPages);
  const summary = paginationSummary(currentPage, itemNoun, perPage, totalItems);

  return (
    <nav aria-label={label} className="sf-pagination" data-mode={mode}>
      <div className="sf-pagination-controls">
        <PaginationStep
          direction="previous"
          disabled={currentPage <= 1}
          href={buildHref(currentPage - 1)}
          label="Previous"
        />
        {mode === "pagination" ? (
          <ol className="sf-pagination-pages">
            {slots.map((slot, index) =>
              slot === "gap" ? (
                <li aria-hidden="true" className="sf-pagination-gap" key={`gap-${index}`}>
                  &hellip;
                </li>
              ) : (
                <li key={slot}>
                  {slot === currentPage ? (
                    <span aria-current="page" className="sf-pagination-page is-current">
                      {slot}
                    </span>
                  ) : (
                    <Link
                      aria-label={`Go to page ${slot}`}
                      className="sf-pagination-page"
                      href={buildHref(slot)}
                    >
                      {slot}
                    </Link>
                  )}
                </li>
              )
            )}
          </ol>
        ) : null}
        <span className="sf-pagination-status">
          Page {currentPage} of {totalPages}
        </span>
        <PaginationStep
          direction="next"
          disabled={currentPage >= totalPages}
          href={buildHref(currentPage + 1)}
          label={mode === "load-more" ? "Load More" : "Next"}
        />
      </div>
      {summary ? <p className="sf-pagination-summary">{summary}</p> : null}
    </nav>
  );
}

/**
 * A step is a link or, at either end of the range, a styled `span` — never a
 * disabled link, which is still focusable and still followable.
 */
function PaginationStep({
  direction,
  disabled,
  href,
  label
}: {
  direction: "next" | "previous";
  disabled: boolean;
  href: string;
  label: string;
}) {
  const icon =
    direction === "previous" ? (
      <ChevronLeft aria-hidden="true" size={16} strokeWidth={2.5} />
    ) : (
      <ChevronRight aria-hidden="true" size={16} strokeWidth={2.5} />
    );
  const content =
    direction === "previous" ? (
      <>
        {icon}
        <span className="sf-pagination-step-label">{label}</span>
      </>
    ) : (
      <>
        <span className="sf-pagination-step-label">{label}</span>
        {icon}
      </>
    );

  if (disabled) {
    return (
      <span aria-disabled="true" className="sf-pagination-step">
        {content}
      </span>
    );
  }

  return (
    <Link
      className="sf-pagination-step"
      href={href}
      rel={direction === "previous" ? "prev" : "next"}
    >
      {content}
    </Link>
  );
}

/**
 * First and last page are always in the window, so a shopper can reach either
 * end in one press no matter how deep they are.
 */
function paginationWindow(currentPage: number, totalPages: number): PaginationSlot[] {
  if (totalPages <= MAX_VISIBLE_PAGES) {
    return pageRange(1, totalPages);
  }

  if (currentPage <= 4) {
    return [...pageRange(1, 5), "gap", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, "gap", ...pageRange(totalPages - 4, totalPages)];
  }

  return [1, "gap", currentPage - 1, currentPage, currentPage + 1, "gap", totalPages];
}

/** "Showing 13–24 of 96 products" — omitted when the page cannot count. */
function paginationSummary(
  currentPage: number,
  itemNoun: string,
  perPage: number | undefined,
  totalItems: number | undefined
) {
  if (!perPage || !totalItems) {
    return null;
  }

  const first = (currentPage - 1) * perPage + 1;
  const last = Math.min(currentPage * perPage, totalItems);

  if (first > totalItems) {
    return null;
  }

  return `Showing ${first === last ? first : `${first}\u2013${last}`} of ${totalItems} ${itemNoun}`;
}

function pageRange(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}
