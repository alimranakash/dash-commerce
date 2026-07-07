"use client";

import { Button } from "@dash/ui";
import { useActionState, useState, type ReactNode } from "react";
import { normalizeSlug } from "../../../lib/slug";
import type { MediaPickerAsset } from "../../media/media.types";
import { UploadField } from "../../settings/components/theme-form-fields";
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
  imageUrl?: string | null | undefined;
  parentId?: string | undefined;
};

type CategoryFormProps = {
  action: (state: CategoryActionState, formData: FormData) => Promise<CategoryActionState>;
  category?: CategoryFormValue;
  mediaAssets?: MediaPickerAsset[];
  parentOptions: CategoryFormOption[];
  submitLabel: string;
};

const initialState: CategoryActionState = {
  status: "idle"
};

export function CategoryForm({ action, category, mediaAssets = [], parentOptions, submitLabel }: CategoryFormProps) {
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
    <form action={formAction} className="resource-form compact-form catalog-create-form">
      {state.status === "error" ? <p className="form-error">{state.message}</p> : null}
      <FieldError errors={state.fieldErrors} name="name">
        <label>
          Name
          <input
            name="name"
            onChange={(event) => handleNameChange(event.target.value)}
            placeholder="Enter name"
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
            placeholder="category-slug"
            type="text"
            value={slug}
          />
        </label>
      </FieldError>
      <FieldError errors={state.fieldErrors} name="description">
        <label>
          Description
          <textarea defaultValue={category?.description} name="description" rows={4} />
        </label>
      </FieldError>
      <FieldError errors={state.fieldErrors} name="imageUrl">
        <UploadField
          accept="image/jpeg,image/png,image/webp"
          assets={mediaAssets}
          fileName="imageFile"
          label="Category Image"
          name="imageUrl"
          value={category?.imageUrl}
        />
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
        <Button className="catalog-submit-button" disabled={isPending} type="submit">
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
