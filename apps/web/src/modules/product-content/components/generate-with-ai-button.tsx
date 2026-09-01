"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { generateProductContentAction } from "../product-content.actions";
import {
  PRODUCT_CONTENT_FIELD_META,
  type ProductContentDraftContext,
  type ProductContentField,
  type ProductContentSource
} from "../product-content.schema";

const SOURCE_LABELS: Record<ProductContentSource, string> = {
  gemini: "Written by Gemini",
  openai: "Written by OpenAI",
  storeos: "Written by StoreIM AI",
  template: "Built from your product details, not written by AI"
};

/**
 * The little button that sits beside one field on the product form.
 *
 * It writes **into the field**, which is the whole difference between this and
 * the studio: there is no suggestion panel to accept, because the field is
 * right there and the seller can read, edit, or undo what appears in it. The
 * studio's review step exists because it fills eight fields at once; filling
 * one in front of someone does not need it.
 *
 * `getContext` is a callback rather than a prop because the form is being typed
 * into: the title, price, and category the AI should write from are whatever
 * they are *at the moment of the click*, not at the last render.
 *
 * Nothing is saved. The value lands in the form and is written by the form's
 * own submit, so a generated description the seller then abandons is abandoned.
 */
export function GenerateWithAiButton({
  disabled,
  field,
  getContext,
  onGenerated
}: {
  /** True when the plan has no StoreIM AI, or the form is mid-submit. */
  disabled?: boolean | undefined;
  field: ProductContentField;
  getContext: () => ProductContentDraftContext | null;
  onGenerated: (value: string) => void;
}) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<ProductContentSource | null>(null);
  const label = PRODUCT_CONTENT_FIELD_META[field].label.toLowerCase();

  async function generate() {
    if (isPending || disabled) {
      return;
    }

    const draft = getContext();

    if (!draft) {
      setError("Add a product title first — the AI writes from it.");
      return;
    }

    setError(null);
    setSource(null);
    setIsPending(true);

    try {
      const result = await generateProductContentAction({ draft, fields: [field] });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      const value = result.draft.values[field];

      if (!value) {
        setError("Nothing came back for this field. Try again, or add more product details.");
        return;
      }

      setSource(result.draft.source);
      onGenerated(value);
    } catch {
      setError("The request failed. Try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <span className="generate-with-ai">
      <button
        aria-label={`Generate the ${label} with AI`}
        className="generate-with-ai-button"
        disabled={disabled || isPending}
        onClick={generate}
        type="button"
      >
        <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
        {isPending ? "Generating..." : "Generate with AI"}
      </button>
      {error ? (
        <span className="generate-with-ai-error" role="status">
          {error}
        </span>
      ) : source ? (
        <span className="generate-with-ai-source" role="status">
          {SOURCE_LABELS[source]}
        </span>
      ) : null}
    </span>
  );
}
