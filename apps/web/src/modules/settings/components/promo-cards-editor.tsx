"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { MediaPickerField } from "../../media/components/media-picker";

export type PromoCardValue = {
  backgroundColor: string;
  badge: string;
  ctaLink: string;
  ctaText: string;
  description: string;
  imageUrl: string;
  title: string;
};

type PromoCardsEditorProps = {
  cards: PromoCardValue[];
  helper?: string;
  label: string;
  name: string;
};

const emptyCard: PromoCardValue = {
  backgroundColor: "#f7f8fb",
  badge: "",
  ctaLink: "/products",
  ctaText: "Shop now",
  description: "",
  imageUrl: "",
  title: ""
};

/**
 * Structured replacement for the pipe-delimited promo-card textarea. The rows
 * are serialized back into that exact format in a hidden textarea, so the
 * settings action's parser is untouched.
 */
export function PromoCardsEditor({ cards, helper, label, name }: PromoCardsEditorProps) {
  const [rows, setRows] = useState<PromoCardValue[]>(cards);

  const serialized = rows
    .filter((row) => row.title.trim())
    .map((row) =>
      [row.title, row.badge, row.description, row.imageUrl, row.ctaText, row.ctaLink, row.backgroundColor]
        .map((part) => part.replace(/\|/g, "/").trim())
        .join(" | ")
    )
    .join("\n");

  function updateRow(index: number, patch: Partial<PromoCardValue>) {
    setRows((current) => current.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className="promo-cards-editor">
      {/* Hidden textarea rather than an input: newlines survive submission. */}
      <textarea hidden name={name} readOnly value={serialized} />
      <div className="theme-upload-label-row">
        <span>{label}</span>
        <button
          className="media-picker-choose"
          onClick={() => setRows((current) => [...current, { ...emptyCard }])}
          type="button"
        >
          <Plus className="h-4 w-4" />
          Add card
        </button>
      </div>
      {helper ? <p className="promo-cards-helper">{helper}</p> : null}
      {rows.length === 0 ? <p className="promo-cards-helper">No cards yet.</p> : null}
      {rows.map((row, index) => (
        <article className="promo-card-row" key={index}>
          <MediaPickerField
            description="Card artwork."
            label="Image"
            onChange={(url) => updateRow(index, { imageUrl: url })}
            usageType="HERO"
            value={row.imageUrl}
          />
          <div className="promo-card-fields">
            <label>
              Title
              <input
                onChange={(event) => updateRow(index, { title: event.target.value })}
                placeholder="Card title"
                type="text"
                value={row.title}
              />
            </label>
            <label>
              Badge
              <input
                onChange={(event) => updateRow(index, { badge: event.target.value })}
                type="text"
                value={row.badge}
              />
            </label>
            <label>
              Description
              <input
                onChange={(event) => updateRow(index, { description: event.target.value })}
                type="text"
                value={row.description}
              />
            </label>
            <label>
              CTA text
              <input
                onChange={(event) => updateRow(index, { ctaText: event.target.value })}
                type="text"
                value={row.ctaText}
              />
            </label>
            <label>
              CTA link
              <input
                onChange={(event) => updateRow(index, { ctaLink: event.target.value })}
                type="text"
                value={row.ctaLink}
              />
            </label>
            <label>
              Background
              <input
                onChange={(event) => updateRow(index, { backgroundColor: event.target.value })}
                type="color"
                value={row.backgroundColor}
              />
            </label>
          </div>
          <button
            aria-label={`Remove card ${index + 1}`}
            className="promo-card-remove"
            onClick={() => setRows((current) => current.filter((_, position) => position !== index))}
            type="button"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </article>
      ))}
    </div>
  );
}
