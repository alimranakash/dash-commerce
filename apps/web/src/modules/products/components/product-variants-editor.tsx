"use client";

import { Copy, ImagePlus, Plus, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { MediaPicker } from "../../media/components/media-picker";
import type { ProductAttributeInput, ProductVariantRecord } from "../product-variants.service";

type ProductVariantsEditorProps = {
  attributes?: ProductAttributeInput[];
  basePrice?: string | undefined;
  baseSku?: string | undefined;
  variants?: ProductVariantRecord[];
};

type AttributeDraft = {
  id: string;
  name: string;
  values: Array<{
    id: string;
    name: string;
  }>;
};

type VariantDraft = ProductVariantRecord & {
  draftId: string;
};

export function ProductVariantsEditor({
  attributes = [],
  basePrice,
  baseSku,
  variants = []
}: ProductVariantsEditorProps) {
  const [attributeDrafts, setAttributeDrafts] = useState<AttributeDraft[]>(() => (
    attributes.length
      ? attributes.map((attribute) => ({
          id: attribute.id || crypto.randomUUID(),
          name: attribute.name,
          values: attribute.values.map((value) => ({
            id: value.id || crypto.randomUUID(),
            name: value.name
          }))
        }))
      : []
  ));
  const [variantDrafts, setVariantDrafts] = useState<VariantDraft[]>(() => variants.map((variant) => ({
    ...variant,
    draftId: variant.id || crypto.randomUUID()
  })));
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [bulkField, setBulkField] = useState("price");
  const [bulkValue, setBulkValue] = useState("");

  const cleanAttributes = useMemo(
    () => attributeDrafts
      .map((attribute, position) => ({
        id: attribute.id,
        name: attribute.name.trim(),
        position,
        values: attribute.values
          .map((value, valuePosition) => ({
            id: value.id,
            name: value.name.trim(),
            position: valuePosition
          }))
          .filter((value) => value.name.length > 0)
      }))
      .filter((attribute) => attribute.name.length > 0 && attribute.values.length > 0),
    [attributeDrafts]
  );
  const serializedAttributes = JSON.stringify(cleanAttributes);
  const serializedVariants = JSON.stringify(variantDrafts.map((variant, position) => ({
    barcode: variant.barcode ?? null,
    compareAtPrice: optionalMoney(variant.compareAtPrice),
    continueSelling: Boolean(variant.continueSelling),
    costPrice: optionalMoney(variant.costPrice),
    dimensions: variant.dimensions ?? null,
    imageUrl: variant.imageUrl ?? null,
    lowStockThreshold: Number(variant.lowStockThreshold || 0),
    optionSignature: variant.optionSignature,
    options: variant.options,
    price: variant.price || basePrice || "0",
    shippingClass: variant.shippingClass ?? null,
    sku: variant.sku ?? null,
    status: variant.status,
    stockQuantity: Number(variant.stockQuantity || 0),
    taxClass: variant.taxClass ?? null,
    title: variant.title,
    weight: variant.weight ?? null,
    position
  })));

  function addAttribute() {
    setAttributeDrafts((current) => [...current, {
      id: crypto.randomUUID(),
      name: "",
      values: [{ id: crypto.randomUUID(), name: "" }]
    }]);
  }

  function updateAttribute(attributeId: string, name: string) {
    setAttributeDrafts((current) => current.map((attribute) => attribute.id === attributeId ? { ...attribute, name } : attribute));
  }

  function removeAttribute(attributeId: string) {
    setAttributeDrafts((current) => current.filter((attribute) => attribute.id !== attributeId));
  }

  function moveAttribute(attributeId: string, direction: -1 | 1) {
    setAttributeDrafts((current) => moveItem(current, current.findIndex((attribute) => attribute.id === attributeId), direction));
  }

  function addAttributeValue(attributeId: string) {
    setAttributeDrafts((current) => current.map((attribute) => attribute.id === attributeId ? {
      ...attribute,
      values: [...attribute.values, { id: crypto.randomUUID(), name: "" }]
    } : attribute));
  }

  function updateAttributeValue(attributeId: string, valueId: string, name: string) {
    setAttributeDrafts((current) => current.map((attribute) => attribute.id === attributeId ? {
      ...attribute,
      values: attribute.values.map((value) => value.id === valueId ? { ...value, name } : value)
    } : attribute));
  }

  function removeAttributeValue(attributeId: string, valueId: string) {
    setAttributeDrafts((current) => current.map((attribute) => attribute.id === attributeId ? {
      ...attribute,
      values: attribute.values.filter((value) => value.id !== valueId)
    } : attribute));
  }

  function moveAttributeValue(attributeId: string, valueId: string, direction: -1 | 1) {
    setAttributeDrafts((current) => current.map((attribute) => {
      if (attribute.id !== attributeId) return attribute;

      return {
        ...attribute,
        values: moveItem(attribute.values, attribute.values.findIndex((value) => value.id === valueId), direction)
      };
    }));
  }

  function generateVariants() {
    const combinations = cartesianProduct(cleanAttributes.map((attribute) => attribute.values.map((value) => ({
      attribute: attribute.name,
      value: value.name
    }))));
    const existing = new Map(variantDrafts.map((variant) => [variant.optionSignature, variant]));
    const generated = combinations.map((combination) => {
      const options = Object.fromEntries(combination.map((item) => [item.attribute, item.value]));
      const signature = signatureForOptions(options);
      const title = Object.values(options).join(" / ");
      const existingVariant = existing.get(signature);

      return existingVariant ?? {
        barcode: null,
        compareAtPrice: null,
        continueSelling: false,
        costPrice: null,
        dimensions: null,
        draftId: crypto.randomUUID(),
        id: crypto.randomUUID(),
        imageUrl: null,
        lowStockThreshold: 0,
        optionSignature: signature,
        options,
        price: basePrice || "0",
        shippingClass: null,
        sku: "",
        status: "ACTIVE" as const,
        stockQuantity: 0,
        taxClass: null,
        title,
        weight: null
      };
    });

    setVariantDrafts(generated);
    setConfirmGenerate(false);
  }

  function updateVariant(draftId: string, patch: Partial<VariantDraft>) {
    setVariantDrafts((current) => current.map((variant) => variant.draftId === draftId ? { ...variant, ...patch } : variant));
  }

  function removeVariant(draftId: string) {
    setVariantDrafts((current) => current.filter((variant) => variant.draftId !== draftId));
  }

  function duplicateVariant(draftId: string) {
    const variant = variantDrafts.find((item) => item.draftId === draftId);

    if (!variant) return;

    setVariantDrafts((current) => [...current, {
      ...variant,
      draftId: crypto.randomUUID(),
      id: crypto.randomUUID(),
      optionSignature: `${variant.optionSignature}__copy_${Date.now()}`,
      sku: variant.sku ? `${variant.sku}-COPY` : "",
      title: `${variant.title} Copy`
    }]);
  }

  function autoGenerateSkus() {
    const parentSku = (baseSku || "SKU").trim() || "SKU";

    setVariantDrafts((current) => current.map((variant) => ({
      ...variant,
      sku: `${skuToken(parentSku)}-${Object.values(variant.options).map(skuToken).join("-")}`
    })));
  }

  function applyBulkUpdate() {
    if (!bulkValue.trim()) return;

    setVariantDrafts((current) => current.map((variant) => {
      if (bulkField === "price") return { ...variant, price: bulkValue };
      if (bulkField === "compareAtPrice") return { ...variant, compareAtPrice: bulkValue };
      if (bulkField === "stockQuantity") return { ...variant, stockQuantity: Number(bulkValue) || 0 };
      if (bulkField === "status") return { ...variant, status: bulkValue === "INACTIVE" ? "INACTIVE" : "ACTIVE" };

      return variant;
    }));
    setBulkValue("");
  }

  return (
    <div className="variant-workflow">
      <input name="productAttributesJson" type="hidden" value={serializedAttributes} />
      <input name="productVariantsJson" type="hidden" value={serializedVariants} />

      <section className="product-editor-card variant-section-card">
        <div className="variant-section-heading">
          <div>
            <h3>Attributes</h3>
            <p>Create options such as Color, Size, Material, Storage, or Capacity.</p>
          </div>
          <button className="variant-secondary-button" onClick={addAttribute} type="button">
            <Plus className="h-4 w-4" /> Add attribute
          </button>
        </div>
        <div className="attribute-card-list">
          {attributeDrafts.length ? attributeDrafts.map((attribute, index) => (
            <AttributeCard
              attribute={attribute}
              canMoveDown={index < attributeDrafts.length - 1}
              canMoveUp={index > 0}
              key={attribute.id}
              onAddValue={addAttributeValue}
              onMove={moveAttribute}
              onMoveValue={moveAttributeValue}
              onRemove={removeAttribute}
              onRemoveValue={removeAttributeValue}
              onUpdate={updateAttribute}
              onUpdateValue={updateAttributeValue}
            />
          )) : (
            <div className="variant-empty-state">
              <ImagePlus className="h-5 w-5" />
              Add attributes to generate product variants.
            </div>
          )}
        </div>
      </section>

      <section className="product-editor-card variant-section-card">
        <div className="variant-section-heading">
          <div>
            <h3>Generate Variants</h3>
            <p>Generate every possible option combination without duplicates.</p>
          </div>
          <button className="variant-primary-button" disabled={cleanAttributes.length === 0} onClick={() => setConfirmGenerate(true)} type="button">
            <Sparkles className="h-4 w-4" /> Generate Variants
          </button>
        </div>
        <p className="product-editor-hint">
          Example: Color Red/Blue + Size M/L creates Red / M, Red / L, Blue / M, and Blue / L.
        </p>
      </section>

      <section className="product-editor-card variant-section-card">
        <div className="variant-section-heading">
          <div>
            <h3>Variants Table</h3>
            <p>Edit SKU, pricing, stock, status, and variant image for each combination.</p>
          </div>
          <button className="variant-secondary-button" disabled={variantDrafts.length === 0} onClick={autoGenerateSkus} type="button">
            Auto Generate SKU
          </button>
        </div>

        <div className="variant-bulk-editor">
          <select onChange={(event) => setBulkField(event.target.value)} value={bulkField}>
            <option value="price">Price</option>
            <option value="compareAtPrice">Compare Price</option>
            <option value="stockQuantity">Stock</option>
            <option value="status">Status</option>
          </select>
          {bulkField === "status" ? (
            <select onChange={(event) => setBulkValue(event.target.value)} value={bulkValue}>
              <option value="">Choose status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          ) : (
            <input onChange={(event) => setBulkValue(event.target.value)} placeholder="Bulk value" value={bulkValue} />
          )}
          <button onClick={applyBulkUpdate} type="button">Apply</button>
        </div>

        <div className="variant-table-wrap">
          <table className="variant-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Variant</th>
                <th>SKU</th>
                <th>Price</th>
                <th>Compare Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {variantDrafts.length ? variantDrafts.map((variant, index) => (
                <VariantRow
                  index={index}
                  key={variant.draftId}
                  onDuplicate={duplicateVariant}
                  onRemove={removeVariant}
                  onUpdate={updateVariant}
                  variant={variant}
                />
              )) : (
                <tr><td className="variant-empty-row" colSpan={8}>No variants generated yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {confirmGenerate ? (
        <div className="variant-modal-backdrop" role="dialog" aria-modal="true" aria-label="Generate variants">
          <div className="variant-modal">
            <h3>Generate Variants</h3>
            <p>This will generate combinations from your current attributes. Existing matching variants will be preserved and duplicates will be skipped.</p>
            <div>
              <button className="variant-secondary-button" onClick={() => setConfirmGenerate(false)} type="button">Cancel</button>
              <button className="variant-primary-button" onClick={generateVariants} type="button">Generate</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AttributeCard({
  attribute,
  canMoveDown,
  canMoveUp,
  onAddValue,
  onMove,
  onMoveValue,
  onRemove,
  onRemoveValue,
  onUpdate,
  onUpdateValue
}: {
  attribute: AttributeDraft;
  canMoveDown: boolean;
  canMoveUp: boolean;
  onAddValue: (attributeId: string) => void;
  onMove: (attributeId: string, direction: -1 | 1) => void;
  onMoveValue: (attributeId: string, valueId: string, direction: -1 | 1) => void;
  onRemove: (attributeId: string) => void;
  onRemoveValue: (attributeId: string, valueId: string) => void;
  onUpdate: (attributeId: string, name: string) => void;
  onUpdateValue: (attributeId: string, valueId: string, name: string) => void;
}) {
  return (
    <article className="attribute-card">
      <div className="attribute-card-header">
        <input onChange={(event) => onUpdate(attribute.id, event.target.value)} placeholder="Color" value={attribute.name} />
        <div>
          <button disabled={!canMoveUp} onClick={() => onMove(attribute.id, -1)} type="button">Up</button>
          <button disabled={!canMoveDown} onClick={() => onMove(attribute.id, 1)} type="button">Down</button>
          <button aria-label={`Delete ${attribute.name || "attribute"}`} onClick={() => onRemove(attribute.id)} type="button"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="attribute-values">
        {attribute.values.map((value, index) => (
          <div className="attribute-value-row" key={value.id}>
            <input onChange={(event) => onUpdateValue(attribute.id, value.id, event.target.value)} placeholder="Black" value={value.name} />
            <button disabled={index === 0} onClick={() => onMoveValue(attribute.id, value.id, -1)} type="button">Up</button>
            <button disabled={index === attribute.values.length - 1} onClick={() => onMoveValue(attribute.id, value.id, 1)} type="button">Down</button>
            <button aria-label={`Delete ${value.name || "value"}`} onClick={() => onRemoveValue(attribute.id, value.id)} type="button"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
      <button className="variant-secondary-button" onClick={() => onAddValue(attribute.id)} type="button">
        <Plus className="h-4 w-4" /> Add value
      </button>
    </article>
  );
}

function VariantRow({
  index,
  onDuplicate,
  onRemove,
  onUpdate,
  variant
}: {
  index: number;
  onDuplicate: (draftId: string) => void;
  onRemove: (draftId: string) => void;
  onUpdate: (draftId: string, patch: Partial<VariantDraft>) => void;
  variant: VariantDraft;
}) {
  return (
    <tr>
      <td>
        <VariantImageUploader
          index={index}
          onChange={(imageUrl) => onUpdate(variant.draftId, { imageUrl })}
          value={variant.imageUrl ?? null}
        />
      </td>
      <td><strong>{variant.title}</strong></td>
      <td><input onChange={(event) => onUpdate(variant.draftId, { sku: event.target.value })} value={variant.sku ?? ""} /></td>
      <td><input min={0} onChange={(event) => onUpdate(variant.draftId, { price: event.target.value })} step="0.01" type="number" value={variant.price} /></td>
      <td><input min={0} onChange={(event) => onUpdate(variant.draftId, { compareAtPrice: event.target.value })} step="0.01" type="number" value={variant.compareAtPrice ?? ""} /></td>
      <td>
        <input min={0} onChange={(event) => onUpdate(variant.draftId, { stockQuantity: Number(event.target.value) || 0 })} type="number" value={variant.stockQuantity} />
        <label className="variant-mini-check">
          <input checked={Boolean(variant.continueSelling)} onChange={(event) => onUpdate(variant.draftId, { continueSelling: event.target.checked })} type="checkbox" />
          Continue selling
        </label>
      </td>
      <td>
        <select onChange={(event) => onUpdate(variant.draftId, { status: event.target.value === "INACTIVE" ? "INACTIVE" : "ACTIVE" })} value={variant.status}>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </td>
      <td>
        <div className="variant-row-actions">
          <button aria-label={`Duplicate ${variant.title}`} onClick={() => onDuplicate(variant.draftId)} type="button"><Copy className="h-4 w-4" /></button>
          <button aria-label={`Delete ${variant.title}`} onClick={() => onRemove(variant.draftId)} type="button"><Trash2 className="h-4 w-4" /></button>
        </div>
      </td>
    </tr>
  );
}

function VariantImageUploader({
  index,
  onChange,
  value
}: {
  index: number;
  onChange: (imageUrl: string) => void;
  value?: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="variant-image-uploader">
      <input name={`variantImageUrl${index}`} type="hidden" value={value ?? ""} />
      <button className="variant-image-drop" onClick={() => setOpen(true)} type="button">
        {value ? <img alt="" src={value} /> : <ImagePlus className="h-5 w-5" />}
        {value ? null : <span>Add</span>}
      </button>
      {value ? (
        <button className="variant-image-clear" onClick={() => onChange("")} type="button">
          Remove
        </button>
      ) : null}
      <MediaPicker
        onClose={() => setOpen(false)}
        onSelect={(picked) => {
          const first = picked[0];

          if (first) {
            onChange(first.url);
          }
        }}
        open={open}
        title="Select variant image"
        usageType="PRODUCT"
      />
    </div>
  );
}

function cartesianProduct<T>(sets: T[][]): T[][] {
  if (sets.length === 0 || sets.some((set) => set.length === 0)) {
    return [];
  }

  return sets.reduce<T[][]>((acc, set) => acc.flatMap((items) => set.map((item) => [...items, item])), [[]]);
}

function signatureForOptions(options: Record<string, string>) {
  return Object.entries(options)
    .map(([key, value]) => `${key}:${value}`)
    .join("|")
    .toLowerCase();
}

function skuToken(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function optionalMoney(value: string | null | undefined) {
  return value?.trim() ? value : null;
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;

  if (index < 0 || nextIndex < 0 || nextIndex >= items.length) {
    return items;
  }

  const next = [...items];
  const [item] = next.splice(index, 1);

  if (item !== undefined) {
    next.splice(nextIndex, 0, item);
  }

  return next;
}
