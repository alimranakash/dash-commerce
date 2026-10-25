"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../../lib/auth";
import { requireStore } from "../stores/queries";
import type { NoteOwner } from "./note.repository";
import type { NoteMutationResult, NoteSaveInput, SaveNoteResult } from "./note.schema";
import { deleteNote, saveNote, setNoteArchived, setNotePinned } from "./note.service";

const NOTES_PATH = "/dashboard/notes";

/**
 * Notes are ordinary work, so any team member may keep them — but only their
 * own. The owner is the session's user in the session's store, resolved here on
 * every call; nothing the browser posts can name a store or a user.
 */
async function requireNoteOwner(): Promise<NoteOwner> {
  const store = await requireStore();
  const user = await requireUser();

  return { storeId: store.id, userId: user.id };
}

/**
 * Autosave. Deliberately does not revalidate: it runs every few seconds while
 * someone types, and the editor holds the draft itself. The board refreshes
 * once, when the editor closes.
 */
export async function saveNoteAction(input: NoteSaveInput): Promise<SaveNoteResult> {
  const owner = await requireNoteOwner();

  try {
    return await saveNote(owner, input);
  } catch (error) {
    console.error("[notes] save failed", error);
    return { message: "Couldn't save just now.", status: "error" };
  }
}

export async function setNotePinnedAction(
  noteId: string,
  pinned: boolean
): Promise<NoteMutationResult> {
  const owner = await requireNoteOwner();

  return runMutation(() => setNotePinned(owner, noteId, pinned));
}

export async function setNoteArchivedAction(
  noteId: string,
  archived: boolean
): Promise<NoteMutationResult> {
  const owner = await requireNoteOwner();

  return runMutation(() => setNoteArchived(owner, noteId, archived));
}

export async function deleteNoteAction(noteId: string): Promise<NoteMutationResult> {
  const owner = await requireNoteOwner();

  return runMutation(() => deleteNote(owner, noteId));
}

async function runMutation(mutate: () => Promise<NoteMutationResult>): Promise<NoteMutationResult> {
  let result: NoteMutationResult;

  try {
    result = await mutate();
  } catch (error) {
    console.error("[notes] update failed", error);
    return { message: "Couldn't update the note just now. Try again.", status: "error" };
  }

  revalidatePath(NOTES_PATH);

  return result;
}
