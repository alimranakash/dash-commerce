"use client";

import { Check, Copy, KeyRound, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import type { AiKeyActionState } from "../ai-key.actions";

/**
 * Shows a freshly minted API key. This is the only time it can ever be shown:
 * the server stores a SHA-256 of it, so once this render is gone the key is
 * unrecoverable and a new one has to be issued instead.
 *
 * The same shape as `InviteLinkPanel`, deliberately — a seller who has copied a
 * staff invite link once already knows how this works. The warning is stated
 * before the key rather than under it, because that is the order it needs to be
 * read in.
 */
export function ApiKeyRevealPanel({
  createdKey
}: {
  createdKey: NonNullable<AiKeyActionState["createdKey"]>;
}) {
  const [copied, setCopied] = useState(false);

  // A newly created key replaces the previous one on screen, so the copied tick
  // must not carry over and suggest the new key is already on the clipboard.
  useEffect(() => {
    setCopied(false);
  }, [createdKey.id]);

  return (
    <div className="grid gap-3 rounded-lg border border-[#cdbdf7] bg-[#f7f4ff] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <KeyRound className="h-4 w-4 text-[#6d3cf5]" />
        <p className="m-0 text-sm font-semibold text-[#33343e]">API key for {createdKey.name}</p>
      </div>

      <p className="m-0 flex items-start gap-2 rounded-lg border border-[#f4e6d8] bg-[#fffaf4] px-3 py-2.5 text-[12px] leading-5 text-[#8a6134]">
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          <strong className="font-semibold">This is the only time this key is shown.</strong> We
          store a one-way hash of it, so nobody — including us — can look it up again. Copy it into
          StoreOS AI now. If you lose it, revoke this key and create another.
        </span>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-md border border-[#dedcea] bg-white px-3 py-2 font-mono text-xs text-[#292a34]">
          {createdKey.key}
        </code>
        <button
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[#6d3cf5] px-3 text-xs font-semibold text-white hover:bg-[#5c30d6]"
          onClick={() => {
            void navigator.clipboard?.writeText(createdKey.key).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          type="button"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy key"}
        </button>
      </div>

      <p className="m-0 text-[11px] leading-5 text-[#655d78]">
        Treat it like a password: for as long as it exists it can read whatever its{" "}
        {createdKey.scopes.length === 1
          ? "scope allows"
          : `${createdKey.scopes.length} scopes allow`}
        . Send it over something private, never a public channel. In the list below it will appear
        only as <span className="font-mono">…{createdKey.hint}</span>.
      </p>
    </div>
  );
}
