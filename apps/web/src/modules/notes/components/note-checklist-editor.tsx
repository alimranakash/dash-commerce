"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  NOTE_CHECKLIST_ITEM_MAX,
  NOTE_CHECKLIST_MAX_ITEMS,
  type NoteChecklistItem
} from "../note.schema";

type NoteChecklistEditorProps = {
  /** Focus the first item on mount — a "New checklist" opens ready to type. */
  autoFocus?: boolean | undefined;
  items: NoteChecklistItem[];
  onChange: (items: NoteChecklistItem[]) => void;
};

export function newChecklistItemId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Open items first, completed ones underneath, the way a paper list gets
 * crossed off. The order in the array is never rearranged — ticking an item
 * moves where it is *shown*, not where it is stored — so unticking puts it
 * back where it was.
 */
export function NoteChecklistEditor({ autoFocus, items, onChange }: NoteChecklistEditorProps) {
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const [focusId, setFocusId] = useState<string | null>(autoFocus ? (items[0]?.id ?? null) : null);
  const open = items.filter((item) => !item.done);
  const completed = items.filter((item) => item.done);
  const full = items.length >= NOTE_CHECKLIST_MAX_ITEMS;

  useEffect(() => {
    if (!focusId) {
      return;
    }

    inputs.current.get(focusId)?.focus();
    setFocusId(null);
  }, [focusId]);

  function update(id: string, patch: Partial<NoteChecklistItem>) {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  /** After `afterId`, or after the last open item when adding from the button. */
  function insert(afterId: string | null) {
    if (full) {
      return;
    }

    const item: NoteChecklistItem = { done: false, id: newChecklistItemId(), text: "" };
    let index = afterId ? items.findIndex((current) => current.id === afterId) : -1;

    if (index < 0) {
      items.forEach((current, position) => {
        if (!current.done) {
          index = position;
        }
      });
    }

    const next = [...items];
    next.splice(index + 1, 0, item);
    onChange(next);
    setFocusId(item.id);
  }

  function remove(id: string) {
    const position = open.findIndex((item) => item.id === id);
    const neighbour = position >= 0 ? (open[position - 1] ?? open[position + 1]) : undefined;

    onChange(items.filter((item) => item.id !== id));

    if (neighbour) {
      setFocusId(neighbour.id);
    }
  }

  function handleKey(event: KeyboardEvent<HTMLInputElement>, item: NoteChecklistItem) {
    if (event.key === "Enter") {
      event.preventDefault();
      insert(item.id);
    } else if (event.key === "Backspace" && item.text === "") {
      event.preventDefault();
      remove(item.id);
    }
  }

  function renderItem(item: NoteChecklistItem) {
    return (
      <li className="group/item flex items-center gap-2 rounded-md px-1" key={item.id}>
        <input
          aria-label={item.done ? "Mark as not done" : "Mark as done"}
          checked={item.done}
          className="h-4 w-4 shrink-0 accent-[#7c3aed]"
          onChange={(event) => update(item.id, { done: event.target.checked })}
          type="checkbox"
        />
        <input
          aria-label="Checklist item"
          className={`min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none ${item.done ? "text-[#777985] line-through" : "text-[#20212a]"}`}
          maxLength={NOTE_CHECKLIST_ITEM_MAX}
          onChange={(event) => update(item.id, { text: event.target.value })}
          onKeyDown={(event) => handleKey(event, item)}
          placeholder="List item"
          ref={(element) => {
            if (element) {
              inputs.current.set(item.id, element);
            } else {
              inputs.current.delete(item.id);
            }
          }}
          value={item.text}
        />
        <button
          aria-label="Remove item"
          className="rounded p-1 text-[#777985] transition hover:text-[#20212a] focus:opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100"
          onClick={() => remove(item.id)}
          title="Remove item"
          type="button"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </li>
    );
  }

  return (
    <div className="grid gap-1">
      {open.length ? (
        <ul aria-label="Checklist" className="m-0 grid list-none gap-0.5 p-0">
          {open.map(renderItem)}
        </ul>
      ) : null}
      <button
        className="inline-flex w-fit items-center gap-1.5 rounded-md px-1 py-1.5 text-sm font-medium text-[#6d3cf5] disabled:opacity-50"
        disabled={full}
        onClick={() => insert(null)}
        type="button"
      >
        <Plus className="h-4 w-4" /> List item
      </button>
      {completed.length ? (
        <div className="mt-1 grid gap-0.5 border-t border-[#e5e3f1] pt-2">
          <p className="m-0 px-1 text-xs font-medium text-[#777985]">
            {completed.length} completed
          </p>
          <ul aria-label="Completed items" className="m-0 grid list-none gap-0.5 p-0">
            {completed.map(renderItem)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
