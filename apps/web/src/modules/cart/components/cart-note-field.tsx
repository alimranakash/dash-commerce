"use client";

import { useState, useTransition } from "react";
import { submitCartAction } from "./cart-client-actions";

type CartNoteFieldProps = {
  className: string;
  note: string;
  rows: number;
  storeId: string;
  storeSlug: string;
};

// Shared by the cart page and the mini cart drawer: the note is stored on the
// cart cookie on blur, so checkout can carry it onto the order.
export function CartNoteField({ className, note, rows, storeId, storeSlug }: CartNoteFieldProps) {
  const [value, setValue] = useState(note);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function persist() {
    if (value.trim() === note.trim()) {
      return;
    }

    startTransition(async () => {
      const result = await submitCartAction({
        cartAction: "note",
        note: value,
        storeId,
        storeSlug
      });

      setSaved(result.ok);
      setError(result.ok ? "" : result.message);
    });
  }

  return (
    <details className={className}>
      <summary>Order Notes</summary>
      <textarea
        aria-label="Order notes"
        disabled={isPending}
        maxLength={1000}
        onBlur={persist}
        onChange={(event) => {
          setValue(event.target.value);
          setSaved(false);
        }}
        placeholder="Add a note for your order"
        rows={rows}
        value={value}
      />
      {error ? <small className="sf-alert">{error}</small> : null}
      {!error && saved ? <small>Saved to your order.</small> : null}
    </details>
  );
}
