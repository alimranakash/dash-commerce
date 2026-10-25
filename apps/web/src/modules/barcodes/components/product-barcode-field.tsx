"use client";

import Link from "next/link";
import { useId, useState, type KeyboardEvent } from "react";
import { BARCODE_MAX_LENGTH, normalizeBarcodeValue } from "../barcode.schema";
import { generateInStoreEan13, isCode128Encodable } from "../barcode.symbology";
import { BarcodeSvg } from "./barcode-svg";

type ProductBarcodeFieldProps = {
  defaultValue?: string | undefined;
  /** Present when editing, for the link to this product's labels. */
  productId?: string | undefined;
};

/**
 * The product form's barcode box.
 *
 * Two ways in, matching the two kinds of product a shop stocks: point the
 * scanner at a box that already has a manufacturer's barcode, or press
 * Generate for one that has none. Left blank, a code is assigned the first time
 * a label is printed, so nobody has to think about it at all. The server still
 * decides: the code is normalised and checked unique when the product is saved.
 */
export function ProductBarcodeField({ defaultValue, productId }: ProductBarcodeFieldProps) {
  const inputId = useId();
  const [value, setValue] = useState(defaultValue ?? "");
  const normalized = normalizeBarcodeValue(value);
  const drawable = normalized.length <= BARCODE_MAX_LENGTH && isCode128Encodable(normalized);

  // A scanner ends every code with Enter, which would otherwise submit the
  // whole product form the moment a box is scanned into this field.
  function keepEnterHere(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
    }
  }

  return (
    // gap-2 matches the 8px label gap of the SKU field beside it, so the two
    // inputs sit on one line.
    <div className="grid gap-2">
      <label htmlFor={inputId}>Barcode</label>
      {/* What the box showed on load: posted back unchanged, the stored code is kept (see `barcodeUntouched`). */}
      {productId ? <input name="barcodeLoaded" type="hidden" value={defaultValue ?? ""} /> : null}
      <div className="flex gap-2">
        <input
          autoComplete="off"
          className="min-w-0 flex-1 font-mono"
          id={inputId}
          maxLength={64}
          name="barcode"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={keepEnterHere}
          placeholder="Scan the packaging, or generate"
          spellCheck={false}
          type="text"
          value={value}
        />
        <button
          className="shrink-0 rounded-lg border border-[#ddd6fe] px-3 text-xs font-semibold text-[#6d3cf5]"
          onClick={() => setValue(generateInStoreEan13(randomDigit))}
          type="button"
        >
          Generate
        </button>
      </div>
      {normalized && drawable ? (
        <div className="w-fit rounded-md border border-[#ececf5] bg-white p-1.5">
          <BarcodeSvg heightMm={12} showText textMm={2.2} value={normalized} widthMm={40} />
        </div>
      ) : null}
      <small>
        Leave blank and one is assigned the first time you print a label.
        {productId ? (
          <>
            {" "}
            {/* A new tab, so following it never discards edits made in this form. */}
            <Link
              className="font-semibold text-[#6d3cf5]"
              href={`/dashboard/products/barcodes?ids=${productId}`}
              target="_blank"
            >
              Print labels
            </Link>
          </>
        ) : null}
      </small>
    </div>
  );
}

/** A uniform digit: bytes of 250 and above are thrown back so 0–9 stay equally likely. */
function randomDigit() {
  const byte = new Uint8Array(1);

  do {
    crypto.getRandomValues(byte);
  } while ((byte[0] ?? 255) >= 250);

  return (byte[0] ?? 0) % 10;
}
