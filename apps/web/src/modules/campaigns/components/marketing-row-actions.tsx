"use client";

import { Loader2, Pencil, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  deleteAudienceAction,
  deleteTemplateAction,
  refreshAudienceCountAction
} from "../audience.actions";

type RowActionsProps = {
  editHref: string;
  id: string;
  kind: "audience" | "template";
  name: string;
};

/**
 * Edit / recount / delete for an audience or template row.
 *
 * One component for both because the two differ only in which action they call
 * and whether recounting means anything — a second near-identical file would
 * drift the moment one of them grew a confirmation dialog.
 */
export function MarketingRowActions({ editHref, id, kind, name }: RowActionsProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  function remove() {
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) {
      return;
    }

    setError(null);
    setNote(null);

    startTransition(async () => {
      const result =
        kind === "audience" ? await deleteAudienceAction(id) : await deleteTemplateAction(id);

      // A successful delete redirects and never returns, so anything that comes
      // back is a refusal worth showing — an audience still in use, usually.
      if (result?.status === "error") {
        setError(result.message ?? "That could not be deleted.");
      }
    });
  }

  function recount() {
    setError(null);
    setNote(null);

    startTransition(async () => {
      const count = await refreshAudienceCountAction(id);

      setNote(count === null ? null : `${count.toLocaleString("en")} customers match`);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center justify-end gap-1.5">
        {kind === "audience" ? (
          <button
            className="rounded-md border border-[#e5e3f1] px-2.5 py-1.5 text-xs font-medium text-[#555762] transition hover:bg-[#f7f7fb] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pending}
            onClick={recount}
            type="button"
          >
            <RefreshCw aria-hidden="true" className="mr-1 inline h-3 w-3" />
            Recount
          </button>
        ) : null}
        <Link
          aria-label={`Edit ${name}`}
          className="grid h-8 w-8 place-items-center rounded-md border border-[#e5e3f1] text-[#555762] transition hover:bg-[#f7f7fb]"
          href={editHref}
        >
          <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
        </Link>
        <button
          aria-label={`Delete ${name}`}
          className="grid h-8 w-8 place-items-center rounded-md border border-[#f5c9d0] text-[#f05268] transition hover:bg-[#fdf2f4] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending}
          onClick={remove}
          type="button"
        >
          {pending ? (
            <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      {note ? (
        <p aria-live="polite" className="m-0 text-xs text-[#119c73]">
          {note}
        </p>
      ) : null}
      {error ? (
        <p aria-live="polite" className="m-0 max-w-xs text-right text-xs text-[#b3273f]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
