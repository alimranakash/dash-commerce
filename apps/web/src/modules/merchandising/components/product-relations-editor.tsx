"use client";

import { Plus, Search, X } from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  MAX_RELATIONS_PER_TYPE,
  PRODUCT_RELATION_PRIORITY,
  type ProductRelationType
} from "../merchandising.schema";
import type {
  ProductRelationOption,
  ProductRelationSelections,
  ProductRelationSuggestion
} from "../merchandising.service";

type RelationGroup = {
  description: string;
  hiddenName: string;
  label: string;
  placeholder: string;
};

/**
 * The three lists, keyed by relation type. They are rendered in the order the
 * storefront spends them, so the seller sees the strongest list first.
 */
const relationGroups: Record<ProductRelationType, RelationGroup> = {
  ACCESSORY: {
    description: "Only makes sense next to this product - a case, a strap, a refill.",
    hiddenName: "accessoryProductIds",
    label: "Accessories",
    placeholder: "Search an accessory"
  },
  CROSS_SELL: {
    description: "Bought on the same trip. This is what fills the rail under the product.",
    hiddenName: "crossSellProductIds",
    label: "Cross-sell",
    placeholder: "Search a product to pair"
  },
  UPSELL: {
    description: "The same need at a higher price - the bigger size, the better model.",
    hiddenName: "upsellProductIds",
    label: "Upsell",
    placeholder: "Search a higher-tier product"
  }
};

type ProductRelationsEditorProps = {
  candidates: ProductRelationOption[];
  currency: string;
  /** Absent while creating, so there is nothing to exclude from the picker yet. */
  productId?: string | undefined;
  selections: ProductRelationSelections;
  /** Empty while creating: a product with no orders has nothing to suggest from. */
  suggestions: ProductRelationSuggestion[];
};

export function ProductRelationsEditor({
  candidates,
  currency,
  productId,
  selections,
  suggestions
}: ProductRelationsEditorProps) {
  const [selected, setSelected] = useState<ProductRelationSelections>(selections);
  const pickable = useMemo(
    () => candidates.filter((candidate) => candidate.id !== productId),
    [candidates, productId]
  );
  // A suggestion the seller has taken is not a suggestion any more, and it is
  // already visible as a chip in the list below.
  const openSuggestions = useMemo(() => {
    const paired = new Set(
      PRODUCT_RELATION_PRIORITY.flatMap((type) => selected[type]).map((option) => option.id)
    );

    return suggestions.filter((suggestion) => !paired.has(suggestion.option.id));
  }, [selected, suggestions]);

  function setGroup(type: ProductRelationType, options: ProductRelationOption[]) {
    setSelected((current) => ({ ...current, [type]: options }));
  }

  function acceptSuggestion(option: ProductRelationOption) {
    setSelected((current) =>
      current.CROSS_SELL.length >= MAX_RELATIONS_PER_TYPE
        ? current
        : { ...current, CROSS_SELL: [...current.CROSS_SELL, option] }
    );
  }

  return (
    <section className="product-editor-card">
      <header>
        <h2>Upsell and cross-sell</h2>
        <p>
          Pick what this product should sell alongside itself. Pairings are one-way: adding a case
          here does not put this product on the case page.
        </p>
      </header>
      <div className="product-editor-card-body">
        {openSuggestions.length > 0 ? (
          <div className="product-relation-suggestions">
            <div className="product-relation-suggestions-head">
              <strong>Frequently bought together</strong>
              <span>
                Counted from this store&apos;s own orders. Adding one puts it in Cross-sell, and
                nothing is saved until you save the product.
              </span>
            </div>
            <div className="product-relation-suggestion-chips">
              {openSuggestions.map((suggestion) => (
                <button
                  key={suggestion.option.id}
                  onClick={() => acceptSuggestion(suggestion.option)}
                  type="button"
                >
                  <Plus className="h-3 w-3" />
                  {suggestion.option.title}
                  <small>{orderCountLabel(suggestion.orderCount)}</small>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {PRODUCT_RELATION_PRIORITY.map((type) => (
          <RelationPicker
            candidates={pickable}
            currency={currency}
            group={relationGroups[type]}
            key={type}
            onChange={(options) => setGroup(type, options)}
            selected={selected[type]}
          />
        ))}
      </div>
    </section>
  );
}

function RelationPicker({
  candidates,
  currency,
  group,
  onChange,
  selected
}: {
  candidates: ProductRelationOption[];
  currency: string;
  group: RelationGroup;
  onChange: (options: ProductRelationOption[]) => void;
  selected: ProductRelationOption[];
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const isFull = selected.length >= MAX_RELATIONS_PER_TYPE;
  const normalizedQuery = query.trim().toLowerCase();
  const matches = useMemo(() => {
    const selectedIds = new Set(selected.map((option) => option.id));

    return candidates
      .filter((candidate) => !selectedIds.has(candidate.id))
      .filter(
        (candidate) =>
          !normalizedQuery ||
          candidate.title.toLowerCase().includes(normalizedQuery) ||
          (candidate.sku ?? "").toLowerCase().includes(normalizedQuery)
      )
      .slice(0, 30);
  }, [candidates, normalizedQuery, selected]);

  function selectOption(option: ProductRelationOption) {
    if (isFull) {
      return;
    }

    onChange([...selected, option]);
    setQuery("");
    setActiveIndex(0);
    inputRef.current?.focus();
  }

  function removeOption(id: string) {
    onChange(selected.filter((option) => option.id !== id));
    inputRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.min(current + 1, Math.max(matches.length - 1, 0)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const match = matches[activeIndex];

      if (match) {
        selectOption(match);
      }
      return;
    }

    if (event.key === "Backspace" && !query && selected.length > 0) {
      const last = selected[selected.length - 1];

      if (last) {
        removeOption(last.id);
      }
      return;
    }

    if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="taxonomy-multi-select">
      {selected.map((option) => (
        <input key={option.id} name={group.hiddenName} type="hidden" value={option.id} />
      ))}

      <div className="taxonomy-multi-label">
        <span>{group.label}</span>
        {selected.length > 0 ? (
          <button onClick={() => onChange([])} type="button">
            Clear all
          </button>
        ) : null}
      </div>
      <p className="taxonomy-multi-description">{group.description}</p>

      <div
        className={`taxonomy-multi-control ${open ? "is-open" : ""}`}
        onClick={() => inputRef.current?.focus()}
      >
        <div className="taxonomy-multi-chips">
          {selected.map((option) => (
            <span className="taxonomy-chip" key={option.id}>
              {option.title}
              <button
                aria-label={`Remove ${option.title}`}
                onClick={() => removeOption(option.id)}
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <div className="taxonomy-search-input">
            <Search className="h-3.5 w-3.5" />
            <input
              aria-label={`Search products for ${group.label}`}
              disabled={isFull}
              onBlur={() => window.setTimeout(() => setOpen(false), 120)}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={isFull ? `${MAX_RELATIONS_PER_TYPE} is the limit` : group.placeholder}
              ref={inputRef}
              type="text"
              value={query}
            />
          </div>
        </div>
      </div>

      {open && !isFull ? (
        <div className="taxonomy-multi-dropdown">
          {matches.length > 0 ? (
            <div className="taxonomy-multi-options" role="listbox">
              {matches.map((option, index) => (
                <button
                  className={activeIndex === index ? "is-active" : ""}
                  key={option.id}
                  onClick={() => selectOption(option)}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  role="option"
                  type="button"
                >
                  <span className="product-relation-option">
                    {option.imageUrl ? <img alt="" loading="lazy" src={option.imageUrl} /> : null}
                    <span>
                      <strong>{option.title}</strong>
                      <small>{optionMeta(option, currency)}</small>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="taxonomy-multi-state">
              {candidates.length === 0
                ? "Add another product first. There is nothing to pair with yet."
                : "No products match that search."}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function orderCountLabel(orderCount: number) {
  return orderCount === 1 ? "1 order" : `${orderCount} orders`;
}

/** Price, SKU, and the status only when it is something the seller should notice. */
function optionMeta(option: ProductRelationOption, currency: string) {
  const parts = [formatMoney(option.price, currency)];

  if (option.sku) {
    parts.push(option.sku);
  }

  if (option.status !== "ACTIVE") {
    parts.push(option.status.toLowerCase());
  }

  return parts.join(" - ");
}

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(Number(value) || 0);
}
