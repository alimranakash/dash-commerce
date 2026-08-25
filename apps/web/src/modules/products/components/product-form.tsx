"use client";

import { Button } from "@dash/ui";
import { useActionState, useMemo, useState, type ReactNode } from "react";
import { normalizeSlug } from "../../../lib/slug";
import { mediaUploadHintForUsage } from "../../media/media.schema";
import {
  quickCreateProductBrandAction,
  quickCreateProductCategoryAction,
  quickCreateProductTagAction,
  type ProductActionState
} from "../product.actions";
import type { ProductVariantConfiguration } from "../product-variants.service";
import { ProductImageSlots } from "./product-image-slots";
import { ProductVariantsEditor } from "./product-variants-editor";
import { TaxonomyMultiSelect, type TaxonomyOption } from "./taxonomy-multi-select";

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
  allowPreorder?: boolean;
  preorderReleaseAt?: Date | string | null;
  categoryId?: string | undefined;
  categoryIds?: string[] | undefined;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  visibility?: "PUBLIC" | "HIDDEN";
  brandIds?: string[] | undefined;
  imageUrls?: string[] | undefined;
  tagIds?: string[] | undefined;
  variantConfiguration?: ProductVariantConfiguration | undefined;
};

type ProductFormProps = {
  action: (state: ProductActionState, formData: FormData) => Promise<ProductActionState>;
  brands: ProductFormCategory[];
  categories: ProductFormCategory[];
  product?: ProductFormValue;
  platformDomain: string;
  storeSlug: string;
  submitLabel: string;
  tags: ProductFormCategory[];
};

const initialState: ProductActionState = {
  status: "idle"
};

export function ProductForm({
  action,
  brands,
  categories,
  product,
  platformDomain,
  storeSlug,
  submitLabel,
  tags
}: ProductFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [title, setTitle] = useState(product?.title ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [productPrice, setProductPrice] = useState(product?.price ?? "");
  const [productSku, setProductSku] = useState(product?.sku ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(product?.slug));
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(product?.categoryIds?.length ? product.categoryIds : product?.categoryId ? [product.categoryId] : []);
  const [categoryMessage, setCategoryMessage] = useState<string | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [tagOptions, setTagOptions] = useState(tags);
  const [brandOptions, setBrandOptions] = useState(brands);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(product?.tagIds ?? []);
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>(product?.brandIds ?? []);
  const [tagMessage, setTagMessage] = useState<string | null>(null);
  const [brandMessage, setBrandMessage] = useState<string | null>(null);
  const [creatingTag, setCreatingTag] = useState(false);
  const [creatingBrand, setCreatingBrand] = useState(false);
  const domainPreview = useMemo(() => (slug ? `${storeSlug}.${platformDomain}/products/${slug}` : ""), [platformDomain, slug, storeSlug]);
  const imageUrls = product?.imageUrls ?? [];

  function handleTitleChange(value: string) {
    setTitle(value);

    if (!slugTouched) {
      setSlug(normalizeSlug(value));
    }
  }

  async function quickCreateCategory(name: string): Promise<TaxonomyOption | null> {
    setCategoryMessage(null);
    setCreatingCategory(true);

    const result = await quickCreateProductCategoryAction(name);

    setCreatingCategory(false);

    if (!result.ok) {
      setCategoryMessage(result.error);
      return null;
    }

    setCategoryOptions((current) => [...current, result.category].sort((a, b) => a.name.localeCompare(b.name)));
    setCategoryMessage("Category created.");

    return result.category;
  }

  async function quickCreateTag(name: string): Promise<TaxonomyOption | null> {
    setTagMessage(null);
    setCreatingTag(true);

    const result = await quickCreateProductTagAction(name);

    setCreatingTag(false);

    if (!result.ok) {
      setTagMessage(result.error);
      return null;
    }

    setTagOptions((current) => [...current, result.item].sort((a, b) => a.name.localeCompare(b.name)));
    setTagMessage("Tag created.");

    return result.item;
  }

  async function quickCreateBrand(name: string): Promise<TaxonomyOption | null> {
    setBrandMessage(null);
    setCreatingBrand(true);

    const result = await quickCreateProductBrandAction(name);

    setCreatingBrand(false);

    if (!result.ok) {
      setBrandMessage(result.error);
      return null;
    }

    setBrandOptions((current) => [...current, result.item].sort((a, b) => a.name.localeCompare(b.name)));
    setBrandMessage("Brand created.");

    return result.item;
  }

  return (
    <form action={formAction} className="product-editor-form">
      {state.status === "error" ? <p className="form-error">{state.message}</p> : null}

      <div className="product-editor-layout">
        <div className="product-editor-main">
          <ProductEditorCard
            description="Name, URL, and customer-facing copy for this product."
            title="Basic Information"
          >
            <div className="form-grid">
              <FieldError errors={state.fieldErrors} name="title">
                <label>
                  Title
                  <input
                    name="title"
                    onChange={(event) => handleTitleChange(event.target.value)}
                    placeholder="Breathable Mesh Cap"
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
                    placeholder="breathable-mesh-cap"
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
                  placeholder="A short product summary for cards and product pages."
                  type="text"
                />
              </label>
            </FieldError>
            <FieldError errors={state.fieldErrors} name="description">
              <label>
                Description
                <textarea defaultValue={product?.description} name="description" placeholder="Describe the product, materials, and benefits." rows={6} />
              </label>
            </FieldError>
          </ProductEditorCard>

          <ProductEditorCard
            description="Use one main image and up to three gallery images."
            title="Media"
          >
            {state.fieldErrors?.images ? <p className="field-error">{state.fieldErrors.images}</p> : null}
            <ProductImageSlots imageUrls={imageUrls} />
            <p className="product-editor-hint">Gallery limit: 3 images. The storefront shows 4 images total including the main image.</p>
            <p className="product-editor-hint">{mediaUploadHintForUsage("PRODUCT")}</p>
          </ProductEditorCard>

          <ProductEditorCard
            description="Pricing, cost, and inventory tracking values."
            title="Pricing and inventory"
          >
            <div className="form-grid product-editor-money-grid">
              <MoneyField defaultValue={product?.price} errors={state.fieldErrors} label="Price" name="price" onChange={setProductPrice} required />
              <MoneyField defaultValue={product?.compareAtPrice} errors={state.fieldErrors} label="Compare-at price" name="compareAtPrice" />
              <MoneyField defaultValue={product?.costPrice} errors={state.fieldErrors} label="Cost price" name="costPrice" />
              <FieldError errors={state.fieldErrors} name="sku">
                <label>
                  SKU
                  <input name="sku" onChange={(event) => setProductSku(event.target.value)} placeholder="SKU-001" type="text" value={productSku} />
                </label>
              </FieldError>
              <FieldError errors={state.fieldErrors} name="stockQuantity">
                <label>
                  Stock
                  <input defaultValue={product?.stockQuantity ?? 0} min={0} name="stockQuantity" required type="number" />
                </label>
              </FieldError>
              <FieldError errors={state.fieldErrors} name="allowPreorder">
                <label className="field-check">
                  <input
                    defaultChecked={Boolean(product?.allowPreorder)}
                    name="allowPreorder"
                    type="checkbox"
                  />
                  Take pre-orders when this runs out
                  <small>
                    Customers can keep buying past zero and the stock goes negative, which is what
                    you still owe them. Say when it ships below.
                  </small>
                </label>
              </FieldError>
              <FieldError errors={state.fieldErrors} name="preorderReleaseAt">
                <label>
                  Pre-order ships on
                  <input
                    defaultValue={toDateInput(product?.preorderReleaseAt)}
                    name="preorderReleaseAt"
                    type="date"
                  />
                  <small>
                    Only used when pre-orders are on. Shown to the customer beside the button, so
                    they know what they are waiting for.
                  </small>
                </label>
              </FieldError>
              <FieldError errors={state.fieldErrors} name="lowStockThreshold">
                <label>
                  Low stock threshold
                  <input defaultValue={product?.lowStockThreshold ?? 0} min={0} name="lowStockThreshold" required type="number" />
                </label>
              </FieldError>
            </div>
          </ProductEditorCard>

          <ProductVariantsEditor
            attributes={product?.variantConfiguration?.attributes ?? []}
            basePrice={productPrice}
            baseSku={productSku}
            variants={product?.variantConfiguration?.variants ?? []}
          />
        </div>

        <aside className="product-editor-sidebar">
          <ProductEditorCard title="Publishing">
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
          </ProductEditorCard>

          <ProductEditorCard
            description="Organize products without leaving this form."
            title="Categories / Tags / Brands"
          >
            <FieldError errors={state.fieldErrors} name="categoryId">
              <TaxonomyMultiSelect
                createLabel="Create category"
                description="Select one or more categories. The first selected category stays compatible with the current product catalog."
                emptyLabel="No categories found."
                hiddenName="categoryIds"
                label="Categories"
                loading={creatingCategory}
                onChange={setSelectedCategoryIds}
                onCreate={quickCreateCategory}
                options={categoryOptions}
                placeholder="Search categories"
                primaryHiddenName="categoryId"
                selectedIds={selectedCategoryIds}
              />
            </FieldError>
            {categoryMessage ? <p className="product-editor-inline-message">{categoryMessage}</p> : null}

            <TaxonomyMultiSelect
              createLabel="Create tag"
              description="Add searchable tags for future filters and product grouping."
              emptyLabel="No tags found."
              hiddenName="tagIds"
              label="Tags"
              loading={creatingTag}
              onChange={setSelectedTagIds}
              onCreate={quickCreateTag}
              options={tagOptions}
              placeholder="Search tags"
              selectedIds={selectedTagIds}
            />
            {tagMessage ? <p className="product-editor-inline-message">{tagMessage}</p> : null}

            <TaxonomyMultiSelect
              createLabel="Create brand"
              description="Brands support multiple selections for future marketplace and filtering features."
              emptyLabel="No brands found."
              hiddenName="brandIds"
              label="Brands"
              loading={creatingBrand}
              onChange={setSelectedBrandIds}
              onCreate={quickCreateBrand}
              options={brandOptions}
              placeholder="Search brands"
              selectedIds={selectedBrandIds}
            />
            {brandMessage ? <p className="product-editor-inline-message">{brandMessage}</p> : null}
          </ProductEditorCard>

          <div className="product-editor-submit-card">
            <Button className="primary action-button" disabled={isPending} type="submit">
              {isPending ? "Saving..." : submitLabel}
            </Button>
          </div>
        </aside>
      </div>
    </form>
  );
}

function ProductEditorCard({
  children,
  description,
  title
}: {
  children: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <section className="product-editor-card">
      <header>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </header>
      <div className="product-editor-card-body">{children}</div>
    </section>
  );
}

function MoneyField({
  defaultValue,
  errors,
  label,
  name,
  onChange,
  required
}: {
  defaultValue?: string | undefined;
  errors?: Record<string, string> | undefined;
  label: string;
  name: string;
  onChange?: (value: string) => void;
  required?: boolean | undefined;
}) {
  return (
    <FieldError errors={errors} name={name}>
      <label>
        {label}
        <input defaultValue={defaultValue} min={0} name={name} onChange={(event) => onChange?.(event.target.value)} required={required} step="0.01" type="number" />
      </label>
    </FieldError>
  );
}

/** A Date, a string, or nothing, as the browsers  date input wants it. */
function toDateInput(value: Date | string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
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
