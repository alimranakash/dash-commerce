import type { CSSProperties } from "react";
import { LABEL_LINE_HEIGHT, labelLayout, type LabelFields } from "../barcode-label.layout";
import { BarcodeSvg } from "./barcode-svg";

export type BarcodeLabelData = {
  /** Null only in the preview: printing assigns a code before anything is drawn. */
  barcode: string | null;
  /** Already formatted for the shelf, currency symbol included. */
  price: string;
  sku: string | null;
  title: string;
  /** "Color: Black · Size: M" on a variant's label; null on a product without options. */
  variant: string | null;
};

type BarcodeLabelProps = {
  companyName: string;
  fields: LabelFields;
  label: BarcodeLabelData;
  size: { heightMm: number; widthMm: number };
};

const INK = "#000";
const PAPER = "#fff";

/**
 * One label, at its physical size, in millimetres throughout.
 *
 * Styled inline on purpose, for the reason `BarcodeSvg` gives: this element is
 * printed, and nothing a theme does to the dashboard may reach it. The same
 * component draws the preview, so what the seller looks at is what the printer
 * receives.
 */
export function BarcodeLabel({ companyName, fields: runFields, label, size }: BarcodeLabelProps) {
  // Laid out per label: in one run a variant's label has an option line and a
  // plain product's does not, and the bars take whatever height is left.
  const fields = { ...runFields, variant: runFields.variant && Boolean(label.variant) };
  const layout = labelLayout(size, fields);
  const textRow: CSSProperties = { boxSizing: "border-box", paddingInline: `${layout.paddingXMm}mm`, width: "100%" };
  const showFooter = fields.price || (fields.sku && Boolean(label.sku));

  return (
    <div
      style={{
        alignItems: "center",
        background: PAPER,
        boxSizing: "border-box",
        color: INK,
        display: "flex",
        flexDirection: "column",
        fontFamily: "Arial, Helvetica, sans-serif",
        gap: `${layout.gapMm}mm`,
        height: `${size.heightMm}mm`,
        justifyContent: "center",
        overflow: "hidden",
        paddingBlock: `${layout.paddingYMm}mm`,
        textAlign: "center",
        width: `${size.widthMm}mm`
      }}
    >
      {fields.company ? (
        <div style={{ ...textRow, ...lineStyle(layout.companyMm, 1), fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {companyName}
        </div>
      ) : null}
      {fields.name ? (
        <div style={{ ...textRow, ...lineStyle(layout.nameMm, layout.nameLines), fontWeight: 600 }}>{label.title}</div>
      ) : null}
      {fields.variant ? (
        <div style={{ ...textRow, ...lineStyle(layout.variantMm, 1), fontWeight: 700 }}>{label.variant}</div>
      ) : null}
      <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
        {label.barcode ? (
          <BarcodeSvg
            heightMm={layout.barcode.heightMm}
            showText={fields.barcodeText}
            textMm={layout.barcode.textMm}
            value={label.barcode}
            widthMm={layout.barcode.widthMm}
          />
        ) : (
          <div
            style={{
              alignItems: "center",
              border: "0.25mm dashed #777",
              boxSizing: "border-box",
              color: "#555",
              display: "flex",
              fontSize: `${Math.max(layout.companyMm, 1.6)}mm`,
              height: `${layout.barcode.heightMm}mm`,
              justifyContent: "center",
              padding: "0 1mm",
              width: `${layout.barcode.widthMm}mm`
            }}
          >
            Barcode assigned when printed
          </div>
        )}
      </div>
      {showFooter ? (
        <div
          style={{
            ...textRow,
            alignItems: "baseline",
            display: "flex",
            gap: "1mm",
            justifyContent: fields.sku && label.sku && fields.price ? "space-between" : "center"
          }}
        >
          {fields.sku && label.sku ? (
            <span style={{ ...lineStyle(layout.skuMm, 1), flex: "0 1 auto", width: "auto" }}>{label.sku}</span>
          ) : null}
          {fields.price ? (
            <span style={{ ...lineStyle(layout.priceMm, 1), flex: "0 0 auto", fontWeight: 800, width: "auto" }}>
              {label.price}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** A clamped run of text: one line ellipsised, or several cut at the last whole line. */
function lineStyle(fontMm: number, lines: number): CSSProperties {
  const base: CSSProperties = {
    fontSize: `${fontMm}mm`,
    lineHeight: LABEL_LINE_HEIGHT,
    maxHeight: `${fontMm * LABEL_LINE_HEIGHT * lines}mm`,
    overflow: "hidden",
    width: "100%"
  };

  if (lines <= 1) {
    return { ...base, textOverflow: "ellipsis", whiteSpace: "nowrap" };
  }

  return {
    ...base,
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: lines,
    display: "-webkit-box",
    overflowWrap: "anywhere"
  };
}
