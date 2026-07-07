"use client";

import { Check, Loader2, Plus, Search, X } from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";

export type TaxonomyOption = {
  id: string;
  name: string;
};

type TaxonomyMultiSelectProps = {
  createLabel?: string;
  description?: string;
  emptyLabel?: string;
  hiddenName?: string;
  label: string;
  loading?: boolean;
  onChange: (ids: string[]) => void;
  onCreate?: (name: string) => Promise<TaxonomyOption | null> | TaxonomyOption | null;
  options: TaxonomyOption[];
  placeholder: string;
  primaryHiddenName?: string;
  selectedIds: string[];
};

export function TaxonomyMultiSelect({
  createLabel = "Create",
  description,
  emptyLabel = "No matching items.",
  hiddenName,
  label,
  loading,
  onChange,
  onCreate,
  options,
  placeholder,
  primaryHiddenName,
  selectedIds
}: TaxonomyMultiSelectProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [creating, setCreating] = useState(false);
  const selectedOptions = useMemo(
    () => selectedIds.map((id) => options.find((option) => option.id === id)).filter((option): option is TaxonomyOption => Boolean(option)),
    [options, selectedIds]
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = useMemo(
    () => options.filter((option) => !selectedIds.includes(option.id) && option.name.toLowerCase().includes(normalizedQuery)),
    [normalizedQuery, options, selectedIds]
  );
  const canCreate = Boolean(onCreate && query.trim().length >= 2 && !options.some((option) => option.name.toLowerCase() === normalizedQuery));

  function selectOption(option: TaxonomyOption) {
    onChange([...selectedIds, option.id]);
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
    inputRef.current?.focus();
  }

  function removeOption(id: string) {
    onChange(selectedIds.filter((selectedId) => selectedId !== id));
    inputRef.current?.focus();
  }

  async function createOption() {
    if (!onCreate || !canCreate || creating) {
      return;
    }

    setCreating(true);

    try {
      const option = await onCreate(query.trim());

      if (option) {
        onChange([...selectedIds, option.id]);
        setQuery("");
        setActiveIndex(0);
        setOpen(true);
      }
    } finally {
      setCreating(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.min(current + 1, Math.max(filteredOptions.length - 1, 0)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();

      if (filteredOptions[activeIndex]) {
        selectOption(filteredOptions[activeIndex]);
        return;
      }

      void createOption();
      return;
    }

    if (event.key === "Backspace" && !query && selectedIds.length > 0) {
      const lastSelectedId = selectedIds[selectedIds.length - 1];

      if (lastSelectedId) {
        removeOption(lastSelectedId);
      }
      return;
    }

    if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="taxonomy-multi-select">
      {primaryHiddenName ? <input name={primaryHiddenName} type="hidden" value={selectedIds[0] ?? ""} /> : null}
      {hiddenName ? selectedIds.map((id) => <input key={id} name={hiddenName} type="hidden" value={id} />) : null}

      <div className="taxonomy-multi-label">
        <span>{label}</span>
        {selectedIds.length > 0 ? (
          <button onClick={() => onChange([])} type="button">
            Clear all
          </button>
        ) : null}
      </div>
      {description ? <p className="taxonomy-multi-description">{description}</p> : null}

      <div className={`taxonomy-multi-control ${open ? "is-open" : ""}`} onClick={() => inputRef.current?.focus()}>
        <div className="taxonomy-multi-chips">
          {selectedOptions.map((option) => (
            <span className="taxonomy-chip" key={option.id}>
              {option.name}
              <button aria-label={`Remove ${option.name}`} onClick={() => removeOption(option.id)} type="button">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <div className="taxonomy-search-input">
            <Search className="h-3.5 w-3.5" />
            <input
              aria-label={`Search ${label}`}
              onBlur={() => window.setTimeout(() => setOpen(false), 120)}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={selectedOptions.length > 0 ? "Search or create" : placeholder}
              ref={inputRef}
              type="text"
              value={query}
            />
          </div>
        </div>
      </div>

      {open ? (
        <div className="taxonomy-multi-dropdown">
          {loading ? (
            <div className="taxonomy-multi-state">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : null}

          {!loading && filteredOptions.length > 0 ? (
            <div className="taxonomy-multi-options" role="listbox">
              {filteredOptions.map((option, index) => (
                <button
                  className={activeIndex === index ? "is-active" : ""}
                  key={option.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectOption(option)}
                  role="option"
                  type="button"
                >
                  <span>{option.name}</span>
                  {activeIndex === index ? <Check className="h-4 w-4" /> : null}
                </button>
              ))}
            </div>
          ) : null}

          {!loading && filteredOptions.length === 0 ? (
            <div className="taxonomy-multi-state">{query.trim() ? emptyLabel : "Start typing to search."}</div>
          ) : null}

          {!loading && canCreate ? (
            <button
              className="taxonomy-create-option"
              disabled={creating}
              onMouseDown={(event) => event.preventDefault()}
              onClick={createOption}
              type="button"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {createLabel} "{query.trim()}"
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
