/**
 * Copy text to the clipboard, including where `navigator.clipboard` does not
 * exist.
 *
 * The async Clipboard API is gated on a secure context, so it is simply
 * `undefined` when the dashboard is opened over plain http — a LAN address
 * during development, or a deployment whose TLS is not up yet. Code written as
 * `navigator.clipboard?.writeText(value)` does nothing at all there and shows no
 * error, which reads to the person clicking as a button that is broken.
 *
 * So: try the real API, and fall back to a hidden textarea and the long
 * deprecated `execCommand("copy")`, which has no secure-context requirement.
 * Returns whether anything actually reached the clipboard, so a caller can show
 * "Copied" honestly rather than optimistically.
 */
export async function copyToClipboard(value: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(value);

      return true;
    } catch {
      // Permission denied, or a browser that exposes the API but refuses it
      // outside a user gesture it recognises. Fall through.
    }
  }

  return copyWithTextarea(value);
}

function copyWithTextarea(value: string) {
  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");

  textarea.value = value;
  // Off-screen rather than hidden: an element with `display: none` cannot be
  // selected, and a visible one would scroll the page as it takes focus.
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  textarea.style.opacity = "0";

  document.body.appendChild(textarea);

  try {
    textarea.select();
    textarea.setSelectionRange(0, value.length);

    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}
