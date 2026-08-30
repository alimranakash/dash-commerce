"use client";

import { Check, Copy, Eye, EyeOff, KeyRound, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { copyToClipboard } from "../../../lib/clipboard";
import type { AiKeyActionState } from "../ai-key.actions";

/**
 * Shows a freshly minted API key, with the warning that belongs beside it.
 *
 * The key is masked until the seller asks for it. Creating a key is something
 * people do with somebody looking over their shoulder or a screen being shared,
 * and a credential that paints itself across the page uninvited is the reason
 * they end up rotating it an hour later. Copy works without revealing, which is
 * the path most people want anyway.
 */
export function ApiKeyRevealPanel({
  createdKey
}: {
  createdKey: NonNullable<AiKeyActionState["createdKey"]>;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-[#cdbdf7] bg-[#f7f4ff] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <KeyRound className="h-4 w-4 text-[#6d3cf5]" />
        <p className="m-0 text-sm font-semibold text-[#33343e]">API key for {createdKey.name}</p>
      </div>

      <p className="m-0 flex items-start gap-2 rounded-lg border border-[#f4e6d8] bg-[#fffaf4] px-3 py-2.5 text-[12px] leading-5 text-[#8a6134]">
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          <strong className="font-semibold">Treat this like a password.</strong> Anyone holding it
          can read whatever its{" "}
          {createdKey.scopes.length === 1
            ? "scope allows"
            : `${createdKey.scopes.length} scopes allow`}
          , for as long as the key exists. Send it over something private, never a public channel.
        </span>
      </p>

      <SecretValue label={`API key for ${createdKey.name}`} value={createdKey.key} />

      <p className="m-0 text-[11px] leading-5 text-[#655d78]">
        In the list below this key shows as <span className="font-mono">…{createdKey.hint}</span>.
        You can open it again from there whenever you need it.
      </p>
    </div>
  );
}

/**
 * A secret behind a show/hide toggle, with a copy button that works either way.
 *
 * Shared by the panel above and by each row of the key list, so a key looks and
 * behaves the same whether it was just created or looked up a month later.
 */
export function SecretValue({
  defaultVisible = false,
  label,
  value
}: {
  /** True where the seller has just asked for this exact secret and nothing else. */
  defaultVisible?: boolean;
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [visible, setVisible] = useState(defaultVisible);

  // A different secret in the same slot must not inherit the previous one's
  // copied tick, or its revealed state.
  useEffect(() => {
    setCopied(false);
    setCopyFailed(false);
    setVisible(defaultVisible);
  }, [defaultVisible, value]);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = setTimeout(() => setCopied(false), 2000);

    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <code
          className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-md border border-[#dedcea] bg-white px-3 py-2 font-mono text-xs text-[#292a34]"
          // Masked in the DOM as well as on screen, so a screenshot, a shared
          // tab, or the browser's own find-in-page cannot pick it up.
          title={visible ? undefined : "Hidden — press Show to read it"}
        >
          {visible ? value : maskSecret(value)}
        </code>

        <button
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-[#dedcea] bg-white px-3 text-xs font-semibold text-[#4b4c59] hover:bg-[#f6f5fa]"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {visible ? "Hide" : "Show"}
        </button>

        <button
          aria-label={`Copy ${label}`}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[#6d3cf5] px-3 text-xs font-semibold text-white hover:bg-[#5c30d6]"
          onClick={() => {
            void copyToClipboard(value).then((ok) => {
              setCopied(ok);
              setCopyFailed(!ok);
            });
          }}
          type="button"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {copyFailed ? (
        <span className="text-[11px] leading-5 text-[#c02b52]">
          Your browser blocked the copy. Press Show, then select the key and copy it by hand.
        </span>
      ) : null}
    </div>
  );
}

/** Keeps the prefix, so the masked form still reads as a key rather than noise. */
function maskSecret(value: string) {
  const visibleLead = value.startsWith("sk_live_") ? "sk_live_".length : 4;

  return `${value.slice(0, visibleLead)}${"•".repeat(Math.max(value.length - visibleLead, 0))}`;
}
