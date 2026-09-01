"use client";

import { Button } from "@dash/ui";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Database,
  RotateCcw,
  SendHorizonal,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import type {
  StoreCopilotActionResult,
  StoreCopilotAskInput,
  StoreCopilotMessage,
  StoreCopilotReply
} from "../store-copilot.schema";

/**
 * The AI Store Copilot chat, and the only place a merchant approves a change the
 * assistant proposed.
 *
 * Three things this renders that a plain chat bubble would not, each of them
 * load-bearing:
 *
 * - **Where the answer came from.** Every reply is badged with the engine that
 *   wrote it and the store data it read. A merchant deciding whether to act on
 *   "you have 4 products low on stock" is owed the fact that it came from their
 *   own inventory rather than from a model's memory.
 * - **The change, in full, before it happens.** A proposal is a card of fields
 *   under a Confirm button, never a sentence the assistant has already acted on.
 *   Nothing is written until that button is pressed, and the composer says so on
 *   every screen so it is never a surprise.
 * - **The downgrade warnings.** When a provider was rate-limited or unreachable
 *   the reply says so above the answer, so a template is never mistaken for AI.
 *
 * The transcript lives in this component and is posted back with each question.
 * It is context for phrasing only — every figure in every answer is re-read from
 * the store on the server — so losing it on a refresh costs nothing but the
 * thread of the conversation, which is what makes "New chat" free.
 */

type ChatEntry = {
  actionDismissed?: boolean;
  /** Set once the merchant has confirmed this entry's proposal. */
  actionOutcome?: { ok: boolean; text: string };
  content: string;
  reply?: StoreCopilotReply;
  role: "assistant" | "user";
};

type StoreCopilotChatProps = {
  ask: (input: StoreCopilotAskInput) => Promise<StoreCopilotReply>;
  /** The provider label, or null when the store runs on the offline briefing. */
  engineLabel: string | null;
  intro: string;
  run: (action: unknown) => Promise<StoreCopilotActionResult>;
  suggestedPrompts: string[];
};

/** How much of the conversation is posted back. Matches `storeCopilotAskSchema`. */
const HISTORY_TURNS = 6;

/** Matches the `message` ceiling in `storeCopilotAskSchema`. */
const MESSAGE_LIMIT = 1000;

const SOURCE_LABELS: Record<StoreCopilotReply["source"], string> = {
  gemini: "Written by Gemini",
  offline: "Read straight from your dashboard",
  openai: "Written by OpenAI"
};

/** The read tools, in the merchant's words rather than the enum's. */
const TOOL_LABELS: Record<string, string> = {
  list_customers: "customers",
  list_inventory: "stock",
  list_orders: "orders",
  list_products: "products",
  sales_report: "reports",
  store_overview: "store summary"
};

export function StoreCopilotChat({
  ask,
  engineLabel,
  intro,
  run,
  suggestedPrompts
}: StoreCopilotChatProps) {
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [entries, setEntries] = useState<ChatEntry[]>([{ content: intro, role: "assistant" }]);
  const [runningIndex, setRunningIndex] = useState<number | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const lastReply = [...entries].reverse().find((entry) => entry.reply)?.reply;
  const followUps = lastReply?.followUps ?? [];
  const prompts = followUps.length ? followUps : suggestedPrompts;
  const isAsking = isPending && runningIndex === null;

  // A chat that does not follow its own tail makes the merchant scroll after
  // every question they ask.
  useEffect(() => {
    logRef.current?.scrollTo({ behavior: "smooth", top: logRef.current.scrollHeight });
  }, [entries.length, isAsking]);

  function sendMessage(message: string) {
    const trimmed = message.trim().slice(0, MESSAGE_LIMIT);

    if (!trimmed || isPending) {
      return;
    }

    setInput("");
    setEntries((current) => [...current, { content: trimmed, role: "user" }]);

    startTransition(async () => {
      const reply = await ask({ history: toHistory(entries), message: trimmed });

      setEntries((current) => [...current, { content: reply.answer, reply, role: "assistant" }]);
    });
  }

  function confirmAction(index: number) {
    const action = entries[index]?.reply?.action;

    if (!action || runningIndex !== null) {
      return;
    }

    setRunningIndex(index);

    startTransition(async () => {
      const result = await run(action);

      setEntries((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                actionOutcome: result.ok
                  ? { ok: true, text: result.message }
                  : { ok: false, text: result.error }
              }
            : item
        )
      );
      setRunningIndex(null);
    });
  }

  function dismissAction(index: number) {
    setEntries((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, actionDismissed: true } : item
      )
    );
  }

  function startOver() {
    setEntries([{ content: intro, role: "assistant" }]);
    setInput("");
    inputRef.current?.focus();
  }

  return (
    <div className="copilot-chat">
      <header className="copilot-chat-header">
        <span aria-hidden="true" className="copilot-chat-avatar">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="copilot-chat-identity">
          <strong>AI Store Copilot</strong>
          <p>
            {engineLabel
              ? `Live store data, written up by ${engineLabel}`
              : "Answers read straight from your live store data"}
          </p>
        </div>
        <button
          className="copilot-chat-reset"
          disabled={isPending || entries.length <= 1}
          onClick={startOver}
          type="button"
        >
          <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
          New chat
        </button>
      </header>

      <div aria-busy={isPending} className="copilot-chat-log" ref={logRef} role="log">
        {entries.map((entry, index) => (
          <article
            className={`copilot-turn copilot-turn-${entry.role}`}
            key={`${entry.role}-${index}`}
          >
            {entry.role === "assistant" ? (
              <span aria-hidden="true" className="copilot-turn-avatar">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
            ) : null}

            <div className="copilot-bubble">
              <p className="copilot-turn-who">
                {entry.role === "assistant" ? "Store Copilot" : "You"}
              </p>

              {entry.content
                .split("\n")
                .filter((line) => line.trim())
                .map((line, lineIndex) => (
                  <p className="copilot-turn-line" key={lineIndex}>
                    {line}
                  </p>
                ))}

              {entry.reply?.warnings.map((warning) => (
                <p className="copilot-note" key={warning}>
                  <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  <span>{warning}</span>
                </p>
              ))}

              {entry.reply ? (
                <p className="copilot-meta">
                  <span className="copilot-pill">
                    <BadgeCheck aria-hidden="true" className="h-3 w-3" />
                    {SOURCE_LABELS[entry.reply.source]}
                  </span>
                  {entry.reply.used.map((tool) => (
                    <span className="copilot-pill copilot-pill-quiet" key={tool}>
                      <Database aria-hidden="true" className="h-3 w-3" />
                      {TOOL_LABELS[tool] ?? tool.replace(/_/g, " ")}
                    </span>
                  ))}
                </p>
              ) : null}

              {entry.reply?.actionPreview && !entry.actionDismissed ? (
                <section className="copilot-action">
                  <header className="copilot-action-header">
                    <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
                    <div>
                      <strong>{entry.reply.actionPreview.label}</strong>
                      <span>Needs your approval — nothing has changed yet</span>
                    </div>
                  </header>

                  <dl className="copilot-action-rows">
                    {entry.reply.actionPreview.rows.map((row) => (
                      <div key={row.label}>
                        <dt>{row.label}</dt>
                        <dd>{row.value}</dd>
                      </div>
                    ))}
                  </dl>

                  {entry.actionOutcome ? (
                    <p className={entry.actionOutcome.ok ? "copilot-action-done" : "copilot-note"}>
                      {entry.actionOutcome.ok ? (
                        <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
                      ) : (
                        <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span>{entry.actionOutcome.text}</span>
                    </p>
                  ) : (
                    <div className="copilot-action-buttons">
                      <Button
                        className="primary action-button"
                        disabled={runningIndex !== null}
                        onClick={() => confirmAction(index)}
                        type="button"
                      >
                        {runningIndex === index ? "Applying..." : "Confirm & apply"}
                      </Button>
                      <button
                        className="copilot-action-dismiss"
                        disabled={runningIndex !== null}
                        onClick={() => dismissAction(index)}
                        type="button"
                      >
                        Not now
                      </button>
                    </div>
                  )}
                </section>
              ) : null}
            </div>
          </article>
        ))}

        {isAsking ? (
          <article className="copilot-turn copilot-turn-assistant">
            <span aria-hidden="true" className="copilot-turn-avatar">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <div className="copilot-bubble">
              <p className="copilot-turn-who">Store Copilot</p>
              <p className="copilot-typing">
                <span />
                <span />
                <span />
                <em>Reading your store</em>
              </p>
            </div>
          </article>
        ) : null}
      </div>

      <div className="copilot-chat-footer">
        {prompts.length ? (
          <div className="copilot-suggestions">
            <span className="copilot-suggestions-label">
              {followUps.length ? "Ask next" : "Try asking"}
            </span>
            <div className="copilot-suggestion-row">
              {prompts.map((prompt) => (
                <button
                  className="copilot-chip"
                  disabled={isPending}
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  type="button"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <form
          className="copilot-composer"
          onSubmit={(event) => {
            event.preventDefault();
            sendMessage(input);
          }}
        >
          <textarea
            aria-label="Ask about your store"
            className="copilot-composer-input"
            disabled={isPending}
            maxLength={MESSAGE_LIMIT}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends, Shift+Enter breaks the line. Someone typing a
              // one-line question should never reach for the mouse, and the hint
              // under the box says which is which.
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="Ask about sales, orders, products, customers or stock..."
            ref={inputRef}
            rows={1}
            value={input}
          />
          <Button
            className="primary action-button copilot-composer-send"
            disabled={isPending || !input.trim()}
            type="submit"
          >
            <SendHorizonal aria-hidden="true" className="h-4 w-4" />
            <span>{isAsking ? "Asking..." : "Ask"}</span>
          </Button>
        </form>

        <p className="copilot-composer-hint">
          <span>Enter to send · Shift + Enter for a new line · Changes need your approval</span>
          {input.length > MESSAGE_LIMIT - 120 ? (
            <span className="copilot-composer-count">
              {input.length}/{MESSAGE_LIMIT}
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}

/**
 * The tail of the conversation, as the schema wants it.
 *
 * The opening greeting is dropped: it is this component's own copy rather than
 * something the assistant said about the store, and carrying it would spend the
 * merchant's own tokens re-reading a sentence every turn.
 */
function toHistory(entries: ChatEntry[]): StoreCopilotMessage[] {
  return entries
    .filter((entry) => entry.role === "user" || entry.reply)
    .slice(-HISTORY_TURNS)
    .map((entry) => ({ content: entry.content.slice(0, 4000), role: entry.role }));
}
