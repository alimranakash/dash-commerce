import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { requireUser } from "../../../lib/auth";
import { NotesBoard } from "../../../modules/notes/components/notes-board";
import { noteFiltersSchema } from "../../../modules/notes/note.schema";
import { getNotesBoard } from "../../../modules/notes/note.service";
import { requireStore } from "../../../modules/stores/queries";

type NotesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NotesPage({ searchParams }: NotesPageProps) {
  // Outside the try: both guards redirect, and a redirect is not a load error.
  const store = await requireStore();
  const user = await requireUser();
  const params = await searchParams;
  const rawFilters = {
    label: valueOf(params.label),
    q: valueOf(params.q),
    view: valueOf(params.view)
  };
  let board: Awaited<ReturnType<typeof getNotesBoard>> | null = null;

  try {
    board = await getNotesBoard({ storeId: store.id, userId: user.id }, rawFilters);
  } catch (error) {
    console.error("[notes] board failed to load", error);
  }

  return (
    <DashboardShell storeSlug={store.slug}>
      <NotesBoard
        filters={board?.filters ?? noteFiltersSchema.parse(rawFilters)}
        labels={board?.labels ?? []}
        loadError={board ? null : "Something went wrong on our side. Your notes are safe."}
        notes={board?.notes ?? []}
      />
    </DashboardShell>
  );
}

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}
