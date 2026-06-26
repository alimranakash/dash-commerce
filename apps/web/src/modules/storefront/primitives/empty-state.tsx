import type { ReactNode } from "react";

export function StorefrontEmptyState({ action, description, title }: { action?: ReactNode; description: string; title: string }) {
  return (
    <div className="sf-foundation-empty">
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
