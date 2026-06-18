"use client";

import { Button } from "@dash/ui";
import { useActionState, useMemo, useState, type ReactNode } from "react";
import { normalizeSlug } from "../../../lib/slug";
import type { ProductActionState } from "../product.actions";

export type ProductFormCategory = {
  id: string;
  name: string;
};

export type ProductFormValue = {
  id?: string;
  title?: string;
  slug?: string;
  shortDescription?: string | undefined;
  description?: string | undefined;
  sku?: string | undefined;
  price?: string | undefined;
  compareAtPrice?: string | undefined;
  costPrice?: string | undefined;
  stockQuantity?: number;
  lowStockThreshold?: number;
  categoryId?: string | undefined;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  visibility?: "PUBLIC" | "HIDDEN";
  imageUrls?: string | undefined;
};

type ProductFormProps = {
  action: (state: ProductActionState, formData: FormData) => Promise<ProductActionState>;
  categories: ProductFormCategory[];
  product?: ProductFormValue;
  submitLabel: string;
};

const initialState: ProductActionState = {
  status: "idle"
};

export function ProductForm({ action, categories, product, submitLabel }: ProductFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [title, setTitle] = useState(product?.title ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(product?.slug));
  const domainPreview = useMemo(() => (slug ? `${slug}.dash.com/products/${slug}` : ""), [slug]);

  function handleTitleChange(value: string) {
    setTitle(value);

    if (!slugTouched) {
      setSlug(normalizeSlug(value));
    }
  }

  return (
    <form action={formAction} className="resource-form">
      {state.status === "error" ? <p className="form-error">{state.message}</p> : null}
      <div className="form-grid">
        <FieldError errors={state.fieldErrors} name="title">
          <label>
            Title
            <input
              name="title"
              onChange={(event) => handleTitleChange(event.target.value)}
              required
              type="text"
              value={title}
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
      {domainPreview ? <p className="domain-preview">{domainPreview}</p> : null}
      <FieldError errors={state.fieldErrors} name="shortDescription">
        <label>
          Short description
          <input
            defaultValue={product?.shortDescription}
            name="shortDescription"
            type="text"
          />
        </label>
      </FieldError>
      <FieldError errors={state.fieldErrors} name="description">
        <label>
          Description
          <textarea defaultValue={product?.description} name="description" rows={5} />
        </label>
      </FieldError>
      <div className="form-grid">
        <FieldError errors={state.fieldErrors} name="sku">
          <label>
            SKU
            <input defaultValue={product?.sku} name="sku" type="text" />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="categoryId">
          <label>
            Category
            <select defaultValue={product?.categoryId ?? ""} name="categoryId">
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </FieldError>
      </div>
      <div className="form-grid">
        <MoneyField
          defaultValue={product?.price}
          errors={state.fieldErrors}
          label="Price"
          name="price"
          required
        />
        <MoneyField
          defaultValue={product?.compareAtPrice}
          errors={state.fieldErrors}
          label="Compare-at price"
          name="compareAtPrice"
        />
        <MoneyField
          defaultValue={product?.costPrice}
          errors={state.fieldErrors}
          label="Cost price"
          name="costPrice"
        />
        <FieldError errors={state.fieldErrors} name="stockQuantity">
          <label>
            Stock
            <input
              defaultValue={product?.stockQuantity ?? 0}
              min={0}
              name="stockQuantity"
              required
              type="number"
            />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="lowStockThreshold">
          <label>
            Low stock threshold
            <input
              defaultValue={product?.lowStockThreshold ?? 0}
              min={0}
              name="lowStockThreshold"
              required
              type="number"
            />
          </label>
        </FieldError>
      </div>
      <div className="form-grid">
        <label>
          Status
          <select defaultValue={product?.status ?? "DRAFT"} name="status">
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>
        <label>
          Visibility
          <select defaultValue={product?.visibility ?? "HIDDEN"} name="visibility">
            <option value="HIDDEN">Hidden</option>
            <option value="PUBLIC">Public</option>
          </select>
        </label>
      </div>
      <FieldError errors={state.fieldErrors} name="images">
        <label>
          Image URLs
          <textarea
            defaultValue={product?.imageUrls}
            name="imageUrls"
            placeholder="https://example.com/product.jpg"
            rows={4}
          />
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

function MoneyField({
  defaultValue,
  errors,
  label,
  name,
  required
}: {
  defaultValue?: string | undefined;
  errors?: Record<string, string> | undefined;
  label: string;
  name: string;
  required?: boolean | undefined;
}) {
  return (
    <FieldError errors={errors} name={name}>
      <label>
        {label}
        <input
          defaultValue={defaultValue}
          min={0}
          name={name}
          required={required}
          step="0.01"
          type="number"
        />
      </label>
    </FieldError>
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
