import { createElement } from "react";
import type { ReactNode } from "react";
import { isSafeBarHref } from "../../notification-bar/notification-bar.render";
import {
  DESCRIPTION_TAG_PATTERN,
  PRODUCT_DESCRIPTION_CONTENT_CLASS,
  decodeHtmlEntities
} from "../../products/product-description";

/**
 * A product's short and long description, rendered as the seller wrote them:
 * the dashboard editor's formatting honoured, and plain text — every product
 * saved before the editor — with every line break and blank line kept.
 *
 * Safety comes from never handing the browser the seller's markup. The text is
 * parsed into a tree of allow-listed tag names and plain strings, and React
 * builds the elements — so there is no `dangerouslySetInnerHTML`. Only two
 * attributes survive, each re-derived rather than copied: a link's `href`, and
 * only when the notification bar's `isSafeBarHref` allow-list accepts it (a
 * path, an anchor, `http(s)`, `mailto:`, `tel:`), and a block's `text-align`,
 * and only as one of four keywords. Everything else — `style`, `src`, `on*`,
 * `class` — is dropped. A tag outside the list is stripped and its words kept;
 * one whose content is code (`<script>`, `<style>`, …) is dropped with it.
 *
 * Pure and hook-free, so the server-rendered page and the client accordion
 * render the same markup.
 */

type TextAlign = "center" | "justify" | "left" | "right";
type RichTextNode = {
  align?: TextAlign | undefined;
  children: RichTextChild[];
  href?: string | undefined;
  tag: string;
};
type RichTextChild = RichTextNode | string;

const INLINE_TAGS = new Set([
  "a",
  "b",
  "em",
  "i",
  "mark",
  "s",
  "small",
  "strong",
  "sub",
  "sup",
  "u"
]);
const BLOCK_TAGS = new Set(["blockquote", "h2", "h3", "h4", "h5", "h6", "li", "ol", "p", "ul"]);
const LIST_TAGS = new Set(["ol", "ul"]);
const LINK_TAGS = new Set(["a"]);
const DROPPED_CONTENT_TAGS = new Set([
  "iframe",
  "math",
  "noscript",
  "object",
  "script",
  "select",
  "style",
  "svg",
  "template",
  "textarea",
  "title"
]);
const ATTRIBUTE_PATTERN = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const TEXT_ALIGN_PATTERN = /(?:^|;)\s*text-align\s*:\s*(center|justify|left|right)\s*(?:;|$)/i;

export function ProductRichText({
  className,
  text
}: {
  className?: string | undefined;
  text: string;
}) {
  const nodes = parseProductRichText(text);
  const classes = [className, PRODUCT_DESCRIPTION_CONTENT_CLASS].filter(Boolean).join(" ");

  // Plain text — every product saved before the editor — stays one `<p>`,
  // exactly the element the page styled before. Only content that brings its
  // own blocks needs a `<div>`, since a `<p>` cannot hold them.
  if (!nodes.some(isBlockNode)) {
    return <p className={classes}>{renderChildren(nodes, "")}</p>;
  }

  return <div className={classes}>{renderChildren(wrapLooseRuns(nodes), "")}</div>;
}

function parseProductRichText(source: string): RichTextChild[] {
  const root: RichTextNode = { children: [], tag: "" };
  const stack: RichTextNode[] = [root];
  const pattern = new RegExp(DESCRIPTION_TAG_PATTERN.source, "g");
  const normalized = source.replace(/\r\n?/g, "\n");
  let cursor = 0;
  let skippingUntil: string | null = null;

  const top = () => stack[stack.length - 1] ?? root;
  const hasAncestor = (tags: Set<string>) => stack.some((node) => tags.has(node.tag));
  // Closes inline tags and open paragraphs so a block never lands inside
  // something a browser would refuse to nest it in.
  const closeForBlock = () => {
    while (stack.length > 1 && (INLINE_TAGS.has(top().tag) || /^(p|h[2-6])$/.test(top().tag))) {
      stack.pop();
    }
  };

  for (let match = pattern.exec(normalized); match; match = pattern.exec(normalized)) {
    const before = normalized.slice(cursor, match.index);
    cursor = match.index + match[0].length;
    const closing = match[1] === "/";
    const name = (match[2] ?? "").toLowerCase();

    if (skippingUntil) {
      if (closing && name === skippingUntil) {
        skippingUntil = null;
      }
      continue;
    }

    appendText(top(), before);

    if (!name) {
      continue; // a comment
    }

    if (DROPPED_CONTENT_TAGS.has(name)) {
      if (!closing) {
        skippingUntil = name;
      }
      continue;
    }

    if (name === "br") {
      top().children.push({ children: [], tag: "br" });
      continue;
    }

    // An `<li>` outside any list would be a stray bullet, so it reads as a paragraph.
    const tag = name === "li" && !hasAncestor(LIST_TAGS) ? "p" : name;

    if (!INLINE_TAGS.has(tag) && !BLOCK_TAGS.has(tag)) {
      continue; // not on the list: the tag goes, its words stay
    }

    if (closing) {
      const openAt = stack.map((node) => node.tag).lastIndexOf(tag);
      if (openAt > 0) {
        stack.length = openAt;
      }
      continue;
    }

    const attributes = readAttributes(match[3] ?? "");
    const node: RichTextNode = { children: [], tag };

    if (tag === "a") {
      const href = (attributes.get("href") ?? "").trim();

      // A link the allow-list refuses, or one inside another link, keeps its
      // words and loses only the anchor.
      if (!isSafeBarHref(href) || hasAncestor(LINK_TAGS)) {
        continue;
      }
      node.href = href;
    }

    if (BLOCK_TAGS.has(tag)) {
      closeForBlock();
      if (tag === "li" && top().tag === "li") {
        stack.pop();
      }
      node.align = readTextAlign(attributes.get("style"));
    }

    top().children.push(node);
    stack.push(node);
  }

  if (!skippingUntil) {
    appendText(top(), normalized.slice(cursor));
  }

  return tidyBlockWhitespace(root.children, true);
}

function readAttributes(raw: string) {
  const attributes = new Map<string, string>();
  const pattern = new RegExp(ATTRIBUTE_PATTERN.source, "g");

  for (let match = pattern.exec(raw); match; match = pattern.exec(raw)) {
    attributes.set(
      (match[1] ?? "").toLowerCase(),
      decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? "")
    );
  }

  return attributes;
}

function readTextAlign(style: string | undefined): TextAlign | undefined {
  const value = TEXT_ALIGN_PATTERN.exec(style ?? "")?.[1]?.toLowerCase();

  return value === "center" || value === "justify" || value === "right" ? value : undefined;
}

function appendText(parent: RichTextNode, raw: string) {
  if (!raw) {
    return;
  }

  // Whitespace between list items is source formatting, not content.
  if (LIST_TAGS.has(parent.tag) && !raw.trim()) {
    return;
  }

  parent.children.push(decodeHtmlEntities(raw));
}

/**
 * The newline a seller types after `</p>` or `</li>` is source layout; the block
 * already breaks the line, so rendering it too would add an empty line.
 * Newlines between plain text are the content and are left alone.
 */
function tidyBlockWhitespace(children: RichTextChild[], insideBlock: boolean): RichTextChild[] {
  const tidied = children.map((child) =>
    typeof child === "string"
      ? child
      : {
          ...child,
          children: tidyBlockWhitespace(child.children, BLOCK_TAGS.has(child.tag))
        }
  );

  return tidied
    .map((child, index) => {
      if (typeof child !== "string") {
        return child;
      }

      const previous = tidied[index - 1];
      const next = tidied[index + 1];
      let text = child;

      if (previous ? isBlockNode(previous) : insideBlock) {
        text = text.replace(/^[ \t]*\n/, "");
      }
      if (next ? isBlockNode(next) : insideBlock) {
        text = text.replace(/\n[ \t]*$/, "");
      }

      return text;
    })
    .filter((child) => child !== "");
}

/** Text sitting between blocks gets a paragraph of its own, so it is styled like one. */
function wrapLooseRuns(children: RichTextChild[]): RichTextChild[] {
  const wrapped: RichTextChild[] = [];
  let run: RichTextChild[] = [];

  const flush = () => {
    if (run.some((child) => typeof child !== "string" || child.trim())) {
      wrapped.push({ children: run, tag: "p" });
    }
    run = [];
  };

  for (const child of children) {
    if (isBlockNode(child)) {
      flush();
      wrapped.push(child);
    } else {
      run.push(child);
    }
  }
  flush();

  return wrapped;
}

function isBlockNode(child: RichTextChild): child is RichTextNode {
  return typeof child !== "string" && BLOCK_TAGS.has(child.tag);
}

function renderChildren(children: RichTextChild[], keyPrefix: string): ReactNode[] {
  return children.flatMap((child, index): ReactNode[] => {
    const key = `${keyPrefix}${index}`;

    if (typeof child === "string") {
      return renderText(child, key);
    }

    if (child.tag === "br") {
      return [<br key={key} />];
    }

    const rendered = renderChildren(child.children, `${key}.`);

    if (child.tag === "a" && child.href) {
      return [
        <a
          href={child.href}
          key={key}
          rel="noopener noreferrer nofollow"
          {...(/^https?:/i.test(child.href) ? { target: "_blank" } : {})}
        >
          {rendered}
        </a>
      ];
    }

    // The editor writes an empty line as an empty paragraph. Left empty it would
    // collapse to nothing, so it carries the line break it stands for.
    const content =
      rendered.length === 0 && /^(p|h[2-6])$/.test(child.tag) ? [<br key="0" />] : rendered;

    return [
      createElement(
        child.tag,
        { key, ...(child.align ? { style: { textAlign: child.align } } : {}) },
        content
      )
    ];
  });
}

function renderText(text: string, key: string): ReactNode[] {
  return text
    .split("\n")
    .flatMap((line, index) => (index === 0 ? [line] : [<br key={`${key}-${index}`} />, line]))
    .filter((part) => part !== "");
}
