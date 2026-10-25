/**
 * Label geometry: the label stock a shop actually buys, and how a label's few
 * lines share it.
 *
 * Everything is millimetres, because that is what is printed on the box of
 * labels and what the print dialog asks for. Pure functions only — the preview
 * on screen and the sheet sent to the printer are drawn from the same numbers,
 * and `verify-barcodes` can check those numbers without a browser.
 */

export const LABEL_PRESET_IDS = [
  "roll-38x25",
  "roll-40x30",
  "roll-50x25",
  "roll-50x30",
  "roll-60x40",
  "roll-custom",
  "a4-65",
  "a4-40",
  "a4-24"
] as const;

export type LabelPresetId = (typeof LABEL_PRESET_IDS)[number];

/**
 * A roll prints one label per page, the page being the label — which is how a
 * thermal label printer's driver expects to be fed. A sheet is a grid on A4.
 */
export type LabelSheet =
  | { kind: "roll" }
  | {
      columns: number;
      gapXMm: number;
      gapYMm: number;
      kind: "sheet";
      marginLeftMm: number;
      marginTopMm: number;
      rows: number;
    };

export type LabelPreset = {
  heightMm: number;
  id: LabelPresetId;
  name: string;
  sheet: LabelSheet;
  widthMm: number;
};

const ROLL: LabelSheet = { kind: "roll" };

/**
 * The rolls are the common thermal label sizes; the sheets are the standard
 * A4 layouts (65, 40 and 24 to a page), whose margins are those of the
 * products sold for them — a grid that misses the die-cut by 2 mm prints every
 * label across two stickers.
 */
export const LABEL_PRESETS: readonly LabelPreset[] = [
  { heightMm: 25, id: "roll-38x25", name: "Thermal roll · 38 × 25 mm", sheet: ROLL, widthMm: 38 },
  { heightMm: 30, id: "roll-40x30", name: "Thermal roll · 40 × 30 mm", sheet: ROLL, widthMm: 40 },
  { heightMm: 25, id: "roll-50x25", name: "Thermal roll · 50 × 25 mm", sheet: ROLL, widthMm: 50 },
  { heightMm: 30, id: "roll-50x30", name: "Thermal roll · 50 × 30 mm", sheet: ROLL, widthMm: 50 },
  { heightMm: 40, id: "roll-60x40", name: "Thermal roll · 60 × 40 mm", sheet: ROLL, widthMm: 60 },
  { heightMm: 25, id: "roll-custom", name: "Thermal roll · custom size", sheet: ROLL, widthMm: 38 },
  {
    heightMm: 21.2,
    id: "a4-65",
    name: "A4 sheet · 65 labels (38.1 × 21.2 mm)",
    sheet: { columns: 5, gapXMm: 2.5, gapYMm: 0, kind: "sheet", marginLeftMm: 4.75, marginTopMm: 10.7, rows: 13 },
    widthMm: 38.1
  },
  {
    heightMm: 25.4,
    id: "a4-40",
    name: "A4 sheet · 40 labels (45.7 × 25.4 mm)",
    sheet: { columns: 4, gapXMm: 2.6, gapYMm: 0, kind: "sheet", marginLeftMm: 9.7, marginTopMm: 21.5, rows: 10 },
    widthMm: 45.7
  },
  {
    heightMm: 33.9,
    id: "a4-24",
    name: "A4 sheet · 24 labels (63.5 × 33.9 mm)",
    sheet: { columns: 3, gapXMm: 2.5, gapYMm: 0, kind: "sheet", marginLeftMm: 7.25, marginTopMm: 12.9, rows: 8 },
    widthMm: 63.5
  }
];

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

export type LabelSize = { heightMm: number; sheet: LabelSheet; widthMm: number };

export function resolveLabelSize(settings: {
  customHeightMm: number;
  customWidthMm: number;
  preset: LabelPresetId;
}): LabelSize {
  const preset = LABEL_PRESETS.find((entry) => entry.id === settings.preset) ?? LABEL_PRESETS[0];

  if (!preset || preset.id === "roll-custom") {
    return { heightMm: settings.customHeightMm, sheet: ROLL, widthMm: settings.customWidthMm };
  }

  return { heightMm: preset.heightMm, sheet: preset.sheet, widthMm: preset.widthMm };
}

export type LabelFields = {
  barcodeText: boolean;
  company: boolean;
  name: boolean;
  price: boolean;
  sku: boolean;
  /** The option line — "Color: Black · Size: M". Only a variant's label has one. */
  variant: boolean;
};

export type LabelLayout = {
  barcode: { heightMm: number; textMm: number; widthMm: number };
  companyMm: number;
  gapMm: number;
  nameLines: number;
  nameMm: number;
  paddingXMm: number;
  paddingYMm: number;
  priceMm: number;
  skuMm: number;
  variantMm: number;
};

/** Line height as a multiple of the font size, for every text line on a label. */
export const LABEL_LINE_HEIGHT = 1.18;

/**
 * The barcode needs only a millimetre of label edge beside it: its own quiet
 * zone is part of its width, and that is the clear space a scanner needs.
 */
const BARCODE_SIDE_PADDING_MM = 0.8;

/**
 * Below this a 203 dpi thermal head — 0.125 mm a dot — draws a module as one or
 * two dots at random, and scanners start to miss. EAN-13 on a 38 mm label sits
 * near 0.3 mm; a long Code 128 is what trips this.
 */
export const MIN_MODULE_MM = 0.2;

/** Bars shorter than this are hard to aim a hand scanner at. */
export const MIN_BAR_HEIGHT_MM = 5;

/**
 * Font sizes step with the label's height, and whatever height the text lines
 * leave is the barcode's. The text is sized first because a name nobody can
 * read is a label nobody can use; the bars only need to clear `MIN_BAR_HEIGHT_MM`.
 */
export function labelLayout(size: { heightMm: number; widthMm: number }, fields: LabelFields): LabelLayout {
  const compact = size.heightMm < 24;
  const roomy = size.heightMm >= 32;
  const paddingXMm = clamp(size.widthMm * 0.04, 1.2, 3);
  const paddingYMm = clamp(size.heightMm * 0.045, 0.8, 2.2);
  const gapMm = compact ? 0.3 : 0.5;
  const companyMm = compact ? 1.7 : roomy ? 2.5 : 2.1;
  const nameMm = compact ? 1.9 : roomy ? 2.8 : 2.3;
  const nameLines = size.heightMm >= 29 ? 2 : 1;
  const priceMm = compact ? 2.6 : roomy ? 4 : 3.2;
  const skuMm = companyMm;
  const variantMm = compact ? 1.8 : roomy ? 2.6 : 2.1;
  const textMm = fields.barcodeText ? (compact ? 1.7 : roomy ? 2.4 : 2) : 0;
  let usedMm = 0;
  let blocks = 1;

  if (fields.company) {
    usedMm += companyMm * LABEL_LINE_HEIGHT;
    blocks += 1;
  }

  if (fields.name) {
    usedMm += nameMm * LABEL_LINE_HEIGHT * nameLines;
    blocks += 1;
  }

  if (fields.variant) {
    usedMm += variantMm * LABEL_LINE_HEIGHT;
    blocks += 1;
  }

  if (fields.price || fields.sku) {
    usedMm += Math.max(fields.price ? priceMm : 0, fields.sku ? skuMm : 0) * LABEL_LINE_HEIGHT;
    blocks += 1;
  }

  const barcodeHeightMm = size.heightMm - paddingYMm * 2 - usedMm - gapMm * (blocks - 1);

  return {
    barcode: {
      heightMm: round(Math.max(barcodeHeightMm, 0)),
      textMm,
      widthMm: round(size.widthMm - BARCODE_SIDE_PADDING_MM * 2)
    },
    companyMm,
    gapMm,
    nameLines,
    nameMm,
    paddingXMm: round(paddingXMm),
    paddingYMm: round(paddingYMm),
    priceMm,
    skuMm,
    variantMm
  };
}

/**
 * A variant's option line as a label prints it: each attribute named, because
 * "M" alone on a sticker could be a size or a colour code, and the variant's
 * own title when its options are not known.
 *
 * In the order of the title ("Black / M" → colour, then size), which is the
 * seller's attribute order: the options come back from a `jsonb` column, and
 * `jsonb` sorts its keys shortest-first, so "Size" would otherwise lead.
 */
export function formatVariantLine(options: Record<string, string>, title: string | null) {
  const order = (title ?? "").split("/").map((segment) => segment.trim());
  const rank = (value: string) => {
    const position = order.indexOf(value);

    return position < 0 ? order.length : position;
  };
  const parts = Object.entries(options)
    .map(([name, value]) => ({ name: name.trim(), value: value.trim() }))
    .filter((part) => part.name && part.value)
    .sort((left, right) => rank(left.value) - rank(right.value))
    .map((part) => `${part.name}: ${part.value}`);

  return parts.length ? parts.join(" · ") : (title?.trim() ?? "");
}

/** How tall the bars themselves come out, once the digit line is taken off. */
export function barHeightMm(layout: LabelLayout) {
  return layout.barcode.heightMm - layout.barcode.textMm * LABEL_LINE_HEIGHT;
}

/**
 * Which label goes in which slot, page by page: `null` is a slot left blank.
 *
 * A roll is one label to a page. A sheet starts `skip` slots in, so a sheet
 * with its first row already used can go back through the printer; `skip` is
 * capped below one page, since skipping a whole sheet is just using the next.
 */
export function paginateLabels(count: number, sheet: LabelSheet, skip: number) {
  if (count <= 0) {
    return [];
  }

  if (sheet.kind === "roll") {
    return Array.from({ length: count }, (_, index) => [index]);
  }

  const perPage = sheet.columns * sheet.rows;
  const offset = clamp(Math.trunc(skip), 0, perPage - 1);
  const slots: Array<number | null> = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: count }, (_, index) => index)
  ];
  const pages: Array<Array<number | null>> = [];

  for (let start = 0; start < slots.length; start += perPage) {
    pages.push(slots.slice(start, start + perPage));
  }

  return pages;
}

/**
 * The price as a shopper reads it on a shelf: the currency's own symbol (৳ for
 * taka) and no `.00` on a whole amount. Decimal arithmetic stays on the string;
 * `Number` here only ever formats.
 */
export function formatLabelPrice(amount: string, currency: string) {
  const value = Number(amount);

  if (!Number.isFinite(value)) {
    return amount;
  }

  const fractionDigits = Number.isInteger(value) ? 0 : 2;

  try {
    return new Intl.NumberFormat("en", {
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: fractionDigits,
      style: "currency"
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(fractionDigits)}`;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
