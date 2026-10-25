/**
 * Barcode labels check.
 *
 * There is no test runner in this repo, so this is the executable check for the
 * barcode label system — the half that needs neither a database nor a browser.
 *
 * One property matters more than every other one here: **a label that leaves
 * the printer must scan back to the product it was printed for.** A mistyped
 * row in a symbology table does not fail loudly anywhere else; it prints a
 * sticker that looks exactly like a barcode and that no scanner can read, and
 * the shop finds out at the till. So the tables are checked against the
 * structural rules every one of their rows obeys, the encoder is checked
 * against golden outputs that an independent decoder (ZXing's Code128Reader and
 * EAN13Reader) read back correctly when this feature was written, and every
 * encoding is decoded again here by a small reader of its own.
 *
 * Covers:
 * - the Code 128 and EAN-13 tables, row by row;
 * - check digits, the in-store generator, and golden encodings;
 * - a round trip through an independent decode for a spread of values;
 * - normalisation, so a scanner's spelling, a person's and the stored one meet;
 * - the till's lookup: barcode before SKU, UPC-A and EAN-13 as one code;
 * - telling a scanner's keystrokes from a person's;
 * - label geometry: every stock offered prints a scannable EAN-13, and every
 *   A4 grid fits its sheet;
 * - the wiring: the partial unique index, the DDL kept out of transactions,
 *   the pages that pass the barcode through, and labels kept away from the
 *   dark-mode generator.
 *
 * Run with: npm run verify:barcodes
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  A4_HEIGHT_MM,
  A4_WIDTH_MM,
  barHeightMm,
  formatLabelPrice,
  formatVariantLine,
  LABEL_PRESETS,
  labelLayout,
  MIN_BAR_HEIGHT_MM,
  MIN_MODULE_MM,
  paginateLabels,
  resolveLabelSize
} from "../apps/web/src/modules/barcodes/barcode-label.layout";
import {
  buildScanIndex,
  EMPTY_WEDGE,
  feedWedgeKey,
  lookupScan,
  saleScanTargets,
  type WedgeState
} from "../apps/web/src/modules/barcodes/barcode.scan";
import {
  assignBarcodesSchema,
  DEFAULT_LABEL_SETTINGS,
  labelSettingsSchema,
  normalizeBarcodeValue,
  optionalBarcodeSchema
} from "../apps/web/src/modules/barcodes/barcode.schema";
import {
  CODE128_PATTERNS,
  code128Symbols,
  EAN_L_PATTERNS,
  EAN_PARITY,
  ean13CheckDigit,
  encodeBarcode,
  generateInStoreEan13,
  isValidEan13,
  type BarcodeEncoding
} from "../apps/web/src/modules/barcodes/barcode.symbology";
import { updateProductSchema } from "../apps/web/src/modules/products/product.schema";

let failures = 0;

function check(label: string, passed: boolean, detail = "") {
  if (passed) {
    console.log(`  ok   ${label}`);
    return;
  }

  failures += 1;
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

/** Bar and space widths from the first bar to the last, as one digit string. */
function widthString(encoding: BarcodeEncoding) {
  let widths = "";
  let previousEnd: number | null = null;

  for (const bar of encoding.bars) {
    if (previousEnd !== null) {
      widths += String(bar.x - previousEnd);
    }

    widths += String(bar.width);
    previousEnd = bar.x + bar.width;
  }

  return widths;
}

/** Decodes a Code 128 width string back to text, B and C subsets, checking the checksum. */
function decodeCode128(widths: string) {
  const symbols: number[] = [];

  for (let index = 0; index + 6 <= widths.length - 7; index += 6) {
    const pattern = widths.slice(index, index + 6);
    const value = CODE128_PATTERNS.indexOf(pattern as (typeof CODE128_PATTERNS)[number]);

    if (value < 0 || value > 105) {
      throw new Error(`unknown symbol ${pattern}`);
    }

    symbols.push(value);
  }

  if (widths.slice(-7) !== CODE128_PATTERNS[106]) {
    throw new Error("missing stop");
  }

  const check = symbols.pop();
  let sum = symbols[0] ?? 0;

  for (let position = 1; position < symbols.length; position += 1) {
    sum += position * (symbols[position] ?? 0);
  }

  if (sum % 103 !== check) {
    throw new Error("bad checksum");
  }

  let mode = symbols[0] === 105 ? "C" : symbols[0] === 104 ? "B" : "?";
  let text = "";

  for (const symbol of symbols.slice(1)) {
    if (symbol === 99) mode = "C";
    else if (symbol === 100) mode = "B";
    else text += mode === "C" ? String(symbol).padStart(2, "0") : String.fromCharCode(symbol + 32);
  }

  return text;
}

/** Decodes an EAN-13's modules back to digits through the parity of its left half. */
function decodeEan13(encoding: BarcodeEncoding) {
  const modules = Array.from({ length: encoding.totalModules }, () => "0");

  for (const bar of encoding.bars) {
    for (let x = bar.x; x < bar.x + bar.width; x += 1) modules[x] = "1";
  }

  const symbol = modules.join("").slice(11, 11 + 95);
  const left = symbol.slice(3, 45);
  const right = symbol.slice(50, 92);
  let parity = "";
  let digits = "";

  for (let index = 0; index < 6; index += 1) {
    const chunk = left.slice(index * 7, index * 7 + 7);
    const asL = EAN_L_PATTERNS.indexOf(chunk as (typeof EAN_L_PATTERNS)[number]);
    const reversed = [...chunk].reverse().map((m) => (m === "1" ? "0" : "1")).join("");
    const asG = EAN_L_PATTERNS.indexOf(reversed as (typeof EAN_L_PATTERNS)[number]);

    parity += asL >= 0 ? "L" : "G";
    digits += String(asL >= 0 ? asL : asG);
  }

  for (let index = 0; index < 6; index += 1) {
    const chunk = right.slice(index * 7, index * 7 + 7);
    const inverted = [...chunk].map((m) => (m === "1" ? "0" : "1")).join("");

    digits += String(EAN_L_PATTERNS.indexOf(inverted as (typeof EAN_L_PATTERNS)[number]));
  }

  if (symbol.slice(0, 3) !== "101" || symbol.slice(45, 50) !== "01010" || symbol.slice(92) !== "101") {
    throw new Error("guards misplaced");
  }

  return `${EAN_PARITY.indexOf(parity as (typeof EAN_PARITY)[number])}${digits}`;
}

function sum(text: string, from: number) {
  let total = 0;

  for (let index = from; index < text.length; index += 2) total += Number(text[index]);

  return total;
}

section("Code 128 table");
{
  check("107 symbols: values 0–105 and stop", CODE128_PATTERNS.length === 107);
  const rows = CODE128_PATTERNS.slice(0, 106);
  const badShape = rows.filter((row) => !/^[1-4]{6}$/.test(row) || sum(row, 0) + sum(row, 1) !== 11);
  check("every symbol is six widths of 1–4 summing to 11 modules", badShape.length === 0, badShape.join(", "));
  // The parity rule every Code 128 symbol obeys: bars even, spaces odd. A
  // mistyped width almost always breaks it.
  const badParity = rows.filter((row) => sum(row, 0) % 2 !== 0 || sum(row, 1) % 2 !== 1);
  check("bars sum even and spaces odd in every symbol", badParity.length === 0, badParity.join(", "));
  check("no two symbols share a pattern", new Set(rows).size === rows.length);
  check("stop is 2331112 (13 modules)", CODE128_PATTERNS[106] === "2331112");
}

section("EAN-13 tables");
{
  const badL = EAN_L_PATTERNS.filter(
    (row) => !/^0[01]{5}1$/.test(row) || [...row].filter((m) => m === "1").length % 2 !== 1 || (row.match(/1+/g) ?? []).length !== 2
  );
  check("L codes: 7 modules, space first, bar last, two bars, odd parity", badL.length === 0, badL.join(", "));
  check("L codes are distinct", new Set(EAN_L_PATTERNS).size === 10);
  check("first-digit parity patterns are distinct and start with L", new Set(EAN_PARITY).size === 10 && EAN_PARITY.every((p) => p.startsWith("L")));
  check("first digit 0 is all L (UPC-A)", EAN_PARITY[0] === "LLLLLL");
  check("every other first digit uses three G", EAN_PARITY.slice(1).every((p) => [...p].filter((c) => c === "G").length === 3));
}

section("Check digits and the in-store generator");
{
  check("4006381333931 is a valid EAN-13", isValidEan13("4006381333931"));
  check("5901234123457 is a valid EAN-13", isValidEan13("5901234123457"));
  check("9780201379624 (an ISBN) is a valid EAN-13", isValidEan13("9780201379624"));
  check("a wrong check digit is not", !isValidEan13("4006381333932"));
  check("twelve digits are not", !isValidEan13("400638133393"));
  check("check digit of 200000000000 is 8", ean13CheckDigit("200000000000") === 8);

  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
  let next = 0;
  const generated = generateInStoreEan13(() => digits[next++ % digits.length] ?? 0);
  check("generated code is 20 + ten digits + check", generated === "2012345678903", generated);
  check("generated code is a valid EAN-13", isValidEan13(generated));

  let threw = false;
  try {
    generateInStoreEan13(() => 10);
  } catch {
    threw = true;
  }
  check("a random source outside 0–9 is refused", threw);
}

section("Golden encodings (read back by ZXing when written)");
{
  const golden: Array<[string, string, number, string]> = [
    ["SKU-001", "code128", 132, "2112142131131123312131311221321231221231221232213212212331112"],
    ["PRD-00042", "code128", 143, "2112143131212311311123131221321231221131412122221121331142122331112"],
    ["4006381333931", "ean13", 113, "11132111123111414113121122211111141114111411311214112221111"],
    ["2000000000008", "ean13", 113, "11132113211112311233211112311111321132113211321132111213111"]
  ];

  for (const [value, symbology, modules, widths] of golden) {
    const encoding = encodeBarcode(value);
    check(
      `${value} encodes as ${symbology}, ${modules} modules, unchanged`,
      encoding.symbology === symbology && encoding.totalModules === modules && widthString(encoding) === widths
    );
  }
}

section("Round trip through an independent decode");
{
  const values = [
    "A", "1", "12", "123", "1234", "12345", "123456", "1234567", "SKU-001", "TS-RED-M",
    "AB12345678CD", "X1234", "HELLO", "!#$%&()*+,-./:;<=>?@[]^_{|}~", "0123456789ABCDEFGHIJ",
    "PRD-00042", "123456789012", "0000", "A00000000B", "9A9", "4006381333931", "2012345678903"
  ];
  const failed: string[] = [];

  for (const value of values) {
    try {
      const encoding = encodeBarcode(value);
      const decoded = encoding.symbology === "ean13" ? decodeEan13(encoding) : decodeCode128(widthString(encoding));

      if (decoded !== value) failed.push(`${value} -> ${decoded}`);
    } catch (error) {
      failed.push(`${value}: ${String(error)}`);
    }
  }

  check(`${values.length} values decode back to themselves`, failed.length === 0, failed.join("; "));
  check("an all-digit even run starts in subset C", code128Symbols("123456")[0] === 105);
  check("a lettered code starts in subset B", code128Symbols("SKU-001")[0] === 104);
  check("C packs digits two to a symbol", code128Symbols("12345678").length === 1 + 4 + 2);
  check("quiet zones: EAN-13 11 + 7 modules", encodeBarcode("4006381333931").bars[0]?.x === 11);
  check("quiet zones: Code 128 10 modules each side", encodeBarcode("SKU-001").bars[0]?.x === 10);
}

section("Normalising a code");
{
  check("spaces between digit groups go", normalizeBarcodeValue(" 5 901234 123457 ") === "5901234123457");
  check("a scanner's CR/LF/Tab suffix goes", normalizeBarcodeValue("SKU-001\r\n\t") === "SKU-001");
  check("letters are upper-cased (Caps Lock at the till)", normalizeBarcodeValue("sku-001") === "SKU-001");
  check("blank clears the field", optionalBarcodeSchema.parse("   ") === null && optionalBarcodeSchema.parse("") === null);
  check("absent stays null", optionalBarcodeSchema.parse(undefined) === null);
  check("a typed code is stored normalised", optionalBarcodeSchema.parse("ts-red m") === "TS-REDM");
  check("33 characters are refused", !optionalBarcodeSchema.safeParse("A".repeat(33)).success);
  check("non-ASCII is refused (a scanner cannot print it)", !optionalBarcodeSchema.safeParse("৳123").success);
  check(
    "an update that does not mention the barcode leaves it alone",
    !("barcode" in updateProductSchema.parse({ title: "Cap" }))
  );
}

section("Ringing up a scan");
{
  const products = [
    { barcode: "2012345678903", id: "jacket", sku: "JKT-1" },
    { barcode: "012345678905", id: "upc", sku: null },
    { barcode: "0049000000443", id: "ean-zero", sku: null },
    { barcode: null, id: "sku-only", sku: "cap-red" },
    { barcode: "X1", id: "barcode-x1", sku: null },
    { barcode: null, id: "sku-x1", sku: "X1" }
  ];
  const index = buildScanIndex(products);
  const hit = (code: string) => lookupScan(index, code)?.id ?? null;

  check("exact barcode", hit("2012345678903") === "jacket");
  check("scanner suffix and stray spaces ignored", hit(" 2012345678903\r\n") === "jacket");
  check("UPC-A stored, scanner sends EAN-13 with leading 0", hit("0012345678905") === "upc");
  check("EAN-13 stored with leading 0, scanner sends UPC-A", hit("049000000443") === "ean-zero");
  check("an SKU still rings up when there is no barcode", hit("CAP-RED") === "sku-only");
  check("SKU matching ignores case", hit("cap-red") === "sku-only");
  check("a barcode beats another product's identical SKU", hit("X1") === "barcode-x1");
  check("an unknown code finds nothing", hit("9999999999999") === null);
  check("an empty scan finds nothing", hit("  ") === null);
}

section("Variants: one barcode, one size and colour");
{
  // A shirt sold by option, a cap sold as itself, and a jacket whose options
  // all carry codes while the product keeps its own box barcode too.
  const catalogue = [
    {
      barcode: null,
      id: "shirt",
      sku: "TS",
      variants: [
        { barcode: "2011111111116", id: "shirt-black-m", sku: "TS-BLACK-M" },
        { barcode: "2022222222225", id: "shirt-red-l", sku: "TS-RED-L" },
        { barcode: null, id: "shirt-red-m", sku: "TS-RED-M" }
      ]
    },
    { barcode: "2033333333334", id: "cap", sku: "CAP", variants: [] },
    { barcode: "JACKET-BOX", id: "jacket", sku: "JKT", variants: [{ barcode: "JACKET-S", id: "jacket-s", sku: "JKT-S" }] }
  ];
  const index = buildScanIndex(saleScanTargets(catalogue));
  const hit = (code: string) => lookupScan(index, code);

  check("a variant's barcode names that exact option", hit("2022222222225")?.variantId === "shirt-red-l");
  check("…of the right product", hit("2022222222225")?.productId === "shirt");
  check("an option with no barcode still rings up by its SKU", hit("ts-red-m")?.variantId === "shirt-red-m");
  check("a product without options rings up as itself", hit("2033333333334")?.variantId === null && hit("2033333333334")?.needsVariant === false);
  check(
    "a product sold by option, scanned by its own box code, asks which option",
    hit("JACKET-BOX")?.productId === "jacket" && hit("JACKET-BOX")?.needsVariant === true && hit("JACKET-BOX")?.variantId === null
  );
  check("an option's SKU beats its product's when the two are the same", (() => {
    const shared = buildScanIndex(saleScanTargets([{ barcode: null, id: "p", sku: "SAME", variants: [{ barcode: null, id: "v", sku: "SAME" }] }]));
    return lookupScan(shared, "SAME")?.variantId === "v";
  })());
  check("a sale line is keyed product::variant", hit("2011111111116")?.id === "shirt::shirt-black-m");

  check("the label's option line names each attribute", formatVariantLine({ Color: "Black", Size: "M" }, "Black / M") === "Color: Black · Size: M");
  check(
    "the option line follows the seller's order, not jsonb's shortest-key-first",
    formatVariantLine({ Size: "M", Color: "Black" }, "Black / M") === "Color: Black · Size: M"
  );
  check("blank attributes are left out", formatVariantLine({ Color: "Black", Size: " " }, "Black") === "Color: Black");
  check("no options falls back to the variant's title", formatVariantLine({}, "Black / M") === "Black / M");

  check("printing needs at least one product or option", !assignBarcodesSchema.safeParse({ productIds: [], variantIds: [] }).success);
  check("options alone are a valid run", assignBarcodesSchema.safeParse({ variantIds: ["v1"] }).success);
  check(
    "products and options count together against the run limit",
    !assignBarcodesSchema.safeParse({ productIds: Array.from({ length: 300 }, (_, i) => `p${i}`), variantIds: Array.from({ length: 201 }, (_, i) => `v${i}`) }).success
  );
  check("the option line is on by default", DEFAULT_LABEL_SETTINGS.showVariant === true);
}

section("Scanner or person");
{
  function type(keys: Array<[string, number]>) {
    let state: WedgeState = EMPTY_WEDGE;
    let scanned: string | null = null;

    for (const [key, at] of keys) {
      const fed = feedWedgeKey(state, key, at);
      state = fed.state;
      scanned = fed.scanned ?? scanned;
    }

    return scanned;
  }

  const at = (text: string, start: number, gap: number): Array<[string, number]> =>
    [...text].map((key, index) => [key, start + index * gap]);

  check("8 ms a key then Enter is a scan", type([...at("2012345678903", 1000, 8), ["Enter", 1000 + 13 * 8]]) === "2012345678903");
  check("Shift before capitals does not break a scan", type([["Shift", 999], ["S", 1000], ["Shift", 1004], ["K", 1008], ["U", 1016], ["1", 1024], ["Enter", 1030]]) === "SKU1");
  check("120 ms a key is a person", type([...at("12345", 1000, 120), ["Enter", 1700]]) === null);
  check("three fast keys are too few", type([...at("123", 1000, 8), ["Enter", 1030]]) === null);
  check("a late Enter is not a scan", type([...at("12345", 1000, 8), ["Enter", 1300]]) === null);
  check("a pause restarts the burst", type([["9", 500], ...at("12345", 1000, 8), ["Enter", 1045]]) === "12345");
}

section("Label geometry");
{
  // Every line on, the option line included: a variant's label is the tightest one printed.
  const allFields = { barcodeText: true, company: true, name: true, price: true, sku: true, variant: true };

  for (const preset of LABEL_PRESETS) {
    const size = resolveLabelSize({ ...DEFAULT_LABEL_SETTINGS, preset: preset.id });
    const layout = labelLayout(size, allFields);
    const moduleMm = layout.barcode.widthMm / encodeBarcode("2012345678903").totalModules;

    check(
      `${preset.name}: an assigned EAN-13 prints at ${moduleMm.toFixed(3)} mm a module (≥ ${MIN_MODULE_MM})`,
      moduleMm >= MIN_MODULE_MM
    );
    check(
      `${preset.name}: bars ${barHeightMm(layout).toFixed(1)} mm tall with every line on (≥ ${MIN_BAR_HEIGHT_MM})`,
      barHeightMm(layout) >= MIN_BAR_HEIGHT_MM
    );

    if (preset.sheet.kind === "sheet") {
      const { columns, gapXMm, gapYMm, marginLeftMm, marginTopMm, rows } = preset.sheet;
      const width = marginLeftMm * 2 + columns * preset.widthMm + (columns - 1) * gapXMm;
      const height = marginTopMm * 2 + rows * preset.heightMm + (rows - 1) * gapYMm;

      check(`${preset.name}: grid fills the A4 width`, Math.abs(width - A4_WIDTH_MM) < 0.05, `${width} mm`);
      check(`${preset.name}: grid fits the A4 height`, height <= A4_HEIGHT_MM + 0.05, `${height} mm`);
    }
  }

  const sheet = LABEL_PRESETS.find((preset) => preset.id === "a4-65")?.sheet ?? { kind: "roll" as const };
  check("a roll is one label per page", paginateLabels(3, { kind: "roll" }, 5).length === 3);
  check("70 labels on 65-up sheets is two pages", paginateLabels(70, sheet, 0).map((page) => page.length).join(",") === "65,5");
  check("skipping 3 leaves the first three slots blank", paginateLabels(2, sheet, 3)[0]?.join(",") === ",,,0,1");
  check("skip is capped below one page", paginateLabels(1, sheet, 500)[0]?.length === 65);
  check("no labels, no pages", paginateLabels(0, sheet, 0).length === 0);

  check("taka shows ৳ and no .00", formatLabelPrice("1250.00", "BDT") === "৳1,250");
  check("paisa are kept when there are any", formatLabelPrice("1250.50", "BDT") === "৳1,250.50");
  check("an unknown currency code still prints", formatLabelPrice("99", "XXXX") === "XXXX 99");
  check("stored settings that are wrong fall back field by field", labelSettingsSchema.parse({ preset: "nope", showSku: true }).preset === "roll-38x25" && labelSettingsSchema.parse({ preset: "nope", showSku: true }).showSku);
}

section("Wiring");
{
  const prisma = read("packages/db/prisma/schema.prisma");
  const productModel = prisma.slice(prisma.indexOf("model Product {"), prisma.indexOf("\n}", prisma.indexOf("model Product {")));
  check("Product has a nullable barcode column", /\n\s+barcode\s+String\?/.test(productModel));
  check(
    "no @@unique on it — db push would refuse it and fail every deploy",
    !/@@unique\(\[storeId, barcode\]\)/.test(productModel)
  );

  const repository = read("apps/web/src/modules/barcodes/barcode.repository.ts");
  check(
    "uniqueness is a partial index created by ensureProductBarcodeSchema",
    /CREATE UNIQUE INDEX IF NOT EXISTS "Product_barcode_unique"[\s\S]*WHERE "barcode" IS NOT NULL/.test(repository)
  );

  const productService = read("apps/web/src/modules/products/product.service.ts");
  const update = productService.slice(productService.indexOf("export async function updateProduct("));
  check(
    "the barcode DDL runs before updateProductRecord opens its transaction",
    update.indexOf("assertProductBarcodeAvailable(") > 0 &&
      update.indexOf("assertProductBarcodeAvailable(") < update.indexOf("updateProductRecord(")
  );

  for (const path of ["apps/web/src/modules/sales/sale.service.ts", "apps/web/src/modules/checkout/checkout.service.ts"]) {
    check(`${path} never reaches the barcode DDL`, !read(path).includes("barcodes/barcode"));
  }

  check(
    "the product edit page posts the barcode back, so a save does not clear it",
    read("apps/web/src/app/dashboard/products/[productId]/edit/page.tsx").includes("barcode: product.barcode")
  );

  for (const path of ["apps/web/src/app/dashboard/sales/new/page.tsx", "apps/web/src/app/dashboard/sales/[saleId]/edit/page.tsx"]) {
    check(
      `${path} gives the sale form its products and their options`,
      read(path).includes("toSaleProductOptions(products, variantsByProduct)")
    );
  }

  const saleProducts = read("apps/web/src/modules/sales/sale-products.ts");
  check(
    "the sale catalogue carries each product's and each option's barcode",
    saleProducts.includes("barcode: product.barcode") && saleProducts.includes("barcode: variant.barcode")
  );
  check(
    "the edit page posts each line's option back",
    read("apps/web/src/app/dashboard/sales/[saleId]/edit/page.tsx").includes('variantId: item.variantId ?? ""')
  );

  check("SaleItem records which option was sold", /model SaleItem \{[\s\S]*?variantId\s+String\?/.test(prisma));

  const saleService = read("apps/web/src/modules/sales/sale.service.ts");
  check(
    "a product with active options cannot be sold without one",
    saleService.includes("productHasActiveVariants(tx, storeId, product.id)") && saleService.includes("Choose which option of")
  );
  check(
    "an option's stock moves on the option, refused below zero in the statement itself",
    /adjustProductVariantStock\(tx, storeId, item\.productId, item\.variantId, -item\.quantity\)\) !== 1/.test(saleService)
  );
  check(
    "no variant DDL runs inside a sale's transaction",
    !saleService.includes("decrementProductVariantStock") && !saleService.includes("incrementProductVariantStock")
  );
  for (const name of ["createSale", "updateSale", "voidSale"]) {
    const body = saleService.slice(saleService.indexOf(`export async function ${name}(`));
    check(
      `${name} ensures the variant schema before opening its transaction`,
      body.indexOf("await ensureProductVariantSchema()") > 0 && body.indexOf("await ensureProductVariantSchema()") < body.indexOf("prisma.$transaction(")
    );
  }

  const variantsService = read("apps/web/src/modules/products/product-variants.service.ts");
  const save = variantsService.slice(variantsService.indexOf("export async function setProductVariantConfiguration("));
  check(
    "saving a product keeps its variants' ids — removed options are deleted, the rest updated in place",
    save.includes(`"optionSignature" NOT IN (`) && /UPDATE \$\{tableName\("ProductVariant"\)\} SET\s+"title" = \$4/.test(save)
  );
  check(
    "the variant barcode index is ensured before the save's transaction",
    save.indexOf("await ensureVariantBarcodeIndex()") > 0 && save.indexOf("await ensureVariantBarcodeIndex()") < save.indexOf("prisma.$transaction(")
  );
  check(
    "a barcode posted back as it loaded keeps the stored one (a label printed since)",
    /posted === normalizeBarcodeValue\(variant\.loadedBarcode \?\? ""\)\)\s*\{\s*return existing\.barcode;/.test(variantsService)
  );
  const createSchema = variantsService.slice(variantsService.indexOf("async function createProductVariantSchema("));
  check(
    "the variant barcode index stays out of the DDL checkout runs inside its transaction",
    !createSchema.slice(0, createSchema.indexOf("function getDatabaseSchemaName")).includes("ProductVariant_barcode_unique")
  );
  check(
    "a store with duplicate variant barcodes still sells: the index refusal is logged, not thrown",
    variantsService.includes("could not create unique index|23505")
  );
  check(
    "the variant uniqueness check also looks at product barcodes",
    /prisma\.product\.findFirst\(\{\s+where: \{ barcode: \{ in: codes \}, storeId \}/.test(variantsService)
  );

  check(
    "the variants editor sends what each barcode was when it loaded",
    read("apps/web/src/modules/products/components/product-variants-editor.tsx").includes("loadedBarcode: loadedBarcodes.get(variant.draftId)")
  );
  check(
    "the product form does the same for the product's own barcode",
    read("apps/web/src/modules/barcodes/components/product-barcode-field.tsx").includes('name="barcodeLoaded"') &&
      read("apps/web/src/modules/products/product.actions.ts").includes("if (barcodeUntouched(formData))")
  );
  const saleFormSource = read("apps/web/src/modules/sales/components/sale-form.tsx");
  check(
    "the sale form posts one variantId per row, blank where there is nothing to choose",
    saleFormSource.includes('<input name="variantId" type="hidden" value="" />') && saleFormSource.includes('name="variantId"')
  );

  const saleForm = read("apps/web/src/modules/sales/components/sale-form.tsx");
  check("the sale form has the scan box", saleForm.includes("<SaleScanBox"));
  check("Enter in a sale field never saves the sale", saleForm.includes("onKeyDown={keepEnterFromSaving}"));

  // A label is paper: a Tailwind colour would be mapped by the dark-mode
  // generator and could print white on white.
  const colourUtility = /(?<![\w-])(?:bg|text|border|fill|stroke|ring|outline)-(?:\[#[0-9a-fA-F]{3,8}\]|white|black|[a-z]+-\d{2,3})(?![\w-])/;

  for (const file of ["barcode-label.tsx", "barcode-svg.tsx", "barcode-print-sheet.tsx"]) {
    check(
      `${file} uses no Tailwind colour, out of the dark-mode generator's reach`,
      !colourUtility.test(read(`apps/web/src/modules/barcodes/components/${file}`))
    );
  }
}

console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
