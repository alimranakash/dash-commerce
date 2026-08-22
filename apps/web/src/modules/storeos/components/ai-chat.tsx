"use client";

import { Button } from "@dash/ui";
import { useState, useTransition } from "react";
import type { StoreOSChatActionResult } from "../storeos.actions";

type AIChatMessage = {
  content: string;
  role: "assistant" | "user";
};

type AIChatProps = {
  action: (message: string) => Promise<StoreOSChatActionResult>;
  initialMessage: string;
  suggestedPrompts: string[];
};

export function AIChat({ action, initialMessage, suggestedPrompts }: AIChatProps) {
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      content: initialMessage,
      role: "assistant"
    }
  ]);

  function sendMessage(message: string) {
    const trimmed = message.trim();

    if (!trimmed || isPending) {
      return;
    }

    setInput("");
    setMessages((current) => [
      ...current,
      {
        content: trimmed,
        role: "user"
      }
    ]);

    startTransition(async () => {
      const response = await action(trimmed);

      setMessages((current) => [
        ...current,
        {
          content: response.message,
          role: "assistant"
        }
      ]);
    });
  }

  return (
    <div className="ai-chat">
      <div className="ai-chat-history" aria-live="polite">
        {messages.map((message, index) => (
          <div className={`ai-message ${message.role}`} key={`${message.role}-${index}`}>
            <span>{message.role === "assistant" ? "StoreIM AI" : "You"}</span>
            <p>{message.content}</p>
          </div>
        ))}
      </div>
      <div className="ai-suggestions" aria-label="Suggested prompts">
        {suggestedPrompts.map((prompt) => (
          <button disabled={isPending} key={prompt} onClick={() => sendMessage(prompt)} type="button">
            {prompt}
          </button>
        ))}
      </div>
      <form
        className="ai-chat-form"
        onSubmit={(event) => {
          event.preventDefault();
          sendMessage(input);
        }}
      >
        <input
          aria-label="Message"
          disabled={isPending}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about orders, sales, products, or operations"
          type="text"
          value={input}
        />
        <Button className="primary action-button" disabled={isPending || !input.trim()} type="submit">
          {isPending ? "Sending..." : "Send"}
        </Button>
      </form>
    </div>
  );
}
