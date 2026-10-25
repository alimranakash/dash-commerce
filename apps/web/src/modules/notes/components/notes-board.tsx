"use client";

import {
  Archive,
  CircleAlert,
  ListChecks,
  LoaderCircle,
  Plus,
  Search,
  StickyNote,
  Tag,
  X
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useDeleteConfirmation } from "../../../components/dashboard/delete-confirmation-provider";
import { deleteNoteAction, setNoteArchivedAction, setNotePinnedAction } from "../note.actions";
import {
  NOTE_LIST_LIMIT,
  NOTE_SEARCH_MAX,
  type NoteFilters,
  type NoteMutationResult,
  type NoteView
} from "../note.schema";
import { NoteCard } from "./note-card";
import { NoteEditorDialog } from "./note-editor-dialog";

const NOTES_PATH = "/dashboard/notes";

const PRIMARY_BUTTON =
  "inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#7c3aed] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#6d28d9]";
const SECONDARY_BUTTON =
  "inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#ddd6fe] bg-white px-4 text-xs font-semibold text-[#6d3cf5]";

type NotesBoardProps = {
  filters: NoteFilters;
  labels: string[];
  /** Set when the notes could not be read; the board then offers a retry. */
  loadError: string | null;
  notes: NoteView[];
};

type Editing = {
  key: string;
  note: NoteView | null;
  startAsChecklist: boolean;
};

/**
 * The Notes page. What is listed is the server's answer to the URL — search,
 * label and archive all live in the query string — so the board keeps no copy
 * of the notes: an action revalidates and the next render is the truth. The
 * editor is the one exception, holding its draft while it autosaves.
 */
export function NotesBoard({ filters, labels, loadError, notes }: NotesBoardProps) {
  const router = useRouter();
  const { confirmDelete } = useDeleteConfirmation();
  const [query, setQuery] = useState(filters.q);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [navigating, startNavigation] = useTransition();
  const [refreshing, startRefresh] = useTransition();
  const [, startMutation] = useTransition();
  // The editor's newest saves. Props only catch up once `router.refresh()`
  // lands, so a note reopened before then would otherwise open at the version
  // still on screen — its own last edits missing, and the next keystroke a
  // conflict whose "Keep my version" would overwrite them.
  const savedNotes = useRef(new Map<string, NoteView>());
  const archive = filters.view === "archived";
  const filtered = Boolean(filters.q || filters.label);
  const loading = navigating || refreshing;
  const pinnedNotes = archive ? [] : notes.filter((note) => note.pinned);
  const otherNotes = archive ? notes : notes.filter((note) => !note.pinned);

  useEffect(() => {
    setQuery(filters.q);
  }, [filters.q]);

  function navigate(next: Partial<NoteFilters>) {
    const target = { ...filters, ...next };
    const params = new URLSearchParams();

    if (target.q) params.set("q", target.q);
    if (target.label) params.set("label", target.label);
    if (target.view === "archived") params.set("view", "archived");

    const search = params.toString();
    startNavigation(() => router.push(search ? `${NOTES_PATH}?${search}` : NOTES_PATH));
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ q: query.trim() });
  }

  function openNew(startAsChecklist: boolean) {
    setNotice(null);
    setEditing({ key: `new-${Date.now()}`, note: null, startAsChecklist });
  }

  function openNote(note: NoteView) {
    const saved = savedNotes.current.get(note.id);
    // Content from whichever copy is newer; pin and archive from the board,
    // which every flag change revalidates.
    const current =
      saved && saved.version > note.version
        ? { ...saved, archived: note.archived, pinned: note.pinned }
        : note;

    setNotice(null);
    setEditing({ key: note.id, note: current, startAsChecklist: false });
  }

  function closeEditor(changed: boolean) {
    setEditing(null);

    if (changed) {
      startRefresh(() => router.refresh());
    }
  }

  function mutate(note: NoteView, run: () => Promise<NoteMutationResult>) {
    setNotice(null);
    setPendingId(note.id);
    startMutation(async () => {
      try {
        const result = await run();

        if (result.status === "not_found") {
          setNotice("That note no longer exists.");
          router.refresh();
        } else if (result.status === "error") {
          setNotice(result.message);
        }
      } catch {
        setNotice("Couldn't update the note. Try again.");
      } finally {
        setPendingId(null);
      }
    });
  }

  function requestDelete(note: NoteView) {
    confirmDelete(async () => {
      const result = await deleteNoteAction(note.id);

      if (result.status === "error") {
        throw new Error(result.message);
      }
    });
  }

  function renderGrid(heading: string | null, list: NoteView[]) {
    return (
      <section className="grid gap-2">
        {heading ? (
          <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-[#777985]">
            {heading}
          </h2>
        ) : null}
        <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {list.map((note) => (
            <NoteCard
              busy={pendingId === note.id}
              key={note.id}
              note={note}
              onArchive={() => mutate(note, () => setNoteArchivedAction(note.id, !note.archived))}
              onDelete={() => requestDelete(note)}
              onOpen={() => openNote(note)}
              onPin={() => mutate(note, () => setNotePinnedAction(note.id, !note.pinned))}
              onSelectLabel={(label) => navigate({ label })}
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto grid max-w-[1480px] gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold text-[#20212a]">Notes</h1>
          <p className="mt-2 text-sm text-[#777985]">
            Ideas, checklists and extra costs to remember. Only you can see your notes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={SECONDARY_BUTTON} onClick={() => openNew(true)} type="button">
            <ListChecks className="h-3.5 w-3.5" /> New checklist
          </button>
          <button className={PRIMARY_BUTTON} onClick={() => openNew(false)} type="button">
            <Plus className="h-3.5 w-3.5" /> New note
          </button>
        </div>
      </div>

      <section className="grid gap-3 rounded-xl border border-[#ececf5] bg-white p-4 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
        <div className="flex flex-wrap items-center gap-3">
          <form
            className="flex min-w-0 flex-1 basis-72 gap-2"
            onSubmit={submitSearch}
            role="search"
          >
            <div className="relative min-w-0 flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777985]"
              />
              <input
                aria-label="Search notes"
                className="h-10 w-full rounded-lg border border-[#e5e3f1] bg-white pl-9 pr-9 text-sm outline-none focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#7c3aed]/10"
                maxLength={NOTE_SEARCH_MAX}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search titles, text and checklists"
                type="search"
                value={query}
              />
              {query ? (
                <button
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-[#777985] hover:text-[#20212a]"
                  onClick={() => {
                    setQuery("");
                    if (filters.q) navigate({ q: "" });
                  }}
                  type="button"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <button className={PRIMARY_BUTTON} type="submit">
              <Search className="h-3.5 w-3.5" /> Search
            </button>
          </form>

          <div
            aria-label="Which notes to show"
            className="inline-flex rounded-lg border border-[#e5e3f1] bg-[#f7f7f9] p-0.5"
            role="group"
          >
            {(
              [
                ["active", "Notes"],
                ["archived", "Archive"]
              ] as const
            ).map(([view, label]) => (
              <button
                aria-pressed={filters.view === view}
                className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition ${filters.view === view ? "bg-white text-[#5b31db] shadow-sm" : "text-[#777985] hover:text-[#20212a]"}`}
                key={view}
                onClick={() => navigate({ view })}
                type="button"
              >
                {view === "archived" ? <Archive className="h-3.5 w-3.5" /> : null}
                {label}
              </button>
            ))}
          </div>
        </div>

        {labels.length ? (
          <div
            aria-label="Filter by label"
            className="flex flex-wrap items-center gap-1.5"
            role="group"
          >
            <Tag aria-hidden="true" className="h-3.5 w-3.5 text-[#777985]" />
            {["", ...labels].map((label) => {
              const active = filters.label.toLocaleLowerCase() === label.toLocaleLowerCase();

              return (
                <button
                  aria-pressed={active}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${active ? "border-[#7c3aed] bg-[#f3f0ff] text-[#5b31db]" : "border-[#e5e3f1] bg-white text-[#5b5d6b] hover:border-[#ddd6fe]"}`}
                  key={label || "all"}
                  onClick={() => navigate({ label })}
                  type="button"
                >
                  {label || "All"}
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      {notice ? (
        <p className="form-error" role="alert">
          {notice}
        </p>
      ) : null}

      <div aria-busy={loading} className={`grid gap-5 transition ${loading ? "opacity-60" : ""}`}>
        {loading ? (
          <p className="m-0 inline-flex items-center gap-2 text-xs text-[#777985]" role="status">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Loading notes…
          </p>
        ) : null}

        {loadError ? (
          <div
            className="grid justify-items-center gap-3 rounded-xl border border-[#fecaca] bg-white p-10 text-center"
            role="alert"
          >
            <CircleAlert className="h-8 w-8 text-[#dc2626]" />
            <p className="m-0 font-semibold text-[#20212a]">We couldn&apos;t load your notes.</p>
            <p className="m-0 text-sm text-[#777985]">{loadError}</p>
            <button
              className={PRIMARY_BUTTON}
              onClick={() => startRefresh(() => router.refresh())}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : notes.length === 0 ? (
          <EmptyState
            archive={archive}
            filters={filters}
            onClear={() => navigate({ label: "", q: "" })}
            onNew={openNew}
          />
        ) : (
          <>
            {filtered ? (
              <p className="m-0 text-xs text-[#777985]">
                {notes.length} {notes.length === 1 ? "note" : "notes"} found
              </p>
            ) : null}
            {pinnedNotes.length ? renderGrid("Pinned", pinnedNotes) : null}
            {otherNotes.length
              ? renderGrid(pinnedNotes.length ? "Others" : null, otherNotes)
              : null}
            {notes.length >= NOTE_LIST_LIMIT ? (
              <p className="m-0 text-xs text-[#777985]">
                Showing the {NOTE_LIST_LIMIT} most recent notes. Search or pick a label to find
                older ones.
              </p>
            ) : null}
          </>
        )}
      </div>

      {editing ? (
        <NoteEditorDialog
          key={editing.key}
          knownLabels={labels}
          note={editing.note}
          onClose={closeEditor}
          onSaved={(note) => savedNotes.current.set(note.id, note)}
          startAsChecklist={editing.startAsChecklist}
        />
      ) : null}
    </section>
  );
}

function EmptyState({
  archive,
  filters,
  onClear,
  onNew
}: {
  archive: boolean;
  filters: NoteFilters;
  onClear: () => void;
  onNew: (startAsChecklist: boolean) => void;
}) {
  const shell =
    "grid justify-items-center gap-3 rounded-xl border border-dashed border-[#ddd6fe] bg-white px-6 py-14 text-center";

  if (filters.q || filters.label) {
    const parts = [
      filters.q ? `“${filters.q}”` : null,
      filters.label ? `the label “${filters.label}”` : null
    ].filter(Boolean);

    return (
      <div className={shell}>
        <Search className="h-8 w-8 text-[#c4b5fd]" />
        <p className="m-0 font-semibold text-[#20212a]">No notes match</p>
        <p className="m-0 max-w-md text-sm text-[#777985]">
          Nothing in {archive ? "your archive" : "your notes"} matches {parts.join(" with ")}.
        </p>
        <button className={SECONDARY_BUTTON} onClick={onClear} type="button">
          Clear search
        </button>
      </div>
    );
  }

  if (archive) {
    return (
      <div className={shell}>
        <Archive className="h-8 w-8 text-[#c4b5fd]" />
        <p className="m-0 font-semibold text-[#20212a]">No archived notes</p>
        <p className="m-0 max-w-md text-sm text-[#777985]">
          Archive a note to tuck it away without deleting it. It will wait for you here.
        </p>
      </div>
    );
  }

  return (
    <div className={shell}>
      <StickyNote className="h-8 w-8 text-[#c4b5fd]" />
      <p className="m-0 font-semibold text-[#20212a]">No notes yet</p>
      <p className="m-0 max-w-md text-sm text-[#777985]">
        Jot down business ideas, to-do checklists, supplier details or an extra cost to remember.
        Notes save as you type, and only you can see them.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button className={SECONDARY_BUTTON} onClick={() => onNew(true)} type="button">
          <ListChecks className="h-3.5 w-3.5" /> New checklist
        </button>
        <button className={PRIMARY_BUTTON} onClick={() => onNew(false)} type="button">
          <Plus className="h-3.5 w-3.5" /> New note
        </button>
      </div>
    </div>
  );
}
