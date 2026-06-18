"use client";

import { Button } from "@dash/ui";
import { useActionState, useState, type ReactNode } from "react";
import { normalizeSlug } from "../../../lib/slug";
import type { CategoryActionState } from "../category.actions";

export type CategoryFormOption = {
  id: string;
  name: string;
};

export type CategoryFormValue = {
  id?: string;
  name?: string | undefined;
  slug?: string | undefined;
  description?: string | undefined;
  parentId?: string | undefined;
};

type CategoryFormProps = {
  action: (state: CategoryActionState, formData: FormData) => Promise<CategoryActionState>;
  category?: CategoryFormValue;
  parentOptions: CategoryFormOption[];
  submitLabel: string;
};

const initialState: CategoryActionState = {
  status: "idle"
};

export function CategoryForm({ action, category, parentOptions, submitLabel }: CategoryFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(category?.slug));

  function handleNameChange(value: string) {
    setName(value);

    if (!slugTouched) {
      setSlug(normalizeSlug(value));
    }
  }

  return (
    <form action={formAction} className="resource-form compact-form">
      {state.status === "error" ? <p className="form-error">{state.message}</p> : null}
      <div className="form-grid">
        <FieldError errors={state.fieldErrors} name="name">
          <label>
            Name
            <input
              name="name"
              onChange={(event) => handleNameChange(event.target.value)}
              required
              type="text"
              value={name}
            />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="slug">
          <label>
            Slug
            <input
              name="slug"
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(normalizeSlug(event.target.value));
              }}
              type="text"
              value={slug}
            />
          </label>
        </FieldError>
      </div>
      <FieldError errors={state.fieldErrors} name="description">
        <label>
          Description
          <textarea defaultValue={category?.description} name="description" rows={4} />
        </label>
      </FieldError>
      <FieldError errors={state.fieldErrors} name="parentId">
        <label>
          Parent category
          <select defaultValue={category?.parentId ?? ""} name="parentId">
            <option value="">No parent</option>
            {parentOptions
              .filter((option) => option.id !== category?.id)
              .map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
          </select>
        </label>
      </FieldError>
      <div className="form-actions">
        <Button className="primary action-button" disabled={isPending} type="submit">
          {isPending ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function FieldError({
  children,
  errors,
  name
}: {
  children: ReactNode;
  errors?: Record<string, string> | undefined;
  name: string;
}) {
  return (
    <div className="field-shell">
      {children}
      {errors?.[name] ? <span className="field-error">{errors[name]}</span> : null}
    </div>
  );
}
