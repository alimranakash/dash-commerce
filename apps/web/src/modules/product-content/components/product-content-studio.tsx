"use client";

import { Button } from "@dash/ui";
import { Check, Crown, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  applyProductContentAction,
  generateProductContentAction
} from "../product-content.actions";
import {
  PRODUCT_CONTENT_FIELD_META,
  PRODUCT_CONTENT_FIELDS,
  PRODUCT_CONTENT_LANGUAGES,
  PRODUCT_CONTENT_LIMITS,
  PRODUCT_CONTENT_TONES,
  type ProductContentField,
  type ProductContentLanguage,
  type ProductContentSource,
  type ProductContentTone,
  type ProductContentValues
} from "../product-content.schema";

type FieldText = Record<ProductContentField, string>;
type FieldDraft = Partial<Record<ProductContentField, string>>;

type ProductContentStudioProps = {
  /** False when the store's plan does not include StoreIM AI. Editing stays open. */
  aiEnabled: boolean;
  /** Where an unentitled seller goes to turn StoreIM AI on. */
  billingHref: string;
  lastGeneratedAt: string | null;
  productId: string;
  productTitle: string;
  values: ProductContentValues;
};

const TONE_LABELS: Record<ProductContentTone, string> = {
  friendly: "Friendly",
  premium: "Premium",
  professional: "Professional"
};

const LANGUAGE_LABELS: Record<ProductContentLanguage, string> = {
  bn: "বাংলা (Bangla)",
  en: "English"
};

const SOURCE_LABELS: Record<ProductContentSource, string> = {
  gemini: "Written by Gemini, on your own API key",
  openai: "Written by OpenAI, on your own API key",
  storeos: "Written by StoreIM AI",
  template: "Composed from your product details"
};

/**
 * Which of the two banner styles a source gets. Anything an actual model wrote
 * reads as generated; the offline composer reads as a caution, because someone
 * about to publish it should know no model was involved.
 */
function sourceTone(source: ProductContentSource) {
  return source === "template" ? "template" : "storeos";
}

/**
 * The AI Product Content Studio.
 *
 * Three things happen here and they are kept apart on purpose: **generating**
 * puts a suggestion beside a field without touching it, **editing** changes the
 * working copy, and **saving** is the only thing that writes to the product. A
 * seller can therefore generate eight fields, keep two, rewrite one, and save
 * only what they meant to — which is the difference between a draft tool and
 * one that overwrites the copy they spent an afternoon on.
 *
 * Everything the buttons call is a server action guarded by `requireStore()`,
 * so the store is never a value this component holds.
 */
export function ProductContentStudio({
  aiEnabled,
  billingHref,
  lastGeneratedAt,
  productId,
  productTitle,
  values
}: ProductContentStudioProps) {
  const initial = useMemo(() => toFieldText(values), [values]);
  const [saved, setSaved] = useState<FieldText>(initial);
  const [working, setWorking] = useState<FieldText>(initial);
  const [suggestions, setSuggestions] = useState<FieldDraft>({});
  const [source, setSource] = useState<ProductContentSource | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [generating, setGenerating] = useState<"all" | ProductContentField | null>(null);
  const [instructions, setInstructions] = useState("");
  const [language, setLanguage] = useState<ProductContentLanguage>("en");
  const [tone, setTone] = useState<ProductContentTone>("friendly");
  const [isSaving, startSaving] = useTransition();

  const changedFields = PRODUCT_CONTENT_FIELDS.filter(
    (field) => working[field] !== (saved[field] ?? "")
  );

  function generate(fields: readonly ProductContentField[], scope: "all" | ProductContentField) {
    if (generating) {
      return;
    }

    setError(null);
    setStatus(null);
    setGenerating(scope);

    void generateProductContentAction({
      fields: [...fields],
      instructions,
      language,
      productId,
      tone
    })
      .then((result) => {
        if (!result.ok) {
          setError(result.error);
          setLocked(result.locked);
          return;
        }

        setLocked(false);
        setSource(result.draft.source);
        setWarnings(result.draft.warnings);
        setSuggestions((current) => ({
          ...current,
          ...toFieldDraft(result.draft.values)
        }));
        setStatus(
          scope === "all"
            ? `${Object.keys(result.draft.values).length} suggestions ready. Review each one before saving.`
            : `Suggestion ready for ${PRODUCT_CONTENT_FIELD_META[scope].label.toLowerCase()}.`
        );
      })
      .finally(() => setGenerating(null));
  }

  function acceptSuggestion(field: ProductContentField) {
    const suggestion = suggestions[field];

    if (suggestion === undefined) {
      return;
    }

    setWorking((current) => ({ ...current, [field]: suggestion }));
    dismissSuggestion(field);
  }

  function dismissSuggestion(field: ProductContentField) {
    setSuggestions((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function acceptAll() {
    setWorking((current) => {
      const next = { ...current };

      for (const field of PRODUCT_CONTENT_FIELDS) {
        const suggestion = suggestions[field];

        if (suggestion !== undefined) {
          next[field] = suggestion;
        }
      }

      return next;
    });
    setSuggestions({});
  }

  function save() {
    if (changedFields.length === 0 || isSaving) {
      return;
    }

    setError(null);
    setStatus(null);

    // Only what changed goes to the server: an untouched field is left absent so
    // the apply path leaves it exactly as it is.
    const payload: ProductContentValues = {};

    for (const field of changedFields) {
      payload[field] = working[field] ? working[field] : null;
    }

    startSaving(async () => {
      const result = await applyProductContentAction({
        productId,
        ...(source ? { source } : {}),
        values: payload
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      const next = toFieldText(result.content.values);

      setSaved(next);
      setWorking(next);
      setStatus(`Saved ${changedFields.length} field${changedFields.length === 1 ? "" : "s"}.`);
    });
  }

  return (
    <div className="ai-studio">
      <section className="product-editor-card ai-studio-controls">
        <header>
          <h2>Generate content</h2>
          <p>
            StoreIM AI writes from this product&apos;s own details — its category, brand, tags and
            price. Nothing is saved until you choose to save it.
          </p>
        </header>
        <div className="product-editor-card-body">
          <div className="form-grid ai-studio-options">
            <label>
              Tone
              <select
                onChange={(event) => setTone(event.target.value as ProductContentTone)}
                value={tone}
              >
                {PRODUCT_CONTENT_TONES.map((option) => (
                  <option key={option} value={option}>
                    {TONE_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Language
              <select
                onChange={(event) => setLanguage(event.target.value as ProductContentLanguage)}
                value={language}
              >
                {PRODUCT_CONTENT_LANGUAGES.map((option) => (
                  <option key={option} value={option}>
                    {LANGUAGE_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Anything else it should know
            <textarea
              maxLength={500}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="Mention the free delivery offer, and keep it under three sentences."
              rows={2}
              value={instructions}
            />
          </label>

          {aiEnabled ? null : (
            <p className="ai-studio-locked">
              <Crown
                aria-hidden="true"
                className="h-3.5 w-3.5"
                fill="currentColor"
                strokeWidth={1.5}
              />
              <span>
                StoreIM AI is not included in your current plan, so generating is off. You can still
                write and save every field below. <Link href={billingHref}>See plans</Link>
              </span>
            </p>
          )}

          <div className="ai-studio-actions">
            <Button
              className="primary action-button"
              disabled={!aiEnabled || generating !== null}
              onClick={() => generate(PRODUCT_CONTENT_FIELDS, "all")}
              type="button"
            >
              <Sparkles aria-hidden="true" className="h-4 w-4" />
              {generating === "all" ? "Generating..." : "Generate all fields"}
            </Button>
            {hasSuggestions(suggestions) ? (
              <button className="ai-studio-ghost-button" onClick={acceptAll} type="button">
                Use every suggestion
              </button>
            ) : null}
            {lastGeneratedAt ? (
              <span className="ai-studio-meta">Last generated {lastGeneratedAt}</span>
            ) : null}
          </div>

          {source ? (
            <p className={`ai-studio-source ai-studio-source-${sourceTone(source)}`}>
              {SOURCE_LABELS[source]}
            </p>
          ) : null}
          {warnings.map((warning) => (
            <p className="ai-studio-warning" key={warning}>
              {warning}
            </p>
          ))}
          {error ? (
            <p className="form-error">
              {error}
              {locked ? (
                <>
                  {" "}
                  <Link href={billingHref}>Upgrade</Link>
                </>
              ) : null}
            </p>
          ) : null}
          {status ? <p className="ai-studio-status">{status}</p> : null}
        </div>
      </section>

      {PRODUCT_CONTENT_FIELDS.map((field) => {
        const meta = PRODUCT_CONTENT_FIELD_META[field];
        const suggestion = suggestions[field];
        const value = working[field];
        const limit = PRODUCT_CONTENT_LIMITS[field];

        return (
          <section className="product-editor-card ai-studio-field" key={field}>
            <header>
              <div className="ai-studio-field-heading">
                <div>
                  <h2>{meta.label}</h2>
                  <p>{meta.description}</p>
                </div>
                <button
                  className="ai-studio-ghost-button"
                  disabled={!aiEnabled || generating !== null}
                  onClick={() => generate([field], field)}
                  type="button"
                >
                  <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                  {generating === field ? "Generating..." : "Generate"}
                </button>
              </div>
            </header>
            <div className="product-editor-card-body">
              {suggestion === undefined ? null : (
                <div className="ai-studio-suggestion">
                  <p className="ai-studio-suggestion-label">Suggested</p>
                  <p className="ai-studio-suggestion-text">{suggestion}</p>
                  <div className="ai-studio-suggestion-actions">
                    <button
                      className="ai-studio-accept-button"
                      onClick={() => acceptSuggestion(field)}
                      type="button"
                    >
                      <Check aria-hidden="true" className="h-3.5 w-3.5" />
                      Use this
                    </button>
                    <button
                      className="ai-studio-ghost-button"
                      onClick={() => dismissSuggestion(field)}
                      type="button"
                    >
                      <X aria-hidden="true" className="h-3.5 w-3.5" />
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
              <label>
                <span className="sr-only">{meta.label}</span>
                <textarea
                  onChange={(event) =>
                    setWorking((current) => ({ ...current, [field]: event.target.value }))
                  }
                  rows={meta.rows}
                  value={value}
                />
              </label>
              <p
                className={`ai-studio-count${value.length > limit ? " ai-studio-count-over" : ""}`}
              >
                {value.length} / {limit}
                {working[field] === (saved[field] ?? "") ? null : <span> · unsaved</span>}
              </p>
            </div>
          </section>
        );
      })}

      <div className="product-editor-submit-card ai-studio-save">
        <div>
          <strong>{productTitle}</strong>
          <span>
            {changedFields.length === 0
              ? "Nothing to save yet."
              : `${changedFields.length} field${changedFields.length === 1 ? "" : "s"} changed.`}
          </span>
        </div>
        <Button
          className="primary action-button"
          disabled={changedFields.length === 0 || isSaving}
          onClick={save}
          type="button"
        >
          {isSaving ? "Saving..." : "Save to product"}
        </Button>
      </div>
    </div>
  );
}

function toFieldText(values: ProductContentValues): FieldText {
  return Object.fromEntries(
    PRODUCT_CONTENT_FIELDS.map((field) => [field, values[field] ?? ""])
  ) as FieldText;
}

function toFieldDraft(values: ProductContentValues): FieldDraft {
  const draft: FieldDraft = {};

  for (const field of PRODUCT_CONTENT_FIELDS) {
    const value = values[field];

    if (value) {
      draft[field] = value;
    }
  }

  return draft;
}

function hasSuggestions(suggestions: FieldDraft) {
  return PRODUCT_CONTENT_FIELDS.some((field) => suggestions[field] !== undefined);
}
