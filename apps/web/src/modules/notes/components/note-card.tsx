"use client";

import { Archive, ArchiveRestore, Pin, PinOff, Square, Trash2 } from "lucide-react";
import { productDescriptionText } from "../../products/product-description";
import { ProductRichText } from "../../storefront/components/product-rich-text";
import type { NoteView } from "../note.schema";
import { NOTE_COLOR_STYLES } from "./note-colors";

const PREVIEW_ITEMS = 6;

const ACTION_BUTTON =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#5b5d6b] transition hover:bg-white/70 hover:text-[#20212a] disabled:opacity-40";

type NoteCardProps = {
  busy: boolean;
  note: NoteView;
  onArchive: () => void;
  onDelete: () => void;
  onOpen: () => void;
  onPin: () => void;
  onSelectLabel: (label: string) => void;
};

/**
 * One note on the board. The whole card opens the editor through a single
 * button laid underneath the content, so the preview can hold the body's
 * paragraphs and lists — which a `<button>` may not contain — while the label
 * chips and the actions sit above it as buttons of their own.
 */
export function NoteCard({
  busy,
  note,
  onArchive,
  onDelete,
  onOpen,
  onPin,
  onSelectLabel
}: NoteCardProps) {
  const bodyText = productDescriptionText(note.body);
  const items = note.checklist.filter((item) => item.text.trim());
  const open = items.filter((item) => !item.done);
  const completed = items.length - open.length;
  const empty = !note.title.trim() && !bodyText && items.length === 0;
  const name = note.title.trim() || bodyText.slice(0, 60) || open[0]?.text || "Untitled note";
  const more = [
    open.length > PREVIEW_ITEMS ? `+${open.length - PREVIEW_ITEMS} more` : null,
    completed ? `${completed} completed` : null
  ].filter(Boolean);

  return (
    <article
      className={`group relative flex flex-col rounded-xl border shadow-[0_8px_24px_rgba(62,54,114,0.04)] transition hover:shadow-[0_10px_28px_rgba(62,54,114,0.12)] ${NOTE_COLOR_STYLES[note.color].surface} ${busy ? "opacity-60" : ""}`}
    >
      <button
        aria-label={`Open note: ${name}${note.pinned ? " (pinned)" : ""}`}
        className="absolute inset-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c3aed]"
        onClick={onOpen}
        type="button"
      />

      <div className="pointer-events-none relative grid gap-2 p-4 pb-2">
        {note.title.trim() ? (
          <h3 className="m-0 break-words pr-6 text-sm font-semibold text-[#20212a]">
            {note.title}
          </h3>
        ) : null}
        {bodyText ? (
          <div className="max-h-48 overflow-hidden break-words text-sm leading-6 text-[#34353e]">
            <ProductRichText text={note.body} />
          </div>
        ) : null}
        {open.length ? (
          <ul className="m-0 grid list-none gap-1 p-0 text-sm text-[#34353e]">
            {open.slice(0, PREVIEW_ITEMS).map((item) => (
              <li className="flex items-start gap-2 break-words" key={item.id}>
                <Square aria-hidden="true" className="mt-1 h-3.5 w-3.5 shrink-0 text-[#777985]" />
                <span className="min-w-0">{item.text}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {more.length ? <p className="m-0 text-xs text-[#777985]">{more.join(" · ")}</p> : null}
        {empty ? <p className="m-0 text-sm italic text-[#777985]">Empty note</p> : null}
      </div>

      {note.pinned ? (
        <Pin
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[#6d3cf5]"
        />
      ) : null}

      {note.labels.length ? (
        <div className="relative flex flex-wrap gap-1 px-4 pb-2">
          {note.labels.map((label) => (
            <button
              className="rounded-full border border-[#ddd6fe] bg-white px-2 py-0.5 text-[11px] font-medium text-[#5b31db] transition hover:bg-[#f3f0ff]"
              key={label}
              onClick={() => onSelectLabel(label)}
              title={`Show notes labelled ${label}`}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {/* Always shown on touch screens, which have no hover to reveal them. */}
      <div className="relative mt-auto flex items-center justify-end gap-0.5 px-2 pb-2 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        {note.archived ? null : (
          <button
            aria-label={note.pinned ? "Unpin note" : "Pin note"}
            className={ACTION_BUTTON}
            disabled={busy}
            onClick={onPin}
            title={note.pinned ? "Unpin" : "Pin"}
            type="button"
          >
            {note.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </button>
        )}
        <button
          aria-label={note.archived ? "Unarchive note" : "Archive note"}
          className={ACTION_BUTTON}
          disabled={busy}
          onClick={onArchive}
          title={note.archived ? "Unarchive" : "Archive"}
          type="button"
        >
          {note.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
        </button>
        <button
          aria-label="Delete note"
          className={ACTION_BUTTON}
          disabled={busy}
          onClick={onDelete}
          title="Delete"
          type="button"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}
