/**
 * The format of a product's short and long description.
 *
 * Both columns hold one of two things: the HTML the dashboard's rich-text editor
 * writes, or plain text — every description saved before the editor existed,
 * and whatever the AI API, the Store Copilot or the content generator writes,
 * since those produce prose. Nothing is migrated: each reader below accepts
 * both, so an old description renders as it always did and opens in the editor
 * as the same lines it was typed as.
 *
 * Nothing here decides what is safe to *render* — that is the storefront's
 * `ProductRichText`, which never hands this markup to the browser. These are
 * the pure helpers the editor, the save schema and the plain-text readers share.
 */

/**
 * One tag or comment. Attributes have to look like attributes, so prose such as
 * "a<b and 3>2" stays prose instead of being read as a `<b>` tag.
 */
export const DESCRIPTION_TAG_PATTERN =
  /<!--[\s\S]*?(?:-->|$)|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[a-zA-Z_:][\w:.-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g;

/**
 * Shared by the editor's writing surface and the storefront, so a list or a
 * heading looks the same on both sides of Save. Tailwind's reset strips list
 * markers and heading sizes; these put back only that — no colours, which stay
 * the surrounding text's in both themes.
 */
export const PRODUCT_DESCRIPTION_CONTENT_CLASS =
  "[&_a]:underline [&_h2]:text-[1.2em] [&_h2]:font-bold [&_h3]:text-[1.1em] [&_h3]:font-bold [&_h4]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5";

const FORMATTING_TAG =
  /<\/?(?:a|b|blockquote|br|div|em|h[1-6]|i|li|mark|ol|p|s|small|span|strong|sub|sup|u|ul)\b[^<>]*>/i;
const BLOCK_TAG = /<(?:blockquote|div|h[1-6]|li|ol|p|ul)\b[^<>]*>/i;
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: "\u00a0",
  quot: '"'
};

export function decodeHtmlEntities(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, body: string) => {
    if (body.startsWith("#")) {
      const codePoint =
        body[1] === "x" || body[1] === "X"
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      return codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
    }

    return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
  });
}

/**
 * What a shopper reads, as one line: tags gone, entities decoded, whitespace
 * collapsed. For the places that show a description as text — a card subtitle,
 * a checkout offer, a chat summary — and for measuring a description's length
 * by its words rather than by its markup.
 */
export function productDescriptionText(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const withoutCode = value.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, " ");
  const withoutTags = withoutCode.replace(new RegExp(DESCRIPTION_TAG_PATTERN.source, "g"), " ");

  return decodeHtmlEntities(withoutTags).replace(/\s+/g, " ").trim();
}

/**
 * A stored description as the editor should open it.
 *
 * Editor HTML goes back in as it came out. Anything else is text whose line
 * breaks are the formatting, so each line becomes a paragraph — and a blank
 * line an empty one — which is exactly how the storefront has been showing it.
 * A line that already carries an inline tag a seller typed by hand keeps it;
 * a line with none is escaped, so "size <5cm" stays text.
 */
export function productDescriptionEditorHtml(value: string | null | undefined) {
  const text = (value ?? "").replace(/\r\n?/g, "\n").trim();

  if (!text) {
    return "";
  }

  if (BLOCK_TAG.test(text)) {
    return text;
  }

  return text
    .split("\n")
    .map((line) => `<p>${FORMATTING_TAG.test(line) ? line : escapeHtml(line)}</p>`)
    .join("");
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
