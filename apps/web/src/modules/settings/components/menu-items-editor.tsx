"use client";

import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { useState, type DragEvent } from "react";
import type { StorefrontMenuItem } from "../../storefront/customization";

type MenuItemsEditorProps = {
  helper: string;
  items: StorefrontMenuItem[];
  label: string;
  name: string;
};

// Mirrors the menuList() cap in storefront/customization.ts - the header
// silently drops anything past this, so the editor stops you before that
// happens instead of after.
const MAX_ITEMS = 12;

const QUICK_LINKS: StorefrontMenuItem[] = [
  { label: "Home", url: "/" },
  { label: "All products", url: "/products" },
  { label: "Categories", url: "/categories" },
  { label: "New arrivals", url: "/products?sort=newest" },
  { label: "Cart", url: "/cart" },
  { label: "Wishlist", url: "/wishlist" },
  { label: "Search", url: "/search" },
  { label: "Account", url: "/account" }
];

const emptyItem: StorefrontMenuItem = { label: "", url: "/" };

/**
 * Structured replacement for the pipe-delimited menu-items textarea. Rows are
 * serialized back into that exact "Label | /path" format in a hidden
 * textarea, so parseMenuItems() in settings.actions.ts is untouched.
 */
export function MenuItemsEditor({ helper, items, label, name }: MenuItemsEditorProps) {
  const [rows, setRows] = useState<StorefrontMenuItem[]>(
    items.length > 0 ? items : [{ ...emptyItem }]
  );
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const serialized = rows
    .filter((row) => row.label.trim())
    .map((row) => `${row.label.trim()} | ${(row.url || "/").trim()}`)
    .join("\n");

  function updateRow(index: number, patch: Partial<StorefrontMenuItem>) {
    setRows((current) =>
      current.map((row, position) => (position === index ? { ...row, ...patch } : row))
    );
  }

  function reorder(from: number, to: number) {
    setRows((current) => {
      if (from === to || to < 0 || to >= current.length) {
        return current;
      }

      const next = [...current];
      const [item] = next.splice(from, 1);

      if (item !== undefined) {
        next.splice(to, 0, item);
      }

      return next;
    });
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, index: number) {
    event.preventDefault();

    if (dragIndex !== null) {
      reorder(dragIndex, index);
    }

    setDragIndex(null);
  }

  const visibleItems = rows.filter((row) => row.label.trim());

  return (
    <div className="menu-items-editor">
      {/* Hidden textarea rather than an input: newlines survive submission. */}
      <textarea hidden name={name} readOnly value={serialized} />
      <div className="theme-upload-label-row">
        <span>{label}</span>
        <button
          className="media-picker-choose"
          disabled={rows.length >= MAX_ITEMS}
          onClick={() => setRows((current) => [...current, { ...emptyItem }])}
          type="button"
        >
          <Plus className="h-4 w-4" />
          Add menu item
        </button>
      </div>
      <p className="menu-items-helper">
        {helper}
        <span className="menu-items-count">
          {rows.length}/{MAX_ITEMS}
        </span>
      </p>

      {rows.length === 0 ? (
        <p className="promo-cards-helper">No menu items yet. Add your first link above.</p>
      ) : (
        <div className="menu-items-list" role="list">
          {rows.map((row, index) => (
            <div
              className={dragIndex === index ? "menu-item-row is-dragging" : "menu-item-row"}
              draggable
              key={index}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={(event) => event.preventDefault()}
              onDragStart={() => setDragIndex(index)}
              onDrop={(event) => handleDrop(event, index)}
              role="listitem"
            >
              <span aria-hidden="true" className="menu-item-grip" title="Drag to reorder">
                <GripVertical className="h-4 w-4" />
              </span>
              <span aria-hidden="true" className="menu-item-index">
                {index + 1}
              </span>
              <div className="menu-item-fields">
                <label>
                  Label
                  <input
                    onChange={(event) => updateRow(index, { label: event.target.value })}
                    placeholder="e.g. Women"
                    type="text"
                    value={row.label}
                  />
                </label>
                <label>
                  Link
                  <input
                    onChange={(event) => updateRow(index, { url: event.target.value })}
                    placeholder="/categories/womens-clothing"
                    type="text"
                    value={row.url}
                  />
                </label>
                <label className="menu-item-quick-link">
                  Quick link
                  <select
                    aria-label="Insert a common page link"
                    onChange={(event) => {
                      const preset = QUICK_LINKS.find((link) => link.url === event.target.value);

                      if (preset) {
                        updateRow(index, { label: row.label || preset.label, url: preset.url });
                      }

                      event.target.value = "";
                    }}
                    value=""
                  >
                    <option value="">Insert a common page...</option>
                    {QUICK_LINKS.map((quickLink) => (
                      <option key={quickLink.url} value={quickLink.url}>
                        {quickLink.label} · {quickLink.url}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="menu-item-actions">
                <button
                  aria-label={`Move item ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => reorder(index, index - 1)}
                  type="button"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  aria-label={`Move item ${index + 1} down`}
                  disabled={index === rows.length - 1}
                  onClick={() => reorder(index, index + 1)}
                  type="button"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  aria-label={`Remove item ${index + 1}`}
                  className="menu-item-remove"
                  onClick={() =>
                    setRows((current) => current.filter((_, position) => position !== index))
                  }
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="menu-items-preview">
        <span className="menu-items-preview-label">Live preview</span>
        <nav className="menu-items-preview-nav">
          {visibleItems.length === 0 ? (
            <span className="menu-items-preview-empty">Your storefront menu will appear here.</span>
          ) : (
            visibleItems.map((row, index) => (
              <span className="menu-items-preview-link" key={index}>
                {row.label}
              </span>
            ))
          )}
        </nav>
      </div>
    </div>
  );
}
