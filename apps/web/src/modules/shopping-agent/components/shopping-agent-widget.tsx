"use client";

import {
  AlertTriangle,
  CheckCircle2,
  MessagesSquare,
  Receipt,
  SendHorizonal,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  X
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { notifyCartUpdated } from "../../cart/components/cart-client-actions";
import { StorefrontImage } from "../../storefront/components/storefront-image";
import { formatStorefrontMoney } from "../../storefront/format";
import type {
  ShoppingAgentActionResult,
  ShoppingAgentAskInput,
  ShoppingAgentCartView,
  ShoppingAgentComparison,
  ShoppingAgentMessage,
  ShoppingAgentOrderReceipt,
  ShoppingAgentProductCard,
  ShoppingAgentReply
} from "../shopping-agent.schema";

/**
 * The AI Shopping Agent, as a shopper meets it.
 *
 * A launcher in the corner of every storefront page and a panel that opens over
 * it. Four things it renders that a plain chat bubble would not, each of them
 * load-bearing:
 *
 * - **Products as cards, not as prose.** The server draws every card from the
 *   catalogue row, so the price beside the picture is the price the cart will
 *   charge. A model that recommends something it invented produces no card, and
 *   the shopper is never sold a product that does not exist. The card's own Add
 *   to cart button is a direct add, exactly like the one on the product page —
 *   the shopper pressing it is the decision, not something to re-confirm.
 * - **What the assistant proposes, in full, before it happens.** Anything the
 *   model suggested is a card of fields under a Confirm button, and the order
 *   card is styled apart on purpose — one of those buttons spends money.
 * - **The receipt and its payment link.** Once the order exists the chat hands
 *   over the order number and a link to the shop's own order page, which is
 *   where the bKash, Nagad or Rocket instructions live.
 * - **Which engine answered.** A reply assembled from the catalogue says so
 *   rather than being passed off as AI.
 *
 * The transcript lives here and is posted back with each message. It is context
 * for phrasing only — every price, stock level and total is re-read on the
 * server each turn — so losing it on a refresh costs nothing but the thread.
 */

type ChatEntry = {
  actionDismissed?: boolean;
  actionOutcome?: { handoffHref?: string | null; ok: boolean; text: string };
  content: string;
  order?: ShoppingAgentOrderReceipt | null;
  reply?: ShoppingAgentReply;
  role: "assistant" | "user";
};

type ShoppingAgentWidgetProps = {
  ask: (input: { ask: ShoppingAgentAskInput; storeSlug: string }) => Promise<ShoppingAgentReply>;
  currency: string;
  /** The provider label, or null when the shop runs on the guided assistant. */
  engineLabel: string | null;
  run: (input: { action: unknown; storeSlug: string }) => Promise<ShoppingAgentActionResult>;
  storeName: string;
  storeSlug: string;
  suggestedPrompts: string[];
};

/** How much of the conversation is posted back. Matches `shoppingAgentAskSchema`. */
const HISTORY_TURNS = 8;

/** Matches the `message` ceiling in `shoppingAgentAskSchema`. */
const MESSAGE_LIMIT = 600;

/** Where the auto-growing composer stops. Matches the CSS `max-height`. */
const COMPOSER_MAX_HEIGHT = 132;

/** How close to the ceiling the character counter appears. */
const COUNTER_THRESHOLD = 80;

export function ShoppingAgentWidget({
  ask,
  currency,
  engineLabel,
  run,
  storeName,
  storeSlug,
  suggestedPrompts
}: ShoppingAgentWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [runningIndex, setRunningIndex] = useState<number | null>(null);
  /** The product whose own Add to cart button is mid-flight, if any. */
  const [addingId, setAddingId] = useState<string | null>(null);
  const [cart, setCart] = useState<ShoppingAgentCartView | null>(null);
  const [entries, setEntries] = useState<ChatEntry[]>(() => [
    {
      content: `Hi! I can help you find something in ${storeName}. Tell me what you are after and roughly what you would like to spend.`,
      role: "assistant"
    }
  ]);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  const lastReply = [...entries].reverse().find((entry) => entry.reply)?.reply;
  const followUps = lastReply?.followUps ?? [];
  const prompts = followUps.length ? followUps : suggestedPrompts;
  const isAsking = isPending && runningIndex === null && addingId === null;
  const remaining = MESSAGE_LIMIT - input.length;

  // A chat that does not follow its own tail makes the shopper scroll after
  // every message they send.
  useEffect(() => {
    logRef.current?.scrollTo({ behavior: "smooth", top: logRef.current.scrollHeight });
  }, [entries.length, isAsking, isOpen]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Escape closes the panel and hands focus back to the launcher, the contract
  // every other overlay on the storefront keeps. Bound to the document rather
  // than the panel so it still works while focus sits on a product link inside
  // the conversation.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        launcherRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  /**
   * The composer grows with the message instead of scrolling inside one line.
   *
   * Height is cleared before it is measured so the box shrinks again when the
   * shopper deletes a line; the CSS max-height is what stops it from eating the
   * conversation above it.
   */
  function fitComposer(element: HTMLTextAreaElement) {
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, COMPOSER_MAX_HEIGHT)}px`;
  }

  function sendMessage(message: string) {
    const trimmed = message.trim().slice(0, MESSAGE_LIMIT);

    if (!trimmed || isPending) {
      return;
    }

    setInput("");

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    setEntries((current) => [...current, { content: trimmed, role: "user" }]);

    startTransition(async () => {
      const reply = await ask({
        ask: { history: toHistory(entries), message: trimmed },
        storeSlug
      });

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
      const result = await run({ action, storeSlug });

      if (result.ok) {
        setCart(result.cart);
        // The header's cart count and the mini-cart drawer both listen for this.
        // Without it a shopper who added something in the chat sees the old
        // count until they navigate, and assumes it did not work.
        notifyCartUpdated();
      }

      setEntries((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                actionOutcome: result.ok
                  ? { ok: true, text: result.message }
                  : { handoffHref: result.handoffHref, ok: false, text: result.error },
                order: result.ok ? result.order : null
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

  /**
   * The card's own Add to cart button, which does not go through the model.
   *
   * The shopper pressed a button labelled Add to cart on a card showing the
   * price — that *is* the confirmation, exactly as it is on the product page, so
   * asking them to confirm a proposal afterwards would be a second click for
   * nothing. The Confirm card is for changes the assistant proposed, not for
   * ones the shopper asked for by hand.
   *
   * It also has to work when there is no model at all: a shop running the guided
   * assistant would otherwise have a button that types "Add X to my cart" into a
   * keyword classifier and gets back a description of the cart.
   */
  function addProduct(product: ShoppingAgentProductCard) {
    if (isPending || addingId) {
      return;
    }

    setAddingId(product.id);

    startTransition(async () => {
      const result = await run({
        action: { productId: product.id, quantity: 1, type: "add_to_cart" },
        storeSlug
      });

      if (result.ok) {
        setCart(result.cart);
        notifyCartUpdated();
      }

      setEntries((current) => [
        ...current,
        { content: result.ok ? result.message : result.error, role: "assistant" }
      ]);
      setAddingId(null);
    });
  }

  return (
    <>
      {/* Open, the launcher drops its label and becomes the panel's anchor: the
          header already carries a close button, and two wide buttons doing the
          same thing is what left the corner looking unfinished. */}
      <button
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close the shopping assistant" : "Ask the shopping assistant"}
        className={`sfagent-launcher${isOpen ? " sfagent-launcher-open" : ""}`}
        onClick={() => setIsOpen((current) => !current)}
        ref={launcherRef}
        type="button"
      >
        {isOpen ? (
          <X aria-hidden="true" className="h-5 w-5" />
        ) : (
          <MessagesSquare aria-hidden="true" className="h-5 w-5" />
        )}
        <span className="sfagent-launcher-label">Ask for help</span>
      </button>

      {isOpen ? (
        <section aria-label="Shopping assistant" className="sfagent-panel">
          <header className="sfagent-head">
            <span aria-hidden="true" className="sfagent-avatar">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="sfagent-identity">
              <strong>Shopping assistant</strong>
              {/* The shop's name is already on every pixel of the page behind
                  this panel. Repeating it here only pushed the half that matters
                  — where the answers come from — past the ellipsis. */}
              <p>
                <span aria-hidden="true" className="sfagent-status-dot" />
                {engineLabel ? "Answers from this catalogue" : "Searching this catalogue"}
              </p>
            </div>
            <button
              aria-label="Close the shopping assistant"
              className="sfagent-close"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </header>

          <div aria-busy={isPending} className="sfagent-log" ref={logRef} role="log">
            {/* Only while the greeting is still alone. The log anchors its
                content to the bottom, so without this the panel opens as one
                small bubble under a tall empty rectangle. */}
            {entries.length === 1 ? (
              <div className="sfagent-intro">
                <span aria-hidden="true" className="sfagent-intro-mark">
                  <Sparkles className="h-5 w-5" />
                </span>
                <strong>Ask anything about {storeName}</strong>
                <p>
                  Find a product, compare two of them or check your cart, without leaving the page.
                </p>
              </div>
            ) : null}

            {entries.map((entry, index) => (
              <article
                className={`sfagent-turn sfagent-turn-${entry.role}`}
                key={`${entry.role}-${index}`}
              >
                <div className="sfagent-bubble">
                  {entry.content
                    .split("\n")
                    .filter((line) => line.trim())
                    .map((line, lineIndex) => (
                      <p className="sfagent-line" key={lineIndex}>
                        {line}
                      </p>
                    ))}

                  {entry.reply?.warnings.map((warning) => (
                    <p className="sfagent-note" key={warning}>
                      <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                      <span>{warning}</span>
                    </p>
                  ))}

                  {entry.reply?.products.length ? (
                    <div className="sfagent-products">
                      {entry.reply.products.map((product) => (
                        <ProductCard
                          adding={addingId === product.id}
                          currency={currency}
                          disabled={isPending}
                          key={product.id}
                          onAdd={() => addProduct(product)}
                          product={product}
                        />
                      ))}
                    </div>
                  ) : null}

                  {entry.reply?.comparison ? (
                    <ComparisonTable comparison={entry.reply.comparison} currency={currency} />
                  ) : null}

                  {entry.reply?.actionPreview && !entry.actionDismissed ? (
                    <section
                      className={`sfagent-action sfagent-action-${entry.reply.actionPreview.weight}`}
                    >
                      <header className="sfagent-action-head">
                        <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
                        <div>
                          <strong>{entry.reply.actionPreview.label}</strong>
                          <span>Nothing happens until you confirm</span>
                        </div>
                      </header>

                      <dl className="sfagent-action-rows">
                        {entry.reply.actionPreview.rows.map((row) => (
                          <div key={row.label}>
                            <dt>{row.label}</dt>
                            <dd>{row.value}</dd>
                          </div>
                        ))}
                      </dl>

                      {entry.actionOutcome ? (
                        <Outcome outcome={entry.actionOutcome} />
                      ) : (
                        <div className="sfagent-action-buttons">
                          <button
                            className="sfagent-confirm"
                            disabled={runningIndex !== null}
                            onClick={() => confirmAction(index)}
                            type="button"
                          >
                            {runningIndex === index
                              ? "Working..."
                              : entry.reply.actionPreview.weight === "high"
                                ? "Confirm & place order"
                                : "Confirm"}
                          </button>
                          <button
                            className="sfagent-dismiss"
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

                  {entry.order ? <OrderReceipt order={entry.order} /> : null}
                </div>
              </article>
            ))}

            {isAsking ? (
              <article className="sfagent-turn sfagent-turn-assistant">
                <div className="sfagent-bubble">
                  <p className="sfagent-typing">
                    <span />
                    <span />
                    <span />
                    <em>Looking through the shop</em>
                  </p>
                </div>
              </article>
            ) : null}
          </div>

          <div className="sfagent-footer">
            {cart && cart.itemCount > 0 ? (
              <div className="sfagent-cartbar">
                <ShoppingBag aria-hidden="true" className="h-3.5 w-3.5" />
                <span>
                  {cart.itemCount} {cart.itemCount === 1 ? "item" : "items"} ·{" "}
                  {formatStorefrontMoney(cart.subtotal, currency)}
                </span>
                <Link className="sfagent-cartbar-link" href={cart.checkoutHref}>
                  Checkout
                </Link>
              </div>
            ) : null}

            {prompts.length ? (
              <div className="sfagent-suggestions">
                {prompts.map((prompt) => (
                  <button
                    className="sfagent-chip"
                    disabled={isPending}
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    type="button"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            ) : null}

            <form
              className="sfagent-composer"
              onSubmit={(event) => {
                event.preventDefault();
                sendMessage(input);
              }}
            >
              <textarea
                aria-label="Ask about this shop"
                className="sfagent-composer-input"
                disabled={isPending}
                maxLength={MESSAGE_LIMIT}
                onChange={(event) => {
                  setInput(event.target.value);
                  fitComposer(event.target);
                }}
                onKeyDown={(event) => {
                  // Enter sends, Shift+Enter breaks the line. Somebody typing a
                  // one-line question should never reach for the mouse.
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage(input);
                  }
                }}
                placeholder="What are you looking for?"
                ref={inputRef}
                rows={1}
                value={input}
              />
              <button
                aria-label="Send"
                className="sfagent-send"
                disabled={isPending || !input.trim()}
                type="submit"
              >
                <SendHorizonal aria-hidden="true" className="h-4 w-4" />
              </button>
            </form>

            {remaining <= COUNTER_THRESHOLD ? (
              <p className="sfagent-counter">{remaining} characters left</p>
            ) : null}

            <p className="sfagent-hint">
              <ShieldCheck aria-hidden="true" className="h-3 w-3 shrink-0" />
              <span>
                {engineLabel
                  ? "An assistant — check the product page before you buy. Nothing is added or ordered without your confirmation."
                  : "Answers are searched from this shop's catalogue. Nothing is added or ordered without your confirmation."}
              </span>
            </p>
          </div>
        </section>
      ) : null}
    </>
  );
}

function ProductCard({
  adding,
  currency,
  disabled,
  onAdd,
  product
}: {
  adding: boolean;
  currency: string;
  disabled: boolean;
  onAdd: () => void;
  product: ShoppingAgentProductCard;
}) {
  return (
    <article className="sfagent-product">
      <Link className="sfagent-product-media" href={product.href}>
        {/* The same component every product card on the storefront uses, so a
            deleted upload degrades to the same placeholder here as it does on
            the category page rather than to a broken image icon. */}
        <StorefrontImage alt={product.imageAlt} fallback="No image" src={product.imageUrl} />
      </Link>
      <div className="sfagent-product-body">
        <Link className="sfagent-product-title" href={product.href}>
          {product.title}
        </Link>
        <p className="sfagent-product-price">
          <strong>{formatStorefrontMoney(product.price, currency)}</strong>
          {product.compareAtPrice ? (
            <s>{formatStorefrontMoney(product.compareAtPrice, currency)}</s>
          ) : null}
        </p>
        <p
          className={`sfagent-product-stock${product.available ? "" : " sfagent-product-stock-out"}`}
        >
          {product.availabilityLabel}
        </p>
        {product.requiresVariantChoice ? (
          <Link className="sfagent-product-choose" href={product.href}>
            Choose an option
          </Link>
        ) : (
          <button
            className="sfagent-product-add"
            disabled={disabled || !product.available}
            onClick={onAdd}
            type="button"
          >
            {adding ? "Adding..." : product.available ? "Add to cart" : "Out of stock"}
          </button>
        )}
      </div>
    </article>
  );
}

/**
 * The comparison, scrolling inside its own box.
 *
 * A four-column table on a 360px phone is the reason this has `overflow-x` of
 * its own: the panel must never be what scrolls sideways.
 */
function ComparisonTable({
  comparison,
  currency
}: {
  comparison: ShoppingAgentComparison;
  currency: string;
}) {
  return (
    <div className="sfagent-compare">
      <table>
        <thead>
          <tr>
            <th scope="col">
              <span className="sfagent-visually-hidden">Detail</span>
            </th>
            {comparison.products.map((product) => (
              <th key={product.id} scope="col">
                {product.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {comparison.rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              {row.values.map((value, index) => (
                <td key={`${row.label}-${index}`}>
                  {formatComparisonValue(row.label, value, currency)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The money rows carry raw decimals from the catalogue, because the server has
 * no business deciding how a currency reads. The three that are money are named
 * rather than sniffed, so a future row of numbers is not silently reformatted as
 * taka.
 */
const COMPARISON_MONEY_ROWS = new Set(["Price", "Was", "You save"]);

function formatComparisonValue(label: string, value: string, currency: string) {
  if (!COMPARISON_MONEY_ROWS.has(label) || value === "—") {
    return value;
  }

  return formatStorefrontMoney(value, currency);
}

function Outcome({
  outcome
}: {
  outcome: { handoffHref?: string | null; ok: boolean; text: string };
}) {
  if (outcome.ok) {
    return (
      <p className="sfagent-outcome-ok">
        <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span>{outcome.text}</span>
      </p>
    );
  }

  return (
    <p className="sfagent-note">
      <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span>
        {outcome.text}
        {outcome.handoffHref ? (
          <>
            {" "}
            <Link className="sfagent-inline-link" href={outcome.handoffHref}>
              Open checkout
            </Link>
          </>
        ) : null}
      </span>
    </p>
  );
}

/** The order, and the link that finishes paying for it. */
function OrderReceipt({ order }: { order: ShoppingAgentOrderReceipt }) {
  return (
    <section className="sfagent-receipt">
      <header>
        <Receipt aria-hidden="true" className="h-4 w-4 shrink-0" />
        <div>
          <strong>Order {order.orderNumber}</strong>
          <span>
            {formatStorefrontMoney(order.total, order.currency)} · {order.paymentLabel}
          </span>
        </div>
      </header>
      {order.paymentInstructions ? <p>{order.paymentInstructions}</p> : null}
      <Link className="sfagent-receipt-link" href={order.paymentHref}>
        Open your order &amp; payment details
      </Link>
    </section>
  );
}

/**
 * The tail of the conversation, as the schema wants it.
 *
 * The opening greeting is dropped: it is this component's own copy rather than
 * something the assistant said about the shop, and carrying it would spend the
 * seller's own tokens re-reading a sentence every turn.
 */
function toHistory(entries: ChatEntry[]): ShoppingAgentMessage[] {
  return entries
    .filter((entry) => entry.role === "user" || entry.reply)
    .slice(-HISTORY_TURNS)
    .map((entry) => ({ content: entry.content.slice(0, 2000), role: entry.role }));
}
