import { LABEL_LINE_HEIGHT } from "../barcode-label.layout";
import { encodeBarcode, type BarcodeEncoding } from "../barcode.symbology";

type BarcodeSvgProps = {
  heightMm: number;
  showText: boolean;
  /** Font size of the digit line, in mm. */
  textMm: number;
  value: string;
  widthMm: number;
};

const INK = "#000";
const PAPER = "#fff";

/**
 * A barcode drawn at an exact physical size.
 *
 * The viewBox is measured in modules and its height is derived from the box's
 * own aspect ratio, so the drawing scales uniformly — the digits stay digits
 * rather than stretching with the bars — and `crispEdges` snaps every bar edge
 * to a device pixel on its own, which keeps rounding from accumulating across
 * the width the way a scaled bitmap would.
 *
 * Colours are SVG attributes, never Tailwind classes or stylesheet rules: the
 * dark-mode generator rewrites those, and a label is paper. It must print
 * black on white whatever theme the dashboard happens to be in.
 */
export function BarcodeSvg({ heightMm, showText, textMm, value, widthMm }: BarcodeSvgProps) {
  const encoding = safeEncode(value);

  if (!encoding || widthMm <= 0 || heightMm <= 0) {
    return null;
  }

  const moduleMm = widthMm / encoding.totalModules;
  const height = heightMm / moduleMm;
  const textSize = showText ? textMm / moduleMm : 0;
  const textBand = textSize * LABEL_LINE_HEIGHT;
  const barBottom = Math.max(height - textBand, height * 0.4);
  // EAN-13's guard bars run down between the digit groups, as on any box in a shop.
  const guardBottom =
    encoding.symbology === "ean13" && showText ? Math.min(height, barBottom + textBand * 0.55) : barBottom;
  const baseline = height - textSize * 0.14;

  return (
    <svg
      aria-label={`Barcode ${value}`}
      height={`${heightMm}mm`}
      role="img"
      shapeRendering="crispEdges"
      style={{ display: "block" }}
      viewBox={`0 0 ${encoding.totalModules} ${round(height)}`}
      width={`${widthMm}mm`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill={PAPER} height={round(height)} width={encoding.totalModules} x={0} y={0} />
      {encoding.bars.map((bar) => (
        <rect
          fill={INK}
          height={round(bar.guard ? guardBottom : barBottom)}
          key={bar.x}
          width={bar.width}
          x={bar.x}
          y={0}
        />
      ))}
      {showText
        ? encoding.text.map((entry) => (
            <text
              fill={INK}
              fontFamily="ui-monospace, Menlo, Consolas, 'Courier New', monospace"
              fontSize={round(textSize)}
              key={entry.x}
              textAnchor="middle"
              x={entry.x}
              y={round(baseline)}
            >
              {entry.value}
            </text>
          ))
        : null}
    </svg>
  );
}

function safeEncode(value: string): BarcodeEncoding | null {
  try {
    return value ? encodeBarcode(value) : null;
  } catch {
    return null;
  }
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
