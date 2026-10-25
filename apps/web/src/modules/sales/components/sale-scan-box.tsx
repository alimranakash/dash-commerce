"use client";

import { ScanLine } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { EMPTY_WEDGE, feedWedgeKey } from "../../barcodes/barcode.scan";

export type SaleScanFeedback = { message: string; tone: "error" | "ok" | "warn" };

type SaleScanBoxProps = {
  /** The sale form: a scan typed into one of its fields is taken back out of it. */
  formRef: RefObject<HTMLFormElement | null>;
  onScan: (code: string) => SaleScanFeedback;
};

/**
 * Where a barcode scanner talks to the sale.
 *
 * Focused when the page opens and again after every scan, so the cashier's
 * whole job is pointing the scanner: each code lands here, ends in the
 * scanner's own Enter, and becomes a line on the sale. A code typed by hand
 * and Enter does the same.
 *
 * Focus does wander — a click on a button, a quantity corrected by hand — so
 * the page also listens for the scanner itself (see `feedWedgeKey`). A scan
 * that lands on a button is taken as a scan; one that lands inside another of
 * the form's fields is taken as a scan *and* the field is put back the way it
 * was before the burst began, so a quantity box does not keep a thirteen-digit
 * quantity and a product dropdown does not keep whatever its type-ahead jumped
 * to. Its Enter never reaches the field either, so it cannot submit the sale
 * or pick a customer.
 */
export function SaleScanBox({ formRef, onScan }: SaleScanBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onScanRef = useRef(onScan);
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState<SaleScanFeedback | null>(null);

  useLayoutEffect(() => {
    onScanRef.current = onScan;
  });

  const scan = useCallback((code: string) => {
    if (!code.trim()) {
      return;
    }

    const result = onScanRef.current(code);

    setFeedback(result);

    if (result.tone === "error") {
      playErrorTone();
    }
  }, []);

  useEffect(() => {
    let state = EMPTY_WEDGE;
    let burstField: RestorableField | null = null;
    let burstOriginal = "";

    function onKeyDown(event: globalThis.KeyboardEvent) {
      const target = event.target;

      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || target === inputRef.current) {
        state = EMPTY_WEDGE;
        return;
      }

      const field = restorableField(target);

      // Typing in a field elsewhere on the page — a notes box, a dialog — is
      // not this form's business, and nor is any multi-line text.
      if ((field && !formRef.current?.contains(field)) || isFreeText(target)) {
        state = EMPTY_WEDGE;
        return;
      }

      const fed = feedWedgeKey(state, event.key, event.timeStamp);

      if (event.key.length === 1 && fed.state.buffer.length === 1) {
        burstField = field;
        burstOriginal = field?.value ?? "";
      }

      state = fed.state;

      if (!fed.scanned) {
        return;
      }

      // Capture phase, so neither the default action nor the field's own Enter
      // handler ever sees this key.
      event.preventDefault();
      event.stopPropagation();

      if (burstField && burstField === field) {
        restoreValue(burstField, burstOriginal);
      }

      burstField = null;
      scan(fed.scanned);
      inputRef.current?.focus();
    }

    document.addEventListener("keydown", onKeyDown, true);

    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [formRef, scan]);

  function submitOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    // Enter here is a product, never the whole sale.
    event.preventDefault();
    scan(value);
    setValue("");
  }

  return (
    <div className="grid gap-1.5 border-b border-[#ececf5] px-4 py-3">
      <label className="flex items-center gap-2 rounded-lg border border-[#d9d3ef] bg-[#faf9ff] px-3 focus-within:border-[#7c3aed]">
        <ScanLine aria-hidden="true" className="h-4 w-4 shrink-0 text-[#7c3aed]" />
        <span className="sr-only">Scan a barcode</span>
        <input
          autoComplete="off"
          autoFocus
          className="h-11 w-full border-0 bg-transparent font-mono text-sm outline-none"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={submitOnEnter}
          placeholder="Scan a barcode — or type a barcode or SKU and press Enter"
          ref={inputRef}
          spellCheck={false}
          type="text"
          value={value}
        />
      </label>
      <p
        aria-live="polite"
        className={`m-0 min-h-4 text-xs ${feedback?.tone === "error" ? "text-rose-600" : feedback?.tone === "warn" ? "text-amber-700" : "text-emerald-700"}`}
        role="status"
      >
        {feedback?.message ?? ""}
      </p>
    </div>
  );
}

type RestorableField = HTMLInputElement | HTMLSelectElement;

const NON_TEXT_INPUTS = new Set(["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"]);

/** A field a scanner's keystrokes can change, and so one worth putting back. */
function restorableField(target: EventTarget | null): RestorableField | null {
  if (target instanceof HTMLSelectElement) {
    return target;
  }

  if (target instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(target.type)) {
    return target;
  }

  return null;
}

function isFreeText(target: EventTarget | null) {
  return target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable);
}

/**
 * Puts a field back through the element's own value setter and the event React
 * listens for, so a controlled input's state follows the DOM rather than
 * snapping the scanned digits back on the next render.
 */
function restoreValue(field: RestorableField, value: string) {
  const prototype = field instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;

  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(field, value);
  field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
}

let audio: AudioContext | null = null;

/**
 * The scanner beeps when it reads a code; it cannot know the shop has no such
 * product. A low tone says so to a cashier who is looking at the customer, not
 * the screen. Silent wherever audio is unavailable.
 */
function playErrorTone() {
  try {
    audio ??= new AudioContext();

    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    oscillator.type = "square";
    oscillator.frequency.value = 220;
    gain.gain.value = 0.06;
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.25);
  } catch {
    // No audio device, or the browser refused: the message on screen still says it.
  }
}
