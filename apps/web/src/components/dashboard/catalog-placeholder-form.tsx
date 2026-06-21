"use client";

import { useEffect, useState, type FormEvent } from "react";
import { normalizeSlug } from "../../lib/slug";

export type CatalogPlaceholderValue = {
  id: string;
  name: string;
  slug: string;
};

type CatalogPlaceholderFormProps = {
  editingItem?: CatalogPlaceholderValue | null;
  onCancelEdit: () => void;
  onSave: (value: Omit<CatalogPlaceholderValue, "id">) => void;
  singularLabel: string;
};

export function CatalogPlaceholderForm({ editingItem, onCancelEdit, onSave, singularLabel }: CatalogPlaceholderFormProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    setName(editingItem?.name ?? "");
    setSlug(editingItem?.slug ?? "");
    setSlugTouched(Boolean(editingItem));
  }, [editingItem]);

  function submitPlaceholder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanSlug = normalizeSlug(slug || cleanName);

    if (!cleanName || !cleanSlug) return;

    onSave({ name: cleanName, slug: cleanSlug });
    setName("");
    setSlug("");
    setSlugTouched(false);
  }

  return (
    <form className="resource-form compact-form catalog-create-form" onSubmit={submitPlaceholder}>
      <label>
        Name
        <input
          onChange={(event) => {
            const nextName = event.target.value;
            setName(nextName);
            if (!slugTouched) setSlug(normalizeSlug(nextName));
          }}
          placeholder="Enter name"
          required
          type="text"
          value={name}
        />
      </label>
      <label>
        Slug
        <input
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(normalizeSlug(event.target.value));
          }}
          placeholder={`${singularLabel.toLowerCase()}-slug`}
          type="text"
          value={slug}
        />
      </label>
      <div className="form-actions">
        {editingItem ? <button className="catalog-cancel-button" onClick={onCancelEdit} type="button">Cancel</button> : null}
        <button className="catalog-submit-button" type="submit">{editingItem ? "Update" : "Create"} {singularLabel}</button>
      </div>
    </form>
  );
}
