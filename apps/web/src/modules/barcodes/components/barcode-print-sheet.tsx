"use client";

import { createPortal } from "react-dom";
import {
  A4_HEIGHT_MM,
  A4_WIDTH_MM,
  paginateLabels,
  type LabelFields,
  type LabelSize
} from "../barcode-label.layout";
import { BarcodeLabel, type BarcodeLabelData } from "./barcode-label";

type BarcodePrintSheetProps = {
  companyName: string;
  fields: LabelFields;
  labels: BarcodeLabelData[];
  size: LabelSize;
  skip: number;
};

const ROOT_CLASS = "storeim-label-print";

/**
 * The pages the printer receives.
 *
 * Portalled straight under `<body>` and mounted only for the length of one
 * print, so its stylesheet can hide every other child of `<body>` — the
 * dashboard, its sidebar, its dialogs — and set `@page` to the label stock,
 * without either rule existing at any other moment. A roll is one label per
 * page, the page *being* the label, which is what a thermal printer's driver
 * expects; a sheet is a grid on A4 at the stock's own margins.
 */
export function BarcodePrintSheet({ companyName, fields, labels, size, skip }: BarcodePrintSheetProps) {
  const pages = paginateLabels(labels.length, size.sheet, skip);
  const sheet = size.sheet;
  const pageCss =
    sheet.kind === "roll" ? `${size.widthMm}mm ${size.heightMm}mm` : `${A4_WIDTH_MM}mm ${A4_HEIGHT_MM}mm`;

  return createPortal(
    <div aria-hidden="true" className={ROOT_CLASS}>
      <style>{printStylesheet(pageCss)}</style>
      {pages.map((slots, pageIndex) => {
        const breakAfter = pageIndex < pages.length - 1 ? "page" : "auto";

        if (sheet.kind === "roll") {
          const label = labels[slots[0] ?? -1];

          return (
            <div
              key={pageIndex}
              style={{ breakAfter, height: `${size.heightMm}mm`, overflow: "hidden", width: `${size.widthMm}mm` }}
            >
              {label ? (
                <BarcodeLabel companyName={companyName} fields={fields} label={label} size={size} />
              ) : null}
            </div>
          );
        }

        return (
          <div
            key={pageIndex}
            style={{
              alignContent: "start",
              boxSizing: "border-box",
              breakAfter,
              columnGap: `${sheet.gapXMm}mm`,
              display: "grid",
              gridAutoRows: `${size.heightMm}mm`,
              gridTemplateColumns: `repeat(${sheet.columns}, ${size.widthMm}mm)`,
              height: `${A4_HEIGHT_MM}mm`,
              overflow: "hidden",
              paddingLeft: `${sheet.marginLeftMm}mm`,
              paddingTop: `${sheet.marginTopMm}mm`,
              rowGap: `${sheet.gapYMm}mm`,
              width: `${A4_WIDTH_MM}mm`
            }}
          >
            {slots.map((slot, slotIndex) => {
              const label = slot === null ? undefined : labels[slot];

              return label ? (
                <BarcodeLabel
                  companyName={companyName}
                  fields={fields}
                  key={slotIndex}
                  label={label}
                  size={size}
                />
              ) : (
                <div key={slotIndex} />
              );
            })}
          </div>
        );
      })}
    </div>,
    document.body
  );
}

/**
 * Screen: the sheet does not exist. Print: it is the only thing that does.
 * `print-color-adjust` keeps a browser's "save ink" default from dropping the
 * white paper rect the bars are measured against.
 */
function printStylesheet(pageSize: string) {
  return `
@media screen {
  .${ROOT_CLASS} { display: none !important; }
}
@media print {
  @page { size: ${pageSize}; margin: 0; }
  html, body {
    background: #fff !important;
    height: auto !important;
    margin: 0 !important;
    min-height: 0 !important;
    overflow: visible !important;
    padding: 0 !important;
  }
  body > *:not(.${ROOT_CLASS}) { display: none !important; }
  .${ROOT_CLASS} { display: block !important; }
  .${ROOT_CLASS} * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
}
