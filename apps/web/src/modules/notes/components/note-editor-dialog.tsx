"use client";

import {
  Archive,
  ArchiveRestore,
  Check,
  CircleAlert,
  ListChecks,
  LoaderCircle,
  Pin,
  PinOff,
  Tag,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useDeleteConfirmation } from "../../../components/dashboard/delete-confirmation-provider";
import { ProductDescriptionEditor } from "../../products/components/product-description-editor";
import { deleteNoteAction, setNoteArchivedAction, setNotePinnedAction } from "../note.actions";
import {
  NOTE_COLORS,
  NOTE_LABEL_MAX,
  NOTE_LABELS_MAX,
  NOTE_TITLE_MAX,
  isNoteContentEmpty,
  normalizeNoteLabel,
  normalizeNoteLabels,
  type NoteView
} from "../note.schema";
import { NOTE_COLOR_STYLES } from "./note-colors";
import { NoteChecklistEditor, newChecklistItemId } from "./note-checklist-editor";
import {
  draftFromNote,
  useNoteAutosave,
  type AutosaveProblem,
  type AutosaveStatus,
  type NoteDraft
} from "./use-note-autosave";

type NoteEditorDialogProps = {
  knownLabels: string[];
  /** `null` opens a new note, which is not created until something is typed. */
  note: NoteView | null;
  /** Called once nothing is left to save; `changed` asks the board to refresh. */
  onClose: (changed: boolean) => void;
  /** Every successful save, so the board can reopen this note at its newest version. */
  onSaved: (note: NoteView) => void;
  startAsChecklist: boolean;
};

const ICON_BUTTON =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#5b5d6b] transition hover:bg-white/70 hover:text-[#20212a] disabled:opacity-40";

export function NoteEditorDialog({
  knownLabels,
  note,
  onClose,
  onSaved,
  startAsChecklist
}: NoteEditorDialogProps) {
  const [initialDraft] = useState<NoteDraft>(() =>
    note
      ? draftFromNote(note)
      : {
          body: "",
          checklist: startAsChecklist ? [{ done: false, id: newChecklistItemId(), text: "" }] : [],
          color: "default",
          labels: [],
          title: ""
        }
  );
  const autosave = useNoteAutosave(note, initialDraft, onSaved);
  const { draft, edit } = autosave;
  const [pinned, setPinned] = useState(note?.pinned ?? false);
  const [focusChecklist, setFocusChecklist] = useState(startAsChecklist);
  const [checklistOpen, setChecklistOpen] = useState(initialDraft.checklist.length > 0);
  const [busy, setBusy] = useState<"archive" | "close" | "pin" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const changedRef = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const { confirmDelete } = useDeleteConfirmation();
  const headingId = useId();
  const archived = note?.archived ?? false;
  const hasRow = autosave.noteId !== null;
  const nothingToKeep = !hasRow && isNoteContentEmpty(draft);
  const showChecklist = checklistOpen || draft.checklist.length > 0;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (!note && !startAsChecklist) {
      titleRef.current?.focus();
    } else if (note) {
      panelRef.current?.focus();
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [note, startAsChecklist]);

  function finish() {
    onClose(changedRef.current || autosave.hasSaved());
  }

  async function close() {
    if (busy) {
      return;
    }

    setActionError(null);

    if (autosave.conflict) {
      if (window.confirm("Close without saving? Your edits since the last save will be lost.")) {
        finish();
      }
      return;
    }

    // Blank checklist rows are a list in progress, not content.
    if (draft.checklist.some((item) => !item.text.trim())) {
      edit((current) => ({
        ...current,
        checklist: current.checklist.filter((item) => item.text.trim())
      }));
    }

    setBusy("close");
    const saved = await autosave.flush();
    setBusy(null);

    if (
      saved ||
      window.confirm("Your latest changes couldn't be saved. Close anyway and lose them?")
    ) {
      finish();
    }
  }

  async function togglePin() {
    setActionError(null);
    setBusy("pin");

    try {
      const id = await autosave.ensureSaved();

      if (!id) {
        return;
      }

      const result = await setNotePinnedAction(id, !pinned);

      if (result.status === "ok") {
        setPinned(!pinned);
        changedRef.current = true;
      } else {
        setActionError(result.status === "error" ? result.message : "This note no longer exists.");
      }
    } catch {
      setActionError("Couldn't update the note. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleArchive() {
    setActionError(null);
    setBusy("archive");

    try {
      const id = await autosave.ensureSaved();

      if (!id) {
        return;
      }

      const result = await setNoteArchivedAction(id, !archived);

      if (result.status === "ok") {
        onClose(true);
        return;
      }

      setActionError(result.status === "error" ? result.message : "This note no longer exists.");
    } catch {
      setActionError("Couldn't update the note. Try again.");
    } finally {
      setBusy(null);
    }
  }

  function requestDelete() {
    confirmDelete(async () => {
      const id = await autosave.discard();

      if (!id) {
        onClose(false); // never saved, so there is nothing to delete
        return;
      }

      let failure: string | null;

      try {
        const result = await deleteNoteAction(id);
        failure = result.status === "error" ? result.message : null;
      } catch {
        failure = "Couldn't delete the note. Try again.";
      }

      if (failure) {
        autosave.resume();
        throw new Error(failure);
      }

      onClose(true);
    });
  }

  function addChecklist() {
    setChecklistOpen(true);
    setFocusChecklist(true);

    if (!draft.checklist.length) {
      edit((current) => ({
        ...current,
        checklist: [{ done: false, id: newChecklistItemId(), text: "" }]
      }));
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    // The delete confirmation sits above this dialog and owns Escape while open.
    if (
      event.key !== "Escape" ||
      event.defaultPrevented ||
      document.getElementById("delete-confirmation-title")
    ) {
      return;
    }

    event.preventDefault();
    void close();
  }

  return (
    <div
      className="dashboard-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          void close();
        }
      }}
    >
      <section
        aria-labelledby={headingId}
        aria-modal="true"
        className={`flex max-h-[calc(100dvh-40px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border shadow-[0_24px_70px_rgba(25,20,56,0.22)] outline-none ${NOTE_COLOR_STYLES[draft.color].surface}`}
        onKeyDown={handleKeyDown}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <h2 className="sr-only" id={headingId}>
          {note ? "Edit note" : "New note"}
        </h2>

        <div className="flex items-start gap-2 px-4 pt-4">
          <input
            aria-label="Title"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-lg font-semibold text-[#20212a] outline-none placeholder:text-[#777985]"
            maxLength={NOTE_TITLE_MAX}
            onChange={(event) => {
              const title = event.target.value;
              edit((current) => ({ ...current, title }));
            }}
            placeholder="Title"
            ref={titleRef}
            value={draft.title}
          />
          <button
            aria-label={pinned ? "Unpin note" : "Pin note"}
            aria-pressed={pinned}
            className={ICON_BUTTON}
            disabled={busy !== null || nothingToKeep}
            onClick={() => void togglePin()}
            title={pinned ? "Unpin" : "Pin"}
            type="button"
          >
            {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-4 py-3">
          {autosave.conflict ? (
            <div
              className="rounded-lg border border-[#fed7aa] bg-[#fff7ed] p-3 text-sm text-[#9a3412]"
              role="alert"
            >
              <p className="m-0 font-semibold">This note was changed in another tab or window.</p>
              <p className="m-0 mt-1">
                Your latest edits have not been saved. Keep your version to save it over the other
                one, or load the latest version and lose these edits.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  className="inline-flex h-8 items-center rounded-lg bg-[#7c3aed] px-3 text-xs font-semibold text-white hover:bg-[#6d28d9]"
                  onClick={() => void autosave.keepMine()}
                  type="button"
                >
                  Keep my version
                </button>
                <button
                  className="inline-flex h-8 items-center rounded-lg border border-[#ddd6fe] bg-white px-3 text-xs font-semibold text-[#6d3cf5]"
                  onClick={autosave.takeTheirs}
                  type="button"
                >
                  Load latest version
                </button>
              </div>
            </div>
          ) : null}

          <ProductDescriptionEditor
            label="Note"
            name="noteBody"
            onChange={(body) => edit((current) => ({ ...current, body }))}
            placeholder="Take a note…"
            toolbar="minimal"
            value={draft.body}
          />

          {showChecklist ? (
            <NoteChecklistEditor
              autoFocus={focusChecklist}
              items={draft.checklist}
              onChange={(checklist) => edit((current) => ({ ...current, checklist }))}
            />
          ) : null}

          <LabelsField
            knownLabels={knownLabels}
            labels={draft.labels}
            onChange={(labels) => edit((current) => ({ ...current, labels }))}
          />

          {actionError ? (
            <p className="m-0 text-sm text-[#dc2626]" role="alert">
              {actionError}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e3f1] px-4 py-3">
          <div
            aria-label="Note colour"
            className="flex flex-wrap items-center gap-1.5"
            role="radiogroup"
          >
            {NOTE_COLORS.map((key) => (
              <button
                aria-checked={draft.color === key}
                aria-label={NOTE_COLOR_STYLES[key].name}
                className={`h-6 w-6 rounded-full border ${NOTE_COLOR_STYLES[key].swatch} ${draft.color === key ? "border-[#7c3aed] ring-2 ring-[#ddd6fe]" : "border-[#dedcea]"}`}
                key={key}
                onClick={() => edit((current) => ({ ...current, color: key }))}
                role="radio"
                title={NOTE_COLOR_STYLES[key].name}
                type="button"
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <SaveStatus
              onRetry={() => void autosave.retry()}
              onSaveAsNew={() => void autosave.saveAsNew()}
              problem={autosave.problem}
              status={autosave.status}
            />
            {showChecklist ? null : (
              <button
                aria-label="Add checklist"
                className={ICON_BUTTON}
                onClick={addChecklist}
                title="Add checklist"
                type="button"
              >
                <ListChecks className="h-4 w-4" />
              </button>
            )}
            <button
              aria-label={archived ? "Unarchive note" : "Archive note"}
              className={ICON_BUTTON}
              disabled={busy !== null || nothingToKeep}
              onClick={() => void toggleArchive()}
              title={archived ? "Unarchive" : "Archive"}
              type="button"
            >
              {archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            </button>
            <button
              aria-label="Delete note"
              className={ICON_BUTTON}
              disabled={busy !== null}
              onClick={requestDelete}
              title="Delete"
              type="button"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#7c3aed] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#6d28d9] disabled:opacity-60"
              disabled={busy !== null}
              onClick={() => void close()}
              type="button"
            >
              {busy === "close" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
              Done
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function SaveStatus({
  onRetry,
  onSaveAsNew,
  problem,
  status
}: {
  onRetry: () => void;
  onSaveAsNew: () => void;
  problem: { kind: AutosaveProblem; message: string } | null;
  status: AutosaveStatus;
}) {
  let content: ReactNode;

  if (status === "saving") {
    content = (
      <>
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Saving…
      </>
    );
  } else if (status === "saved") {
    content = (
      <>
        <Check className="h-3.5 w-3.5" /> Saved
      </>
    );
  } else if (status === "dirty") {
    content = "Unsaved changes";
  } else if (status === "conflict") {
    content = (
      <span className="inline-flex items-center gap-1 text-[#dc2626]">
        <CircleAlert className="h-3.5 w-3.5" /> Not saved
      </span>
    );
  } else if (status === "error") {
    content = (
      <span className="inline-flex flex-wrap items-center gap-1 text-[#dc2626]">
        <CircleAlert className="h-3.5 w-3.5" /> {problem?.message ?? "Not saved."}
        {problem?.kind === "network" ? (
          <button className="font-semibold underline" onClick={onRetry} type="button">
            Retry
          </button>
        ) : null}
        {problem?.kind === "missing" ? (
          <button className="font-semibold underline" onClick={onSaveAsNew} type="button">
            Save as a new note
          </button>
        ) : null}
      </span>
    );
  } else {
    content = "Saves automatically";
  }

  return (
    <p
      aria-live="polite"
      className="m-0 mr-2 inline-flex items-center gap-1 text-xs text-[#777985]"
    >
      {content}
    </p>
  );
}

function LabelsField({
  knownLabels,
  labels,
  onChange
}: {
  knownLabels: string[];
  labels: string[];
  onChange: (labels: string[]) => void;
}) {
  const [text, setText] = useState("");
  const listId = useId();
  const taken = new Set(labels.map((label) => label.toLocaleLowerCase()));
  const suggestions = knownLabels.filter((label) => !taken.has(label.toLocaleLowerCase()));

  function add() {
    const label = normalizeNoteLabel(text);

    if (label) {
      onChange(normalizeNoteLabels([...labels, label]).slice(0, NOTE_LABELS_MAX));
    }

    setText("");
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Tag aria-hidden="true" className="h-3.5 w-3.5 text-[#777985]" />
      {labels.map((label) => (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-[#ddd6fe] bg-white px-2 py-0.5 text-xs font-medium text-[#5b31db]"
          key={label}
        >
          {label}
          <button
            aria-label={`Remove label ${label}`}
            className="rounded-full text-[#777985] hover:text-[#20212a]"
            onClick={() => onChange(labels.filter((current) => current !== label))}
            type="button"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {labels.length < NOTE_LABELS_MAX ? (
        <>
          <input
            aria-label="Add label"
            className="h-7 min-w-28 flex-1 bg-transparent text-xs text-[#20212a] outline-none placeholder:text-[#777985]"
            list={listId}
            maxLength={NOTE_LABEL_MAX}
            onBlur={add}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                add();
              } else if (event.key === "Backspace" && !text && labels.length) {
                onChange(labels.slice(0, -1));
              }
            }}
            placeholder={labels.length ? "Add label" : "Add a label (e.g. Ideas, Expenses)"}
            value={text}
          />
          <datalist id={listId}>
            {suggestions.map((label) => (
              <option key={label} value={label} />
            ))}
          </datalist>
        </>
      ) : null}
    </div>
  );
}
