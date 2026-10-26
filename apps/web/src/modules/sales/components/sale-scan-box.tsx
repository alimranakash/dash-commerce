"use client";

import { ScanLine } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { EMPTY_WEDGE, feedWedgeKey } from "../../barcodes/barcode.scan";
import type { SaleScanFeedback } from "../sale-scan";

/** Where a scan arrived: typed into the scan box, or picked out of keys aimed elsewhere on the page. */
export type SaleScanOrigin = "box" | "page";

type SaleScanBoxProps = {
  /** The sale form: a scan typed into one of its fields is taken back out of it. */
  formRef: RefObject<HTMLFormElement | null>;
  /**
   * A burst of keys aimed somewhere other than the scan box has begun. If it
   * turns out to be a scan, whatever it did on the way through — a quantity
   * typed over, a product list's type-ahead — is undone, so the form keeps
   * what it had at this moment.
   */
  onBurstStart?: (() => void) | undefined;
  onScan: (code: string, origin: SaleScanOrigin) => SaleScanFeedback;
};

/**
 * Where a barcode scanner talks to the sale.
 *
 * Focused when the page opens and again after every scan, so the cashier's
 * whole job is pointing the scanner: each code lands here, ends in the
 * scanner's own Enter (or Tab, the other suffix scanners are set up with), and
 * becomes a line on the sale. A code typed by hand and Enter does the same.
 *
 * Focus does wander — a click on a button, a quantity corrected by hand — so
 * the page also listens for the scanner itself (see `feedWedgeKey`). A scan
 * that lands on a button is taken as a scan; one that lands inside another of
 * the form's fields is taken as a scan *and* the field is put back the way it
 * was before the burst began, so a quantity box does not keep a thirteen-digit
 * quantity and a product dropdown does not keep whatever its type-ahead jumped
 * to. Its Enter never reaches the field either, so it cannot submit the sale
 * or pick a customer. Typing at a person's speed is never touched.
 *
 * The notes box, fields outside the form and open dialogs are left alone
 * entirely — the hint beside the box says "paused" there, as it does when the
 * browser itself is not focused and no key reaches the page at all.
 */
export function SaleScanBox({ formRef, onBurstStart, onScan }: SaleScanBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onScanRef = useRef(onScan);
  const onBurstStartRef = useRef(onBurstStart);
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState<SaleScanFeedback | null>(null);
  const [ready, setReady] = useState(true);

  useLayoutEffect(() => {
    onScanRef.current = onScan;
    onBurstStartRef.current = onBurstStart;
  });

  const scan = useCallback((code: string, origin: SaleScanOrigin) => {
    if (!code.trim()) {
      return;
    }

    const result = onScanRef.current(code, origin);

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

      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.isComposing ||
        target === inputRef.current ||
        !takesScans(target, formRef.current)
      ) {
        state = EMPTY_WEDGE;
        return;
      }

      const field = restorableField(target);
      const fed = feedWedgeKey(state, event.key, event.timeStamp);

      if (event.key.length === 1 && fed.state.buffer.length === 1) {
        burstField = field;
        burstOriginal = field?.value ?? "";
        onBurstStartRef.current?.();
      }

      state = fed.state;

      if (!fed.scanned) {
        return;
      }

      // Capture phase, so neither the default action nor the field's own Enter
      // handler ever sees this key.
      event.preventDefault();
      event.stopPropagation();

      // Only a field the burst actually changed: a change event on an
      // untouched product list would re-pick its product and clear the option.
      if (burstField && burstField === field && field.value !== burstOriginal) {
        restoreValue(burstField, burstOriginal);
      }

      burstField = null;
      scan(fed.scanned, "page");
      inputRef.current?.focus();
    }

    document.addEventListener("keydown", onKeyDown, true);

    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [formRef, scan]);

  useEffect(() => {
    function update() {
      setReady(document.hasFocus() && takesScans(document.activeElement, formRef.current));
    }

    update();
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    window.addEventListener("focus", update);
    window.addEventListener("blur", update);

    return () => {
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      window.removeEventListener("focus", update);
      window.removeEventListener("blur", update);
    };
  }, [formRef]);

  function takeScan(event: KeyboardEvent<HTMLInputElement>) {
    const code = event.currentTarget.value;

    // Enter here is a product, never the whole sale; a Tab after a code is a
    // scanner's suffix, not a move to the next field. Tab in an empty box
    // still moves on, for a cashier who is using the keyboard.
    if (event.key !== "Enter" && !(event.key === "Tab" && !event.shiftKey && code.trim())) {
      return;
    }

    event.preventDefault();
    scan(code, "box");
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
          className="h-11 w-full min-w-0 border-0 bg-transparent font-mono text-sm outline-none"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={takeScan}
          placeholder="Scan a barcode — or type a barcode or SKU and press Enter"
          ref={inputRef}
          spellCheck={false}
          type="text"
          value={value}
        />
        {/* Inside the label, so clicking a paused hint focuses the box. */}
        <span
          className={`shrink-0 whitespace-nowrap text-[11px] font-semibold ${ready ? "text-emerald-700" : "text-amber-700"}`}
        >
          <span aria-hidden="true">● </span>
          {ready ? "Scanner ready" : "Paused — click to scan"}
        </span>
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

const DIALOG_SELECTOR = 'dialog, [role="dialog"], [role="alertdialog"], [aria-modal="true"]';

/**
 * Whether keys aimed at `target` may be a scan for this sale: anywhere in the
 * form, on a button or on nothing at all — but never in free text, a field
 * that belongs to something else on the page, or a dialog open over the sale.
 */
function takesScans(target: EventTarget | null, form: HTMLFormElement | null) {
  if (target instanceof Element && target.closest(DIALOG_SELECTOR)) {
    return false;
  }

  if (isFreeText(target)) {
    return false;
  }

  const field = restorableField(target);

  return !field || Boolean(form?.contains(field));
}

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
