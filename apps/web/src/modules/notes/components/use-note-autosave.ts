"use client";

import { useEffect, useRef, useState } from "react";
import { saveNoteAction } from "../note.actions";
import {
  isNoteContentEmpty,
  type NoteChecklistItem,
  type NoteColor,
  type NoteView,
  type SaveNoteResult
} from "../note.schema";

export type NoteDraft = {
  body: string;
  checklist: NoteChecklistItem[];
  color: NoteColor;
  labels: string[];
  title: string;
};

export type AutosaveStatus = "conflict" | "dirty" | "error" | "idle" | "saved" | "saving";

/** Why saving stopped. `network` is the only one a plain retry can fix. */
export type AutosaveProblem = "invalid" | "missing" | "network";

type Halt = "conflict" | "discarded" | "invalid" | "missing";

const AUTOSAVE_DELAY_MS = 800;

export function draftFromNote(note: NoteView): NoteDraft {
  return {
    body: note.body,
    checklist: note.checklist,
    color: note.color,
    labels: note.labels,
    title: note.title
  };
}

/**
 * The editor's draft and the one loop that saves it.
 *
 * Three rules keep an edit from being lost or from clobbering a newer one:
 *
 * - **One save in flight.** Every trigger — the debounce, Retry, closing —
 *   joins the same runner, and the runner keeps saving until the revision it
 *   saved is the latest one. A slow request can never land after a newer one,
 *   because there never is a newer one in the air.
 * - **Compare-and-set.** Each save names the version it last saw. If the row
 *   moved on — another tab, another device — the server refuses and answers
 *   with its copy, saving halts, and the person chooses which to keep. Nothing
 *   is overwritten without them saying so.
 * - **The draft outlives failure.** A refused or failed save leaves the draft
 *   exactly as typed; the next edit or Retry tries again, and leaving the page
 *   with unsaved edits asks first.
 */
export function useNoteAutosave(
  note: NoteView | null,
  initialDraft: NoteDraft,
  /** Told about every successful save, including one that lands after unmount. */
  onSaved?: (note: NoteView) => void
) {
  const [draft, setDraft] = useState(initialDraft);
  const [status, setStatus] = useState<AutosaveStatus>(note ? "saved" : "idle");
  const [problem, setProblem] = useState<{ kind: AutosaveProblem; message: string } | null>(null);
  const [conflict, setConflict] = useState<NoteView | null>(null);
  const [noteId, setNoteId] = useState(note?.id ?? null);

  const draftRef = useRef(initialDraft);
  const savedRef = useRef<{ id: string | null; version: number | null }>({
    id: note?.id ?? null,
    version: note?.version ?? null
  });
  const revisionRef = useRef(0);
  const savedRevisionRef = useRef(0);
  const runnerRef = useRef<Promise<boolean> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const haltRef = useRef<Halt | null>(null);
  const savedOnceRef = useRef(false);
  const onSavedRef = useRef(onSaved);

  useEffect(() => {
    onSavedRef.current = onSaved;
  });

  function cancelTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function schedule() {
    cancelTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void flush();
    }, AUTOSAVE_DELAY_MS);
  }

  function edit(change: (current: NoteDraft) => NoteDraft) {
    if (haltRef.current === "discarded") {
      return;
    }

    const next = change(draftRef.current);

    draftRef.current = next;
    setDraft(next);
    revisionRef.current += 1;

    // A refused save may be fixed by this very edit, so it gets another try.
    // A conflict or a deleted note waits for the person to choose.
    if (haltRef.current === "invalid") {
      haltRef.current = null;
      setProblem(null);
    }

    if (!haltRef.current) {
      setStatus("dirty");
      schedule();
    }
  }

  function flush(): Promise<boolean> {
    cancelTimer();
    runnerRef.current ??= drain().finally(() => {
      runnerRef.current = null;
    });

    return runnerRef.current;
  }

  async function drain(): Promise<boolean> {
    for (;;) {
      if (haltRef.current) {
        return false;
      }

      const revision = revisionRef.current;

      if (revision === savedRevisionRef.current) {
        setStatus(savedRef.current.id ? "saved" : "idle");
        return true;
      }

      const snapshot = draftRef.current;
      const { id, version } = savedRef.current;

      // An untouched new note is not worth a row; nothing has been lost.
      if (id === null && isNoteContentEmpty(snapshot)) {
        savedRevisionRef.current = revision;
        continue;
      }

      setStatus("saving");

      let result: SaveNoteResult;

      try {
        result = await saveNoteAction({ ...snapshot, expectedVersion: version, id });
      } catch {
        result = { message: "Couldn't reach the server.", status: "error" };
      }

      if (result.status === "saved") {
        // Recorded even if the note is being discarded meanwhile, so the
        // discard knows the id of a note that has only just been created.
        savedRef.current = { id: result.note.id, version: result.note.version };
        savedRevisionRef.current = revision;
        savedOnceRef.current = true;
        onSavedRef.current?.(result.note);
        setNoteId(result.note.id);
        setProblem(null);
        continue; // edits made while that save was in flight go next
      }

      if (haltRef.current === "discarded") {
        return false;
      }

      if (result.status === "conflict") {
        haltRef.current = "conflict";
        setConflict(result.note);
        setStatus("conflict");
      } else if (result.status === "not_found") {
        haltRef.current = "missing";
        setProblem({
          kind: "missing",
          message: "This note was deleted somewhere else. Your text is still here."
        });
        setStatus("error");
      } else if (result.status === "invalid") {
        haltRef.current = "invalid";
        setProblem({ kind: "invalid", message: result.message });
        setStatus("error");
      } else {
        setProblem({ kind: "network", message: `${result.message} Your changes are still here.` });
        setStatus("error");
      }

      return false;
    }
  }

  /**
   * Everything saved, then the note's id — `null` if saving failed or there is
   * nothing to save yet. For pin and archive, which need a row to act on.
   */
  async function ensureSaved() {
    return (await flush()) ? savedRef.current.id : null;
  }

  /** Throw away this draft's edits and carry on from the newer saved copy. */
  function takeTheirs() {
    if (!conflict) {
      return;
    }

    const latest = draftFromNote(conflict);

    draftRef.current = latest;
    setDraft(latest);
    savedRef.current = { id: conflict.id, version: conflict.version };
    revisionRef.current += 1;
    savedRevisionRef.current = revisionRef.current;
    haltRef.current = null;
    setConflict(null);
    setProblem(null);
    setStatus("saved");
  }

  /** Save this draft over the newer copy — a decision, never a default. */
  function keepMine() {
    if (!conflict) {
      return Promise.resolve(false);
    }

    savedRef.current = { id: conflict.id, version: conflict.version };
    haltRef.current = null;
    setConflict(null);

    return flush();
  }

  /** After the note was deleted elsewhere: keep the text as a new note. */
  function saveAsNew() {
    savedRef.current = { id: null, version: null };
    haltRef.current = null;
    revisionRef.current += 1;
    setProblem(null);
    setNoteId(null);

    return flush();
  }

  /**
   * Stop saving for good — the note is being deleted. Waits for a save already
   * in flight so a note that was only just created is known by its id.
   */
  async function discard() {
    cancelTimer();
    haltRef.current = "discarded";

    if (runnerRef.current) {
      await runnerRef.current;
    }

    return savedRef.current.id;
  }

  /** Undo `discard()` when the delete it was for did not happen. */
  function resume() {
    if (haltRef.current === "discarded") {
      haltRef.current = null;
      void flush();
    }
  }

  // Leaving the page — reload, close, typing a URL — asks first while
  // anything typed has not reached the server.
  useEffect(() => {
    if (status === "idle" || status === "saved") {
      return;
    }

    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warn);

    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  // Unmounted with edits pending (the Back button, a client-side navigation):
  // send them now rather than drop them with the timer. Everything it reads is
  // a ref, so the first render's `flush` is as current as any.
  useEffect(
    () => () => {
      if (!haltRef.current && revisionRef.current !== savedRevisionRef.current) {
        void flush();
      }
    },
    []
  );

  return {
    conflict,
    discard,
    draft,
    edit,
    ensureSaved,
    flush,
    hasSaved: () => savedOnceRef.current,
    keepMine,
    noteId,
    problem,
    resume,
    retry: flush,
    saveAsNew,
    status,
    takeTheirs
  };
}
