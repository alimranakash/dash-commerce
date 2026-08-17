"use client";

import { Check, Copy, Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { StaffActionState } from "../staff.actions";

/**
 * Shows a freshly created invite link. This is the only time it can ever be
 * shown: the server stores a hash of the token, so once this render is gone the
 * link is unrecoverable and a new invite has to be sent instead. The copy says
 * so plainly rather than leaving the seller to find out later.
 *
 * The absolute URL is assembled in the browser. The seller is already on the
 * app host, so `location.origin` is exactly the host the recipient must open,
 * with no environment variable to configure or get wrong.
 */
export function InviteLinkPanel({ invite }: { invite: NonNullable<StaffActionState["invite"]> }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // A new invite replaces the previous link, so the copied tick must not carry
  // over and suggest the new one is already on the clipboard.
  useEffect(() => {
    setCopied(false);
  }, [invite.path]);

  const url = origin ? `${origin}${invite.path}` : invite.path;

  return (
    <div className="grid gap-3 rounded-lg border border-[#cdbdf7] bg-[#f7f4ff] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link2 className="h-4 w-4 text-[#6d3cf5]" />
        <p className="m-0 text-sm font-semibold text-[#33343e]">
          Invite link for {invite.email} ({invite.role === "ADMIN" ? "Admin" : "Member"})
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-md border border-[#dedcea] bg-white px-3 py-2 font-mono text-xs text-[#292a34]">
          {url}
        </code>
        <button
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[#6d3cf5] px-3 text-xs font-semibold text-white hover:bg-[#5c30d6]"
          onClick={() => {
            void navigator.clipboard?.writeText(url).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          type="button"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>

      <p className="m-0 text-[11px] leading-5 text-[#655d78]">
        Send this to {invite.email} yourself — on WhatsApp, Messenger, or however you normally reach
        them. We do not email it.{" "}
        <strong className="font-semibold">This link is shown once.</strong> If you lose it, revoke
        the invite and send a new one. It expires in 7 days, and only someone signed in as{" "}
        {invite.email} can use it.
      </p>
    </div>
  );
}
