"use client";

import { Clock, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SearchSuggestions } from "../search.service";

/** Long enough that a typist does not fire one request per keystroke. */
const DEBOUNCE_MS = 180;
const RECENT_SEARCH_LIMIT = 5;
const EMPTY_SUGGESTIONS: SearchSuggestions = {
  categories: [],
  products: [],
  totalProducts: 0
};

type PredictiveSearchProps = {
  autoFocus?: boolean | undefined;
  className?: string | undefined;
  currency: string;
  onNavigate?: (() => void) | undefined;
  placeholder?: string | undefined;
  storeSlug: string;
};

export function PredictiveSearch({
  autoFocus,
  className,
  currency,
  onNavigate,
  placeholder,
  storeSlug
}: PredictiveSearchProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestions>(EMPTY_SUGGESTIONS);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchHref = `/s/${storeSlug}/search`;
  const trimmedQuery = query.trim();

  useEffect(() => {
    setRecentSearches(readRecentSearches(storeSlug));
  }, [storeSlug]);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (trimmedQuery.length === 0) {
      setSuggestions(EMPTY_SUGGESTIONS);
      setLoading(false);

      return;
    }

    // A new keystroke invalidates the request already in flight; without the
    // abort, the slower of two overlapping responses could land last and
    // overwrite results for a query the shopper has already moved on from.
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      void fetchSuggestions(storeSlug, trimmedQuery, controller.signal)
        .then((result) => {
          setSuggestions(result);
          setActiveIndex(-1);
          setLoading(false);
        })
        .catch(() => {
          // Aborts are the normal case here rather than a failure worth
          // reporting; a genuine network error just leaves the last list up.
        });
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [storeSlug, trimmedQuery]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);

    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const products = suggestions.products;

  const commitSearch = useCallback(
    (term: string) => {
      const cleaned = term.trim();

      if (cleaned.length === 0) {
        return;
      }

      setRecentSearches(rememberRecentSearch(storeSlug, cleaned));
      setOpen(false);
      onNavigate?.();
      router.push(`${searchHref}?q=${encodeURIComponent(cleaned)}`);
    },
    [onNavigate, router, searchHref, storeSlug]
  );

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);

      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (products.length === 0) {
        return;
      }

      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;

      // Wrapping past either end lands back on the raw query, so Enter can
      // always fall through to a full search without reaching for the mouse.
      setActiveIndex((current) => {
        const next = current + step;

        return next < -1 ? products.length - 1 : next >= products.length ? -1 : next;
      });

      return;
    }

    if (event.key === "Enter") {
      const active = activeIndex >= 0 ? products[activeIndex] : undefined;

      if (active) {
        event.preventDefault();
        setRecentSearches(rememberRecentSearch(storeSlug, trimmedQuery));
        setOpen(false);
        onNavigate?.();
        router.push(`/s/${storeSlug}/products/${active.slug}`);
      }
    }
  };

  const formatPrice = useMemo(() => createPriceFormatter(currency), [currency]);
  const showRecent = trimmedQuery.length === 0 && recentSearches.length > 0;
  const showResults = trimmedQuery.length > 0;

  return (
    <div className={`sf-predictive${className ? ` ${className}` : ""}`} ref={containerRef}>
      <form
        action={searchHref}
        className="sf-predictive-form"
        method="get"
        onSubmit={(event) => {
          event.preventDefault();
          commitSearch(query);
        }}
        role="search"
      >
        <Search aria-hidden className="sf-predictive-icon" size={17} />
        <input
          aria-autocomplete="list"
          aria-expanded={open}
          aria-label="Search products"
          autoComplete="off"
          className="sf-predictive-input"
          name="q"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder ?? "Search products"}
          ref={inputRef}
          role="combobox"
          type="search"
          value={query}
        />
        {query.length > 0 ? (
          <button
            aria-label="Clear search"
            className="sf-predictive-clear"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            type="button"
          >
            <X size={15} />
          </button>
        ) : null}
        <button aria-label="Search" className="sf-predictive-submit" type="submit">
          Search
        </button>
      </form>

      {open && (showRecent || showResults) ? (
        <div className="sf-predictive-panel">
          {showRecent ? (
            <div className="sf-predictive-group">
              <p className="sf-predictive-group-title">Recent searches</p>
              {recentSearches.map((term) => (
                <button
                  className="sf-predictive-recent"
                  key={term}
                  onClick={() => commitSearch(term)}
                  type="button"
                >
                  <Clock aria-hidden size={14} />
                  <span>{term}</span>
                </button>
              ))}
            </div>
          ) : null}

          {showResults && suggestions.categories.length > 0 ? (
            <div className="sf-predictive-group">
              <p className="sf-predictive-group-title">Categories</p>
              {suggestions.categories.map((category) => (
                <Link
                  className="sf-predictive-category"
                  href={`/s/${storeSlug}/categories/${category.slug}`}
                  key={category.slug}
                  onClick={() => {
                    setOpen(false);
                    onNavigate?.();
                  }}
                >
                  {category.name}
                </Link>
              ))}
            </div>
          ) : null}

          {showResults && products.length > 0 ? (
            <div className="sf-predictive-group" role="listbox">
              <p className="sf-predictive-group-title">Products</p>
              {products.map((product, index) => (
                <Link
                  aria-selected={index === activeIndex}
                  className={`sf-predictive-product${index === activeIndex ? " is-active" : ""}`}
                  href={`/s/${storeSlug}/products/${product.slug}`}
                  key={product.id}
                  onClick={() => {
                    setRecentSearches(rememberRecentSearch(storeSlug, trimmedQuery));
                    setOpen(false);
                    onNavigate?.();
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  role="option"
                >
                  <span className="sf-predictive-thumb">
                    {/*
                      Storefront media is served from merchant-configured hosts,
                      so this stays a plain img the way the rest of the
                      storefront cards do rather than going through next/image.
                    */}
                    {product.imageUrl ? <img alt="" loading="lazy" src={product.imageUrl} /> : null}
                  </span>
                  <span className="sf-predictive-product-text">
                    <span className="sf-predictive-product-title">{product.title}</span>
                    <span className="sf-predictive-product-price">
                      {formatPrice(product.price)}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          ) : null}

          {showResults && suggestions.totalProducts > 0 ? (
            <button className="sf-predictive-all" onClick={() => commitSearch(query)} type="button">
              See all {suggestions.totalProducts} results
            </button>
          ) : null}

          {showResults &&
          !loading &&
          products.length === 0 &&
          suggestions.categories.length === 0 ? (
            <p className="sf-predictive-empty">No matches yet. Try a different word.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

async function fetchSuggestions(storeSlug: string, query: string, signal: AbortSignal) {
  const params = new URLSearchParams({ q: query, store: storeSlug });
  const response = await fetch(`/api/storefront/search/suggest?${params.toString()}`, { signal });

  if (!response.ok) {
    return EMPTY_SUGGESTIONS;
  }

  return (await response.json()) as SearchSuggestions;
}

function createPriceFormatter(currency: string) {
  const formatter = new Intl.NumberFormat("en", { currency, style: "currency" });

  return (value: string) => formatter.format(Number(value));
}

function recentSearchesKey(storeSlug: string) {
  return `dash:recent-searches:${storeSlug}`;
}

function readRecentSearches(storeSlug: string): string[] {
  try {
    const stored = window.localStorage.getItem(recentSearchesKey(storeSlug));
    const parsed: unknown = stored ? JSON.parse(stored) : [];

    return Array.isArray(parsed)
      ? parsed.filter((term): term is string => typeof term === "string")
      : [];
  } catch {
    return [];
  }
}

function rememberRecentSearch(storeSlug: string, term: string) {
  const cleaned = term.trim();

  if (cleaned.length === 0) {
    return readRecentSearches(storeSlug);
  }

  const existing = readRecentSearches(storeSlug).filter(
    (stored) => stored.toLowerCase() !== cleaned.toLowerCase()
  );
  const next = [cleaned, ...existing].slice(0, RECENT_SEARCH_LIMIT);

  try {
    window.localStorage.setItem(recentSearchesKey(storeSlug), JSON.stringify(next));
  } catch {
    // Private-mode browsers reject writes; the list just does not persist.
  }

  return next;
}
