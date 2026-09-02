"use client";

import { Button } from "@dash/ui";
import { useActionState, useCallback, useMemo, useState, type ReactNode } from "react";
import { normalizeSlug } from "../../../lib/slug";
import { mediaUploadHintForUsage } from "../../media/media.schema";
import { GenerateWithAiButton } from "../../product-content/components/generate-with-ai-button";
import {
  PRODUCT_CONTENT_FIELD_META,
  PRODUCT_CONTENT_LIMITS,
  type ProductContentDraftContext,
  type ProductContentField
} from "../../product-content/product-content.schema";
import { ProductRelationsEditor } from "../../merchandising/components/product-relations-editor";
import type {
  ProductRelationOption,
  ProductRelationSelections,
  ProductRelationSuggestion
} from "../../merchandising/merchandising.service";
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

/**
 * The five fields that live on `ProductContent` rather than `Product`, edited
 * here so the seller writes a product's whole content in one form instead of
 * finishing it in a second place.
 */
export type ProductFormContent = {
  features?: string | undefined;
  keywords?: string | undefined;
  metaDescription?: string | undefined;
  seoTitle?: string | undefined;
  socialCaption?: string | undefined;
};

export type ProductFormValue = {
  id?: string;
  title?: string;
  slug?: string;
  content?: ProductFormContent | undefined;
  shortDescription?: string | undefined;
  description?: string | undefined;
  sku?: string | undefined;
  price?: string | undefined;
  compareAtPrice?: string | undefined;
  costPrice?: string | undefined;
  stockQuantity?: number;
  lowStockThreshold?: number;
  allowPreorder?: boolean;
  freeShipping?: boolean;
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
  /** False when the store's plan has no StoreIM AI. The fields stay editable. */
  aiEnabled: boolean;
  brands: ProductFormCategory[];
  categories: ProductFormCategory[];
  /** Only used to price the products offered in the upsell picker. */
  currency: string;
  product?: ProductFormValue;
  platformDomain: string;
  relationCandidates: ProductRelationOption[];
  relationSelections: ProductRelationSelections;
  relationSuggestions: ProductRelationSuggestion[];
  storeSlug: string;
  submitLabel: string;
  tags: ProductFormCategory[];
};

const initialState: ProductActionState = {
  status: "idle"
};

export function ProductForm({
  action,
  aiEnabled,
  brands,
  categories,
  currency,
  product,
  platformDomain,
  relationCandidates,
  relationSelections,
  relationSuggestions,
  storeSlug,
  submitLabel,
  tags
}: ProductFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [title, setTitle] = useState(product?.title ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  // Controlled from here down, because the Generate buttons write into them.
  const [shortDescription, setShortDescription] = useState(product?.shortDescription ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [features, setFeatures] = useState(product?.content?.features ?? "");
  const [seoTitle, setSeoTitle] = useState(product?.content?.seoTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(product?.content?.metaDescription ?? "");
  const [keywords, setKeywords] = useState(product?.content?.keywords ?? "");
  const [socialCaption, setSocialCaption] = useState(product?.content?.socialCaption ?? "");
  const [productPrice, setProductPrice] = useState(product?.price ?? "");
  const [productSku, setProductSku] = useState(product?.sku ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(product?.slug));
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    product?.categoryIds?.length
      ? product.categoryIds
      : product?.categoryId
        ? [product.categoryId]
        : []
  );
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
  const domainPreview = useMemo(
    () => (slug ? `${storeSlug}.${platformDomain}/products/${slug}` : ""),
    [platformDomain, slug, storeSlug]
  );
  const imageUrls = product?.imageUrls ?? [];

  /**
   * What the AI is told about the product being edited.
   *
   * Read at click time rather than at render time, so a title typed thirty
   * seconds ago and a category picked two seconds ago are both in it. Null when
   * there is no title yet: every field is written *from* the product name, and a
   * draft generated from nothing would be a draft about nothing.
   *
   * Taxonomy is sent as names, not ids. They are the words the seller chose for
   * this product, and copy in their own vocabulary needs less editing.
   */
  const draftContext = useCallback((): ProductContentDraftContext | null => {
    const productTitle = title.trim();

    if (productTitle.length < 2) {
      return null;
    }

    const names = (options: ProductFormCategory[], ids: string[]) =>
      options.filter((option) => ids.includes(option.id)).map((option) => option.name);

    return {
      brand: names(brandOptions, selectedBrandIds)[0] ?? null,
      categoryName: names(categoryOptions, selectedCategoryIds)[0] ?? null,
      description: description.trim() || null,
      features: features.trim() || null,
      keywords: keywords.trim() || null,
      price: productPrice.trim() || null,
      shortDescription: shortDescription.trim() || null,
      sku: productSku.trim() || null,
      tags: names(tagOptions, selectedTagIds),
      title: productTitle
    };
  }, [
    brandOptions,
    categoryOptions,
    description,
    features,
    keywords,
    productPrice,
    productSku,
    selectedBrandIds,
    selectedCategoryIds,
    selectedTagIds,
    shortDescription,
    tagOptions,
    title
  ]);

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

    setCategoryOptions((current) =>
      [...current, result.category].sort((a, b) => a.name.localeCompare(b.name))
    );
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

    setTagOptions((current) =>
      [...current, result.item].sort((a, b) => a.name.localeCompare(b.name))
    );
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

    setBrandOptions((current) =>
      [...current, result.item].sort((a, b) => a.name.localeCompare(b.name))
    );
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
                <FieldHeading
                  aiEnabled={aiEnabled}
                  field="title"
                  getContext={draftContext}
                  label="Title"
                  onGenerated={handleTitleChange}
                />
                <input
                  aria-label="Title"
                  name="title"
                  onChange={(event) => handleTitleChange(event.target.value)}
                  placeholder="Breathable Mesh Cap"
                  required
                  type="text"
                  value={title}
                />
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
            <AiField
              aiEnabled={aiEnabled}
              errors={state.fieldErrors}
              field="shortDescription"
              getContext={draftContext}
              name="shortDescription"
              onChange={setShortDescription}
              placeholder="A short product summary for cards and product pages."
              value={shortDescription}
            />
            <AiField
              aiEnabled={aiEnabled}
              errors={state.fieldErrors}
              field="description"
              getContext={draftContext}
              name="description"
              onChange={setDescription}
              placeholder="Describe the product, materials, and benefits."
              rows={6}
              value={description}
            />
          </ProductEditorCard>

          <ProductEditorCard
            description="Highlights, the search-engine fields, and a ready-to-paste social caption. Every one of them can be written for you."
            title="Content, SEO and social"
          >
            <AiField
              aiEnabled={aiEnabled}
              errors={state.fieldErrors}
              field="features"
              getContext={draftContext}
              name="features"
              onChange={setFeatures}
              placeholder={"Breathable mesh panel\nAdjustable strap\nMachine washable"}
              rows={4}
              value={features}
            />
            <AiField
              aiEnabled={aiEnabled}
              errors={state.fieldErrors}
              field="seoTitle"
              getContext={draftContext}
              name="seoTitle"
              onChange={setSeoTitle}
              placeholder="Breathable Mesh Cap | Your Store"
              showLimit
              value={seoTitle}
            />
            <AiField
              aiEnabled={aiEnabled}
              errors={state.fieldErrors}
              field="metaDescription"
              getContext={draftContext}
              name="metaDescription"
              onChange={setMetaDescription}
              placeholder="Shown under the title in search results."
              rows={2}
              showLimit
              value={metaDescription}
            />
            <AiField
              aiEnabled={aiEnabled}
              errors={state.fieldErrors}
              field="keywords"
              getContext={draftContext}
              name="keywords"
              onChange={setKeywords}
              placeholder="mesh cap, summer cap, breathable hat"
              value={keywords}
            />
            <AiField
              aiEnabled={aiEnabled}
              errors={state.fieldErrors}
              field="socialCaption"
              getContext={draftContext}
              name="socialCaption"
              onChange={setSocialCaption}
              placeholder="Write the Facebook or Instagram post for this product."
              rows={3}
              value={socialCaption}
            />
            {product?.id ? (
              <p className="product-editor-hint">
                Want all eight fields side by side, with a review step?{" "}
                <a href={`/dashboard/products/${product.id}/content`}>Open the AI Content Studio</a>
                .
              </p>
            ) : null}
          </ProductEditorCard>

          <ProductEditorCard
            description="Use one main image and up to three gallery images."
            title="Media"
          >
            {state.fieldErrors?.images ? (
              <p className="field-error">{state.fieldErrors.images}</p>
            ) : null}
            <ProductImageSlots imageUrls={imageUrls} />
            <p className="product-editor-hint">
              Gallery limit: 3 images. The storefront shows 4 images total including the main image.
            </p>
            <p className="product-editor-hint">{mediaUploadHintForUsage("PRODUCT")}</p>
          </ProductEditorCard>

          <ProductEditorCard
            description="Pricing, cost, and inventory tracking values."
            title="Pricing and inventory"
          >
            <div className="form-grid product-editor-money-grid">
              <MoneyField
                defaultValue={product?.price}
                errors={state.fieldErrors}
                label="Price"
                name="price"
                onChange={setProductPrice}
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
              <FieldError errors={state.fieldErrors} name="sku">
                <label>
                  SKU
                  <input
                    name="sku"
                    onChange={(event) => setProductSku(event.target.value)}
                    placeholder="SKU-001"
                    type="text"
                    value={productSku}
                  />
                </label>
              </FieldError>
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
              <FieldError errors={state.fieldErrors} name="freeShipping">
                <label className="field-check">
                  <input
                    defaultChecked={Boolean(product?.freeShipping)}
                    name="freeShipping"
                    type="checkbox"
                  />
                  Buying this earns free delivery
                  <small>
                    Any cart containing this product ships free, whatever it comes to. It is the
                    whole order that stops being charged, because delivery is one flat rate per
                    order — so it is worth reserving for products that can carry it. The zones you
                    picked under Shipping still apply.
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
          </ProductEditorCard>

          <ProductVariantsEditor
            attributes={product?.variantConfiguration?.attributes ?? []}
            basePrice={productPrice}
            baseSku={productSku}
            variants={product?.variantConfiguration?.variants ?? []}
          />

          <ProductRelationsEditor
            candidates={relationCandidates}
            currency={currency}
            productId={product?.id}
            selections={relationSelections}
            suggestions={relationSuggestions}
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
            {categoryMessage ? (
              <p className="product-editor-inline-message">{categoryMessage}</p>
            ) : null}

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

/**
 * The label row above a field, with its Generate button on the right.
 *
 * A `<span>` rather than a `<label>` wrapping the control, because a `<button>`
 * inside a label is also a click on the field that label points at. The control
 * carries its own `aria-label` instead, so the accessible name survives.
 */
function FieldHeading({
  aiEnabled,
  field,
  getContext,
  label,
  onGenerated
}: {
  aiEnabled: boolean;
  field: ProductContentField;
  getContext: () => ProductContentDraftContext | null;
  label: string;
  onGenerated: (value: string) => void;
}) {
  return (
    <span className="ai-field-head">
      <span className="ai-field-label">{label}</span>
      <GenerateWithAiButton
        disabled={!aiEnabled}
        field={field}
        getContext={getContext}
        onGenerated={onGenerated}
      />
    </span>
  );
}

/**
 * One content field: a heading row, the control, and an optional caption.
 *
 * The three parts are direct children of `FieldError`'s `.field-shell`, which is
 * already `display: grid` — so the control is full width by the same rule every
 * other field on this form has always used, rather than by a wrapper of its own.
 * That is deliberate after this layout broke once: a field that needs new CSS to
 * be the right width is a field that renders wrong the first time a stylesheet
 * is stale.
 *
 * `rows` chooses the control. A field whose value is one line stays an
 * `<input>`, matching the rest of the form; only genuinely multi-line copy gets
 * a textarea.
 */
function AiField({
  aiEnabled,
  errors,
  field,
  getContext,
  name,
  onChange,
  placeholder,
  rows,
  showLimit,
  value
}: {
  aiEnabled: boolean;
  errors?: Record<string, string> | undefined;
  field: ProductContentField;
  getContext: () => ProductContentDraftContext | null;
  name: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Omit for a single-line input. */
  rows?: number | undefined;
  /** Only where the ceiling is a real editorial constraint, such as SEO. */
  showLimit?: boolean | undefined;
  value: string;
}) {
  const meta = PRODUCT_CONTENT_FIELD_META[field];
  const limit = PRODUCT_CONTENT_LIMITS[field];

  return (
    <FieldError errors={errors} name={name}>
      <FieldHeading
        aiEnabled={aiEnabled}
        field={field}
        getContext={getContext}
        label={meta.label}
        onGenerated={onChange}
      />
      {rows ? (
        <textarea
          aria-label={meta.label}
          name={name}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={rows}
          value={value}
        />
      ) : (
        <input
          aria-label={meta.label}
          name={name}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type="text"
          value={value}
        />
      )}
      {showLimit ? (
        <p className="ai-field-foot">
          <span>{meta.description}</span>
          <span className={value.length > limit ? "ai-studio-count-over" : undefined}>
            {value.length} / {limit}
          </span>
        </p>
      ) : null}
    </FieldError>
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
        <input
          defaultValue={defaultValue}
          min={0}
          name={name}
          onChange={(event) => onChange?.(event.target.value)}
          required={required}
          step="0.01"
          type="number"
        />
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
