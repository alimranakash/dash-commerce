"use client";

import { useState } from "react";

type MediaCopyButtonProps = {
  url: string;
};

export function MediaCopyButton({ url }: MediaCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
      type="button"
    >
      {copied ? "Copied" : "Copy URL"}
    </button>
  );
}
