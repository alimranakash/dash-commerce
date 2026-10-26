/**
 * Sale scanner check.
 *
 * There is no test runner in this repo, so this is the executable check for the
 * counter's barcode scanner at /dashboard/sales/new — the half that needs
 * neither a database nor a browser. `verify-barcodes` owns the symbologies and
 * the label; this owns what happens when one of those labels is scanned at the
 * till: which line it rings up, at what price, against what stock, and what it
 * must never do on the way.
 *
 * Covers:
 * - a scan adds a line, a second scan of it adds one to that line, and two
 *   products make two lines — mixed freely with lines picked by hand;
 * - a variant's barcode rings up that exact option at its own price;
 * - unknown, ambiguous and trashed codes are refused, and scanning carries on;
 * - stock: the rule completing the sale enforces, over every line of the item,
 *   with an option's keep-selling switch and an edited sale's own units;
 * - leading zeros survive from the scanner to the match;
 * - rapid consecutive scans are neither lost nor doubled, through the keyboard
 *   wedge with Enter, Tab or CR+LF suffixes;
 * - a scan touches the lines and nothing else, and its Enter cannot save;
 * - one store's catalogue cannot ring up another's barcode.
 *
 * Run with: npm run verify:sale-scanner
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EMPTY_WEDGE, feedWedgeKey, type WedgeState } from "../apps/web/src/modules/barcodes/barcode.scan";
import { normalizeBarcodeValue } from "../apps/web/src/modules/barcodes/barcode.schema";
import {
  buildSaleScanCatalogue,
  emptySaleLine,
  ringUpScan,
  stockHeldBySale,
  type SaleLine,
  type SaleProductOption,
  type SaleScanCatalogue,
  type SaleScanFeedback
} from "../apps/web/src/modules/sales/sale-scan";

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

const CAP = "2033333333334";
const MUG = "2044444444443";
const BLACK_M = "2011111111116";
const RED_L = "2022222222225";
const TRASHED = "2055555555552";
const EMPTY = "2066666666661";

const products: SaleProductOption[] = [
  { barcode: CAP, id: "cap", price: "350.00", sku: "CAP", stockQuantity: 10, title: "Cap" },
  { barcode: MUG, id: "mug", price: "220.00", sku: "MUG", stockQuantity: 2, title: "Mug" },
  {
    barcode: "SHIRT-BOX",
    id: "shirt",
    price: "500.00",
    sku: "TS",
    stockQuantity: 0,
    title: "Shirt",
    variants: [
      { barcode: BLACK_M, continueSelling: false, id: "black-m", price: "550.00", sku: "TS-BLACK-M", stockQuantity: 3, title: "Black / M" },
      { barcode: RED_L, continueSelling: true, id: "red-l", price: "600.00", sku: "TS-RED-L", stockQuantity: 0, title: "Red / L" },
      { barcode: null, continueSelling: false, id: "red-m", price: "580.00", sku: "TS-RED-M", stockQuantity: 1, title: "Red / M" }
    ]
  },
  {
    barcode: null,
    id: "socks",
    price: "120.00",
    sku: "SOCKS",
    stockQuantity: 0,
    title: "Socks",
    // Two sizes printed with one code: the product is certain, the size is not.
    variants: [
      { barcode: "SOCKS-SHARED", continueSelling: false, id: "socks-s", price: "120.00", stockQuantity: 4, title: "S" },
      { barcode: "SOCKS-SHARED", continueSelling: false, id: "socks-l", price: "130.00", stockQuantity: 4, title: "L" }
    ]
  },
  { barcode: "0001234", id: "zeros", price: "90.00", sku: null, stockQuantity: 5, title: "Leading Zero Tea" },
  { barcode: "012345678905", id: "upc", price: "75.00", sku: null, stockQuantity: 5, title: "UPC Biscuits" },
  { archived: true, barcode: TRASHED, id: "old", price: "10.00", sku: null, stockQuantity: 9, title: "Old Stock" },
  { barcode: EMPTY, id: "empty", price: "40.00", sku: null, stockQuantity: 0, title: "Sold Out Soap" },
  // A legacy duplicate the unique index arrived too late to stop.
  { barcode: "DUPE-1", id: "dupe-a", price: "100.00", sku: null, stockQuantity: 5, title: "Blue Pen" },
  { barcode: "DUPE-1", id: "dupe-b", price: "15.00", sku: null, stockQuantity: 5, title: "Red Pen" },
  // A trashed product left holding a live product's code.
  { archived: true, barcode: "LIVE-1", id: "live-old", price: "5.00", sku: null, stockQuantity: 5, title: "Old Lamp" },
  { barcode: "LIVE-1", id: "live", price: "800.00", sku: null, stockQuantity: 5, title: "Lamp" }
];

const shop = buildSaleScanCatalogue(products, "BDT");

let lineCounter = 0;
const newLineId = () => `line-${(lineCounter += 1)}`;

/** Scans each code in turn, each on the lines the last one left — as the form does. */
function ring(codes: string[], lines: SaleLine[] = [emptySaleLine("blank")], catalogue: SaleScanCatalogue = shop) {
  const feedback: SaleScanFeedback[] = [];
  let current = lines;

  for (const code of codes) {
    const result = ringUpScan(current, catalogue, code, newLineId);

    current = result.lines;
    feedback.push(result.feedback);
  }

  return { feedback, lines: current };
}

const quantityOf = (lines: SaleLine[], productId: string, variantId = "") =>
  lines.filter((line) => line.productId === productId && line.variantId === variantId).reduce((total, line) => total + line.quantity, 0);

const manualLine = (id: string, productId: string, patch: Partial<SaleLine> = {}): SaleLine => ({
  ...emptySaleLine(id),
  productId,
  unitPrice: products.find((product) => product.id === productId)?.price ?? "0.00",
  ...patch
});

section("1. A scan adds the product to the sale");
{
  const { feedback, lines } = ring([CAP]);
  const line = lines[0];

  check("one line, filling the empty row the form opens with", lines.length === 1 && line?.id === "blank");
  check("the scanned product, quantity 1", line?.productId === "cap" && line.quantity === 1 && line.variantId === "");
  check("at the catalogue's price", line?.unitPrice === "350.00");
  check("the cashier is told what was added", feedback[0]?.tone === "ok" && feedback[0].message.startsWith("Cap added"));
  check("the feedback names the line to highlight", feedback[0]?.lineId === "blank");

  const appended = ring([CAP], [manualLine("manual", "mug")]);
  check("with no empty row, a new line is appended", appended.lines.length === 2 && appended.lines[1]?.productId === "cap");
}

section("2. Scanning the same barcode again adds one to its line");
{
  const { feedback, lines } = ring([CAP, CAP, CAP]);

  check("still one line", lines.length === 1);
  check("quantity 3", quantityOf(lines, "cap") === 3);
  check("feedback says the new quantity", feedback[2]?.message === "Cap — qty 3" && feedback[2].tone === "ok");
  check("and points at the same line", feedback[2]?.lineId === feedback[0]?.lineId);

  const edited = ring([MUG], [manualLine("manual", "mug", { discount: "5.00", unitPrice: "200.00" })]);
  check(
    "a line picked by hand is the one a scan adds to, keeping the cashier's price and discount",
    edited.lines.length === 1 && edited.lines[0]?.quantity === 2 && edited.lines[0].unitPrice === "200.00" && edited.lines[0].discount === "5.00"
  );

  const lowered = ring([CAP], [manualLine("manual", "cap", { quantity: 1 })]);
  const removedThenScanned = ring([CAP], ring([CAP, CAP]).lines.filter(() => false));
  check("a quantity changed by hand is what the next scan adds to", quantityOf(lowered.lines, "cap") === 2);
  check("a removed line is gone for the next scan — it starts again at 1", quantityOf(removedThenScanned.lines, "cap") === 1);
}

section("3. Two different products make two lines");
{
  const { lines } = ring([CAP, "0001234", CAP]);

  check("two lines", lines.length === 2);
  check("each with its own quantity", quantityOf(lines, "cap") === 2 && quantityOf(lines, "zeros") === 1);
  check("each at its own price", lines.find((line) => line.productId === "zeros")?.unitPrice === "90.00");
}

section("4. A variant's barcode rings up that exact option");
{
  const { feedback, lines } = ring([BLACK_M, RED_L, BLACK_M]);
  const black = lines.find((line) => line.variantId === "black-m");

  check("the option, on its product", black?.productId === "shirt");
  check("at the option's own price, not the product's", black?.unitPrice === "550.00");
  check("Black / M and Red / L are two lines", lines.length === 2 && quantityOf(lines, "shirt", "black-m") === 2 && quantityOf(lines, "shirt", "red-l") === 1);
  check("feedback names product and option", feedback[0]?.message.startsWith("Shirt - Black / M added") === true);

  const bySku = ring(["ts-red-m"]);
  check("an option with no barcode still rings up by its SKU", bySku.lines[0]?.variantId === "red-m");

  const box = ring(["SHIRT-BOX"]);
  check(
    "the product's own box code opens a line still waiting for its option",
    box.lines[0]?.productId === "shirt" && box.lines[0].variantId === "" && box.feedback[0]?.tone === "warn"
  );

  const shared = ring(["SOCKS-SHARED"]);
  check(
    "two options sharing a code are not guessed between — the cashier picks",
    shared.lines[0]?.productId === "socks" && shared.lines[0].variantId === "" && shared.feedback[0]?.tone === "warn"
  );
}

section("5. Unknown and ambiguous barcodes are refused, and scanning carries on");
{
  const start = [manualLine("manual", "cap")];
  const unknown = ringUpScan(start, shop, "9999999999999", newLineId);

  check("an unknown code is an error", unknown.feedback.tone === "error" && unknown.feedback.message.includes('"9999999999999"'));
  check("…and the lines are exactly as they were", unknown.lines === start);

  const ambiguous = ringUpScan(start, shop, "DUPE-1", newLineId);
  check("a code on two products is refused, not guessed", ambiguous.feedback.tone === "error" && ambiguous.lines === start);
  check(
    "…naming both, so the cashier can pick the right one by hand",
    ambiguous.feedback.message.includes("Blue Pen") && ambiguous.feedback.message.includes("Red Pen")
  );

  const upcPair = buildSaleScanCatalogue(
    [
      { barcode: "036000291452", id: "a", price: "1.00", stockQuantity: 5, title: "UPC-A row" },
      { barcode: "0036000291452", id: "b", price: "2.00", stockQuantity: 5, title: "EAN-13 row" }
    ],
    "BDT"
  );
  check(
    "a UPC-A on one product and its EAN-13 spelling on another is the same symbol — refused",
    ringUpScan([], upcPair, "036000291452", newLineId).feedback.tone === "error"
  );

  const trashLive = ring(["LIVE-1"]);
  check("a trashed product sharing a live product's code does not block it", trashLive.lines[0]?.productId === "live");

  const recovered = ring(["NOPE", "DUPE-1", CAP]);
  check("the next good scan after a refusal rings up normally", recovered.lines.length === 1 && quantityOf(recovered.lines, "cap") === 1);
  check("an empty scan rings up nothing", ringUpScan(start, shop, "  \r\n", newLineId).lines === start);
}

section("6. Trashed and out-of-stock products follow the sale's stock rules");
{
  const start = [emptySaleLine("blank")];
  const trashed = ringUpScan(start, shop, TRASHED, newLineId);
  check("a product in the trash is refused", trashed.feedback.tone === "error" && trashed.lines === start);
  check("…and the cashier is told where it went", trashed.feedback.message === "Old Stock is in the trash. Restore it in Products to sell it.");

  const empty = ringUpScan(start, shop, EMPTY, newLineId);
  check("a product with no stock is refused", empty.feedback.tone === "error" && empty.lines === start);
  check("…saying so", empty.feedback.message === "Sold Out Soap is out of stock.");

  const mugs = ring([MUG, MUG, MUG]);
  check("stock 2: two scans ring up, the third is refused", quantityOf(mugs.lines, "mug") === 2 && mugs.feedback[2]?.tone === "error");
  check("…with how many there are", mugs.feedback[2]?.message === "Only 2 of Mug in stock, and 2 already on this sale.");

  const split = ring([MUG], [manualLine("a", "mug"), manualLine("b", "mug")]);
  check("stock counts every line of the item, not only the one a scan adds to", split.feedback[0]?.tone === "error");

  const option = ring(["TS-RED-M", "TS-RED-M"]);
  check("an option's own stock: 1 on hand, the second scan is refused", quantityOf(option.lines, "shirt", "red-m") === 1 && option.feedback[1]?.tone === "error");

  const keepSelling = ring([RED_L, RED_L, RED_L]);
  check("an option set to keep selling past zero rings up anyway", quantityOf(keepSelling.lines, "shirt", "red-l") === 3);

  // Editing a completed sale: saving gives its units back before taking the
  // new quantities, so they count as this sale's own.
  const completedLines = [manualLine("sold", "mug", { quantity: 2 })];
  const afterSale = buildSaleScanCatalogue(
    products.map((product) => (product.id === "mug" ? { ...product, stockQuantity: 1 } : product)),
    "BDT",
    stockHeldBySale({ items: completedLines, status: "COMPLETED" })
  );
  check("an edited completed sale may use the units it already took", quantityOf(ring([MUG], completedLines, afterSale).lines, "mug") === 3);
  check("…but not one more", ring([MUG, MUG], completedLines, afterSale).feedback[1]?.tone === "error");
  check("a draft took nothing, so holds nothing", stockHeldBySale({ items: completedLines, status: "DRAFT" }).size === 0);

  const variantService = read("apps/web/src/modules/products/product-variants.service.ts");
  const options = variantService.slice(variantService.indexOf("export async function getStoreVariantOptions("));
  check(
    "an inactive option never reaches the till's catalogue",
    options.slice(0, options.indexOf("byProductId")).includes(`WHERE "storeId" = $1 AND "status" = 'ACTIVE'`)
  );
  check(
    "the catalogue flags the trash from the product's status",
    read("apps/web/src/modules/sales/sale-products.ts").includes('archived: product.status === "ARCHIVED"')
  );
}

section("7. Leading zeros survive");
{
  check("normalising keeps leading zeros", normalizeBarcodeValue(" 0001234\r\n") === "0001234");
  check("an exact leading-zero code rings up", ring(["0001234"]).lines[0]?.productId === "zeros");
  check("with the scanner's suffix", ring(["0001234\r\n"]).lines[0]?.productId === "zeros");
  check("the zeros are not optional: 1234 is a different code", ring(["1234"]).feedback[0]?.tone === "error");
  check("…and neither is an extra one", ring(["00001234"]).feedback[0]?.tone === "error");
  check("a UPC-A rings up as stored", ring(["012345678905"]).lines[0]?.productId === "upc");
  check("…and from a scanner set to send it as EAN-13", ring(["0012345678905"]).lines[0]?.productId === "upc");
  check(
    "the scan box is a text field, never a number one that would drop the zeros",
    /<input[\s\S]*?type="text"[\s\S]*?value=\{value\}/.test(read("apps/web/src/modules/sales/components/sale-scan-box.tsx"))
  );
}

section("8. Rapid consecutive scans are neither lost nor doubled");
{
  const basket = [CAP, "0001234", CAP, BLACK_M, CAP, "012345678905", BLACK_M, CAP, "0001234", CAP];
  const { feedback, lines } = ring(basket);

  check("every scan rang up", feedback.every((entry) => entry.tone === "ok"));
  check(
    "exact quantities",
    quantityOf(lines, "cap") === 5 && quantityOf(lines, "zeros") === 2 && quantityOf(lines, "upc") === 1 && quantityOf(lines, "shirt", "black-m") === 2
  );
  check("one line per item", lines.length === 4);

  const twice = ringUpScan([emptySaleLine("x")], shop, CAP, () => "fresh");
  const again = ringUpScan([emptySaleLine("x")], shop, CAP, () => "fresh");
  check("ringing up is pure — the same scan on the same lines gives the same lines", JSON.stringify(twice) === JSON.stringify(again));

  function keystream(keys: Array<[string, number]>) {
    let state: WedgeState = EMPTY_WEDGE;
    const scanned: string[] = [];

    for (const [key, at] of keys) {
      const fed = feedWedgeKey(state, key, at);

      state = fed.state;

      if (fed.scanned) {
        scanned.push(fed.scanned);
      }
    }

    return scanned;
  }

  const typed = (code: string, start: number, suffix: string[] = ["Enter"]): Array<[string, number]> => [
    ...[...code].map((key, index): [string, number] => [key, start + index * 4]),
    ...suffix.map((key, index): [string, number] => [key, start + code.length * 4 + index * 2])
  ];

  check(
    "three codes back to back, 4 ms a key, each ended by Enter: exactly three scans, in order",
    JSON.stringify(keystream([...typed(CAP, 1000), ...typed(MUG, 1080), ...typed(BLACK_M, 1160)])) === JSON.stringify([CAP, MUG, BLACK_M])
  );
  check(
    "a scanner set to end with Tab",
    JSON.stringify(keystream([...typed(CAP, 1000, ["Tab"]), ...typed(MUG, 1080, ["Tab"])])) === JSON.stringify([CAP, MUG])
  );
  check(
    "a CR+LF suffix (two Enters) is one scan, not two",
    JSON.stringify(keystream([...typed(CAP, 1000, ["Enter", "Enter"]), ...typed(MUG, 1100, ["Enter", "Enter"])])) === JSON.stringify([CAP, MUG])
  );
  check(
    "Tab typed at a person's pace is navigation, not a scan",
    keystream([...[..."1234"].map((key, index): [string, number] => [key, 1000 + index * 150]), ["Tab", 1700]]).length === 0
  );

  const form = read("apps/web/src/modules/sales/components/sale-form.tsx");
  check(
    "the form records each scan's lines before React re-renders, so the next scan builds on them",
    /linesRef\.current = result\.lines;\s*setItems\(result\.lines\);/.test(form)
  );
  check("and every scan starts from those lines, not a render's copy", form.includes("ringUpScan(before, scanCatalogue, code"));

  const box = read("apps/web/src/modules/sales/components/sale-scan-box.tsx");
  check("the scan box reads the code from the field itself, not a render's state", box.includes("const code = event.currentTarget.value;"));
  check(
    "a Tab after a code in the box is the scanner's suffix; in an empty box it still moves focus",
    box.includes(`event.key === "Tab" && !event.shiftKey && code.trim()`)
  );
}

section("9. A scan changes the lines and nothing else, and never saves the sale");
{
  const start = [manualLine("manual", "mug", { discount: "5.00", unitPrice: "200.00" })];
  const result = ringUpScan(start, shop, CAP, newLineId);

  check("ringing up returns lines and feedback, nothing else", JSON.stringify(Object.keys(result).sort()) === JSON.stringify(["feedback", "lines"]));
  check("other lines are left exactly as they were", result.lines[0] === start[0]);
  check("a refused scan returns the very same lines", ringUpScan(start, shop, "NOPE", newLineId).lines === start);

  const scanModule = read("apps/web/src/modules/sales/sale-scan.ts");
  check("the ring-up module has no React or DOM in it", !/from "react"|document\.|window\./.test(scanModule));

  const box = read("apps/web/src/modules/sales/components/sale-scan-box.tsx");
  const form = read("apps/web/src/modules/sales/components/sale-form.tsx");
  check("the scanner listener runs in the capture phase, before any field's own handler", box.includes(`document.addEventListener("keydown", onKeyDown, true)`));
  check(
    "a detected scan's Enter is stopped there, so it cannot press Save or pick a customer",
    /if \(!fed\.scanned\) \{\s*return;\s*\}[\s\S]*?event\.preventDefault\(\);\s*event\.stopPropagation\(\);/.test(box)
  );
  check("Enter in the scan box adds a product, never submits", /event\.preventDefault\(\);\s*scan\(code, "box"\);/.test(box));
  check("Enter in any other sale field never saves the sale", form.includes("onKeyDown={keepEnterFromSaving}"));
  check("nothing in the scanner path submits the form", !/requestSubmit|\.submit\(/.test(box + scanModule));
  const scanInput = box.slice(box.indexOf("<input"), box.indexOf("/>", box.indexOf("<input")));
  check(
    "the scan box has no name, so a half-typed code is never posted with the sale",
    scanInput.includes("onKeyDown={takeScan}") && !/\bname=/.test(scanInput)
  );
  check(
    "a field the burst did not change is not re-fired — a change event would re-pick a line's product and drop its option",
    box.includes("field.value !== burstOriginal")
  );
  check(
    "a burst that turns out to be a scan rings up on the lines from before its first key",
    box.includes("onBurstStartRef.current?.()") && form.includes(`origin === "page" ? (burstLines.current ?? linesRef.current)`)
  );
  check("the notes box and other free text are never treated as scans", box.includes("if (isFreeText(target)) {"));
  check("nor is a field outside the sale form", box.includes("return !field || Boolean(form?.contains(field));"));
  check("nor anything inside an open dialog", box.includes(`'dialog, [role="dialog"], [role="alertdialog"], [aria-modal="true"]'`));
  check("modifier shortcuts (Ctrl, Cmd, Alt) are never scans", box.includes("event.ctrlKey ||") && box.includes("event.metaKey ||") && box.includes("event.altKey ||"));
  check("the hint says when keys cannot reach the scanner", box.includes(`"Paused — click to scan"`) && box.includes("document.hasFocus()"));
}

section("10. One store's catalogue cannot ring up another's barcode");
{
  const storeA = buildSaleScanCatalogue([{ barcode: CAP, id: "a-cap", price: "350.00", stockQuantity: 5, title: "A's Cap" }], "BDT");
  const storeB = buildSaleScanCatalogue([{ barcode: "2077777777770", id: "b-kettle", price: "999.00", stockQuantity: 5, title: "B's Kettle" }], "BDT");

  check("store A's till does not know store B's code", ringUpScan([], storeA, "2077777777770", newLineId).feedback.tone === "error");
  check("…and store B's does not know A's", ringUpScan([], storeB, CAP, newLineId).feedback.tone === "error");

  for (const path of ["apps/web/src/app/dashboard/sales/new/page.tsx", "apps/web/src/app/dashboard/sales/[saleId]/edit/page.tsx"]) {
    const page = read(path);
    check(
      `${path} reads the catalogue for the signed-in store only`,
      page.includes("const store = await requireStore();") &&
        page.includes("getProductsForStore(store.id)") &&
        page.includes("getStoreVariantOptions(store.id)")
    );
  }

  const repository = read("apps/web/src/modules/products/product.repository.ts");
  const list = repository.slice(repository.indexOf("export async function getProductsForStore("));
  check("the product list is scoped by storeId", /where: \{\s*storeId\s*\}/.test(list.slice(0, list.indexOf("include"))));

  const service = read("apps/web/src/modules/sales/sale.service.ts");
  const prepare = service.slice(service.indexOf("async function prepareItems("));
  check(
    "on save, the server re-reads each product within the store, whatever the browser posted",
    /tx\.product\.findFirst\(\{\s*where: \{\s*id: item\.productId,\s*storeId\s*\}/.test(prepare)
  );
  check("…and each option within the store", prepare.includes("getProductVariantForSale(tx, storeId, product.id, item.variantId)"));
}

console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
