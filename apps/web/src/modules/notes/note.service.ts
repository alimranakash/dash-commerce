import {
  deleteNoteRow,
  findNoteRow,
  insertNoteRow,
  listNoteLabelRows,
  listNoteRows,
  setNoteArchivedRow,
  setNotePinnedRow,
  updateNoteContentRow,
  type NoteOwner,
  type NoteRow
} from "./note.repository";
import {
  isNoteContentEmpty,
  normalizeNoteLabels,
  noteChecklistSchema,
  noteColorSchema,
  noteFiltersSchema,
  noteIdSchema,
  noteSaveSchema,
  noteSearchText,
  type NoteMutationResult,
  type NoteView,
  type SaveNoteResult
} from "./note.schema";

export async function getNotesBoard(owner: NoteOwner, rawFilters: Record<string, unknown>) {
  const filters = noteFiltersSchema.parse(rawFilters);
  const [rows, labels] = await Promise.all([
    listNoteRows(owner, {
      archived: filters.view === "archived",
      label: filters.label,
      q: filters.q
    }),
    listNoteLabelRows(owner)
  ]);

  return { filters, labels, notes: rows.map(toNoteView) };
}

/**
 * One autosave: a create when there is no id yet, otherwise a compare-and-set
 * against the version the editor last saw.
 *
 * When the update matches no row, the row is read once more to tell the two
 * reasons apart — it moved on (a conflict, answered with the newer copy so the
 * editor can offer it) or it is not this person's note in this store at all,
 * which is indistinguishable from never having existed, on purpose.
 */
export async function saveNote(owner: NoteOwner, input: unknown): Promise<SaveNoteResult> {
  const parsed = noteSaveSchema.safeParse(input);

  if (!parsed.success) {
    return {
      message: parsed.error.issues[0]?.message ?? "This note could not be saved.",
      status: "invalid"
    };
  }

  const { expectedVersion, id, ...content } = parsed.data;
  const values = { ...content, searchText: noteSearchText(content) };

  if (id === null) {
    // The editor never creates an empty note; refusing one here keeps a stray
    // request from littering the board.
    if (isNoteContentEmpty(content)) {
      return { message: "Write something before saving the note.", status: "invalid" };
    }

    const created = await insertNoteRow(owner, values);

    return created
      ? { note: toNoteView(created), status: "saved" }
      : { message: "This note could not be saved.", status: "error" };
  }

  if (expectedVersion === null) {
    return { message: "This note could not be saved.", status: "invalid" };
  }

  const updated = await updateNoteContentRow(owner, id, expectedVersion, values);

  if (updated) {
    return { note: toNoteView(updated), status: "saved" };
  }

  const current = await findNoteRow(owner, id);

  return current ? { note: toNoteView(current), status: "conflict" } : { status: "not_found" };
}

export async function setNotePinned(
  owner: NoteOwner,
  id: unknown,
  pinned: unknown
): Promise<NoteMutationResult> {
  const noteId = noteIdSchema.safeParse(id);

  if (!noteId.success || typeof pinned !== "boolean") {
    return { status: "not_found" };
  }

  return (await setNotePinnedRow(owner, noteId.data, pinned))
    ? { status: "ok" }
    : { status: "not_found" };
}

export async function setNoteArchived(
  owner: NoteOwner,
  id: unknown,
  archived: unknown
): Promise<NoteMutationResult> {
  const noteId = noteIdSchema.safeParse(id);

  if (!noteId.success || typeof archived !== "boolean") {
    return { status: "not_found" };
  }

  return (await setNoteArchivedRow(owner, noteId.data, archived))
    ? { status: "ok" }
    : { status: "not_found" };
}

export async function deleteNote(owner: NoteOwner, id: unknown): Promise<NoteMutationResult> {
  const noteId = noteIdSchema.safeParse(id);

  if (!noteId.success) {
    return { status: "not_found" };
  }

  return (await deleteNoteRow(owner, noteId.data)) ? { status: "ok" } : { status: "not_found" };
}

/**
 * A row as the dashboard may see it. The stored checklist and colour are
 * re-validated rather than trusted, so a row edited by hand degrades to an
 * empty checklist or the default colour instead of breaking the board.
 */
function toNoteView(row: NoteRow): NoteView {
  const checklist = noteChecklistSchema.safeParse(parseJson(row.checklist));
  const color = noteColorSchema.safeParse(row.color);
  const labels = Array.isArray(row.labels)
    ? row.labels.filter((label): label is string => typeof label === "string")
    : [];

  return {
    archived: row.archivedAt !== null,
    body: row.body,
    checklist: checklist.success ? checklist.data : [],
    color: color.success ? color.data : "default",
    id: row.id,
    labels: normalizeNoteLabels(labels),
    pinned: row.pinned,
    title: row.title,
    updatedAt: new Date(row.updatedAt).toISOString(),
    version: Number(row.version)
  };
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
