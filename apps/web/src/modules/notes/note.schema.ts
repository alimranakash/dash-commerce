import { z } from "zod";
import { productDescriptionText } from "../products/product-description";

/**
 * The shape of a note, and every rule about what one may hold.
 *
 * Pure — no database, no session — so the dashboard's editor, the server
 * actions and `verify-notes.mts` all read the same limits. The body is the
 * product description editor's HTML; nothing here decides what is safe to
 * *render*, because nothing renders it raw: cards go through `ProductRichText`,
 * which rebuilds an allow-list of tags as React elements.
 */

export const NOTE_COLORS = [
  "default",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "pink"
] as const;

export const NOTE_TITLE_MAX = 200;
/** Counted on what the seller reads, so bolding a phrase cannot push a note over. */
export const NOTE_BODY_TEXT_MAX = 20000;
/** Only bounds the markup one request may carry. */
export const NOTE_BODY_MARKUP_MAX = NOTE_BODY_TEXT_MAX * 4;
export const NOTE_CHECKLIST_MAX_ITEMS = 100;
export const NOTE_CHECKLIST_ITEM_MAX = 500;
export const NOTE_LABELS_MAX = 10;
export const NOTE_LABEL_MAX = 30;
export const NOTE_SEARCH_MAX = 100;
/** More than anyone keeps on one board; a bound, not a page size. */
export const NOTE_LIST_LIMIT = 500;

// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]+/g;
/** A cuid from the database, or a client-minted checklist item id. */
const NOTE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export const noteColorSchema = z.enum(NOTE_COLORS);
export const noteIdSchema = z.string().regex(NOTE_ID_PATTERN, "Unknown note.");
export const noteViewSchema = z.enum(["active", "archived"]);

export const noteChecklistItemSchema = z.object({
  done: z.boolean(),
  id: z.string().regex(NOTE_ID_PATTERN, "Unknown checklist item."),
  text: z
    .string()
    .max(
      NOTE_CHECKLIST_ITEM_MAX,
      `Keep each checklist item under ${NOTE_CHECKLIST_ITEM_MAX} characters.`
    )
    .transform(singleLine)
});

export const noteChecklistSchema = z
  .array(noteChecklistItemSchema)
  .max(
    NOTE_CHECKLIST_MAX_ITEMS,
    `A note can hold up to ${NOTE_CHECKLIST_MAX_ITEMS} checklist items.`
  )
  .refine((items) => new Set(items.map((item) => item.id)).size === items.length, {
    message: "Checklist items must be unique."
  });

export const noteLabelsSchema = z
  .array(z.string().max(NOTE_LABEL_MAX * 4))
  .max(NOTE_LABELS_MAX * 4)
  .transform(normalizeNoteLabels)
  .refine((labels) => labels.length <= NOTE_LABELS_MAX, {
    message: `A note can have up to ${NOTE_LABELS_MAX} labels.`
  })
  .refine((labels) => labels.every((label) => label.length <= NOTE_LABEL_MAX), {
    message: `Keep each label under ${NOTE_LABEL_MAX} characters.`
  });

export const noteContentSchema = z.object({
  body: z
    .string()
    .max(NOTE_BODY_MARKUP_MAX, "This note is too long to save.")
    .refine((value) => productDescriptionText(value).length <= NOTE_BODY_TEXT_MAX, {
      message: `Keep a note under ${NOTE_BODY_TEXT_MAX} characters.`
    }),
  checklist: noteChecklistSchema,
  color: noteColorSchema,
  labels: noteLabelsSchema,
  title: z
    .string()
    .max(NOTE_TITLE_MAX, `Keep the title under ${NOTE_TITLE_MAX} characters.`)
    .transform(singleLine)
});

/**
 * One autosave. A new note has neither an id nor a version; an existing one has
 * both, and `expectedVersion` is the version the editor last saw — the update
 * only applies if the row is still at it.
 */
export const noteSaveSchema = noteContentSchema
  .extend({
    expectedVersion: z.number().int().min(1).nullable(),
    id: noteIdSchema.nullable()
  })
  .refine((value) => (value.id === null) === (value.expectedVersion === null), {
    message: "This note could not be saved. Reload the page and try again."
  });

/**
 * The board's URL state. Every field falls back rather than failing, because a
 * hand-edited query string should show the notes, not an error page.
 */
export const noteFiltersSchema = z.object({
  label: z
    .string()
    .transform((value) => normalizeNoteLabel(value).slice(0, NOTE_LABEL_MAX))
    .catch(""),
  q: z
    .string()
    .transform((value) => normalizeNoteLabel(value).slice(0, NOTE_SEARCH_MAX))
    .catch(""),
  view: noteViewSchema.catch("active")
});

export type NoteColor = z.infer<typeof noteColorSchema>;
export type NoteBoardView = z.infer<typeof noteViewSchema>;
export type NoteChecklistItem = z.output<typeof noteChecklistItemSchema>;
export type NoteContent = z.output<typeof noteContentSchema>;
export type NoteSaveInput = z.input<typeof noteSaveSchema>;
export type NoteFilters = z.output<typeof noteFiltersSchema>;

/** A note as the dashboard receives it. */
export type NoteView = NoteContent & {
  archived: boolean;
  id: string;
  pinned: boolean;
  updatedAt: string;
  version: number;
};

export type SaveNoteResult =
  | { status: "saved"; note: NoteView }
  /** The row moved on since the editor last saw it; `note` is the newer copy. */
  | { status: "conflict"; note: NoteView }
  | { status: "not_found" }
  /** The input itself is refused; saving it again will not help. */
  | { message: string; status: "invalid" }
  /** Something went wrong on the way; the same save may well succeed on retry. */
  | { message: string; status: "error" };

export type NoteMutationResult =
  | { status: "ok" }
  | { status: "not_found" }
  | { message: string; status: "error" };

/** Control characters become spaces; a title or checklist item is one line. */
export function singleLine(value: string) {
  return value.replace(CONTROL_CHARACTERS, " ");
}

export function normalizeNoteLabel(value: string) {
  return value.replace(CONTROL_CHARACTERS, " ").replace(/\s+/g, " ").trim();
}

/** Trimmed, blank ones dropped, and "Ideas" and "ideas" are one label — the first spelling wins. */
export function normalizeNoteLabels(values: readonly string[]) {
  const seen = new Set<string>();
  const labels: string[] = [];

  for (const value of values) {
    const label = normalizeNoteLabel(value);
    const key = label.toLocaleLowerCase();

    if (label && !seen.has(key)) {
      seen.add(key);
      labels.push(label);
    }
  }

  return labels;
}

/** What search matches besides the title: the body's words and every checklist item. */
export function noteSearchText(content: Pick<NoteContent, "body" | "checklist">) {
  return [
    productDescriptionText(content.body),
    ...content.checklist.map((item) => item.text.trim())
  ]
    .filter(Boolean)
    .join("\n");
}

export function isNoteContentEmpty(content: Pick<NoteContent, "body" | "checklist" | "title">) {
  return (
    !content.title.trim() &&
    !productDescriptionText(content.body) &&
    content.checklist.every((item) => !item.text.trim())
  );
}

/** A search term as a literal `ILIKE` pattern: `%` and `_` mean themselves. */
export function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
