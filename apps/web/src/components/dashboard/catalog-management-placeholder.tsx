"use client";

import { Edit3, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CatalogPlaceholderForm, type CatalogPlaceholderValue } from "./catalog-placeholder-form";
import { DashboardShell } from "./dashboard-shell";
import { DeleteConfirmationButton } from "./delete-confirmation-button";

type CatalogManagementPlaceholderProps = {
  baseHref: string;
  mode: "all" | "create";
  pluralLabel: string;
  singularLabel: string;
  storeSlug: string;
};

export function CatalogManagementPlaceholder({ baseHref, mode, pluralLabel, singularLabel, storeSlug }: CatalogManagementPlaceholderProps) {
  void mode;
  const storageKey = useMemo(() => `dash:${storeSlug}:${baseHref}:draft-items`, [baseHref, storeSlug]);
  const [items, setItems] = useState<CatalogPlaceholderValue[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const savedItems = window.localStorage.getItem(storageKey);
      setItems(savedItems ? JSON.parse(savedItems) as CatalogPlaceholderValue[] : []);
    } catch {
      setItems([]);
    }
  }, [storageKey]);

  function saveItems(nextItems: CatalogPlaceholderValue[]) {
    setItems(nextItems);
    window.localStorage.setItem(storageKey, JSON.stringify(nextItems));
  }

  function saveItem(value: Omit<CatalogPlaceholderValue, "id">) {
    if (editingId) {
      saveItems(items.map((item) => item.id === editingId ? { ...item, ...value } : item));
      setEditingId(null);
      return;
    }

    saveItems([...items, { id: crypto.randomUUID(), ...value }]);
  }

  const editingItem = items.find((item) => item.id === editingId) ?? null;

  return (
    <DashboardShell storeSlug={storeSlug}>
      <section className="resource-page catalog-management-page">
        <div className="catalog-page-heading">
          <h1>{pluralLabel}</h1>
        </div>
        <div className="catalog-management-grid">
          <section className="catalog-card catalog-list-card">
            <header><h2>{pluralLabel} List</h2></header>
            <div className="catalog-table-wrap">
              <table className="catalog-management-table">
                <thead><tr><th><input aria-label={`Select all ${pluralLabel.toLowerCase()}`} type="checkbox" /></th><th>Name</th><th>Slug</th><th>Action</th></tr></thead>
                <tbody>
                  {items.length ? items.map((item) => (
                    <tr key={item.id}>
                      <td><input aria-label={`Select ${item.name}`} type="checkbox" /></td>
                      <td>{item.name}</td>
                      <td>{item.slug}</td>
                      <td>
                        <div className="catalog-row-actions">
                          <button aria-label={`Edit ${item.name}`} onClick={() => setEditingId(item.id)} title={`Edit ${singularLabel.toLowerCase()}`} type="button"><Edit3 /></button>
                          <DeleteConfirmationButton
                            action={() => {
                              saveItems(items.filter((current) => current.id !== item.id));
                              if (editingId === item.id) setEditingId(null);
                            }}
                            ariaLabel={`Delete ${item.name}`}
                            title={`Delete ${singularLabel.toLowerCase()}`}
                          >
                            <Trash2 />
                          </DeleteConfirmationButton>
                        </div>
                      </td>
                    </tr>
                  )) : <tr><td className="catalog-empty-row" colSpan={4}>No {pluralLabel.toLowerCase()} yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
          <section className="catalog-card catalog-form-card">
            <header><h2>{editingItem ? `Edit ${singularLabel}` : `Add New ${singularLabel}`}</h2></header>
            <div className="catalog-form-body">
              <CatalogPlaceholderForm
                editingItem={editingItem}
                onCancelEdit={() => setEditingId(null)}
                onSave={saveItem}
                singularLabel={singularLabel}
              />
            </div>
          </section>
        </div>
      </section>
    </DashboardShell>
  );
}
