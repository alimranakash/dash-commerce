/**
 * Sale receipt check.
 *
 * There is no test runner in this repo, so this is the executable check for the
 * counter's receipts — the half that needs neither a database nor a browser.
 * A receipt is a view of a saved sale, so most of what matters is what it must
 * *not* do: add anything up again, invent a field, print a private one, write
 * anything when it is read, or let one store read another's sale.
 *
 * Covers:
 * - content from the saved sale: its number, its stored totals (never re-added),
 *   the store's own header, and the words "sales receipt", not "invoice";
 * - walk-in sales and sales with a customer, whose number is masked;
 * - line and order discounts, tax and shipping only when recorded, and
 *   variant lines as sold;
 * - paid, partly paid and unpaid sales, from the sale's own figures;
 * - drafts, voids and returns that cannot pass for a paid receipt;
 * - reprinting: deterministic, and nothing on the receipt's path writes;
 * - store isolation and the guard the sale page uses;
 * - print CSS for 58 mm, 80 mm and A4;
 * - the counter flow: a receipt only after the sale is saved, the print
 *   dialog opened once, and New sale starting an empty cart.
 *
 * Run with: npm run verify:sale-receipt
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildSaleReceipt,
  parseReceiptPaper,
  pxToMm,
  RECEIPT_FALLBACK_TIME_ZONE,
  RECEIPT_PRINT_ROOT_CLASS,
  receiptHref,
  receiptPageRule,
  receiptPrintRootStylesheet,
  receiptStylesheet,
  receiptTimeZone,
  type ReceiptSaleRecord
} from "../apps/web/src/modules/sales/sale-receipt";
import { formatSaleMoney } from "../apps/web/src/modules/sales/sale-scan";

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

const money = (value: string) => ({ toString: () => value });
const bdt = (value: number) => formatSaleMoney(value, "BDT");

const store = { currency: "BDT", name: "Worzen Fashion", timezone: "Asia/Dhaka" };
const settings = {
  businessAddress: "House 12, Road 5\n\nDhanmondi, Dhaka",
  contactEmail: "hello@worzen.com",
  contactPhone: "01711000000",
  logoUrl: "/uploads/stores/s1/logo.png",
  supportPhone: null
};

function sale(overrides: Partial<ReceiptSaleRecord> = {}): ReceiptSaleRecord {
  return {
    // 15:42 in Dhaka on the day the cashier picked.
    completedAt: new Date("2026-10-27T09:42:00Z"),
    createdAt: new Date("2026-10-27T09:40:00Z"),
    customer: null,
    discount: money("0.00"),
    dueAmount: money("0.00"),
    items: [{ discount: money("0.00"), id: "i1", productName: "Cap", quantity: 2, total: money("700.00"), unitPrice: money("350.00") }],
    paidAmount: money("700.00"),
    paymentMethod: "CASH",
    paymentStatus: "PAID",
    // Midnight where the server runs, as `parseSaleDate` makes it.
    saleDate: new Date(2026, 9, 27),
    saleNumber: "SALE-000042",
    saleType: "OFFLINE",
    shipping: money("0.00"),
    status: "COMPLETED",
    subtotal: money("700.00"),
    tax: money("0.00"),
    total: money("700.00"),
    ...overrides
  };
}

section("1. The receipt is the saved sale, read back");
{
  const receipt = buildSaleReceipt(sale(), store, settings);

  check("the receipt number is the sale's own number", receipt.receiptNumber === "SALE-000042");
  check("titled a sales receipt", receipt.status.title === "Sales receipt" && receipt.status.notice === null);
  check("the total is the stored total", receipt.totals.total === bdt(700));
  check("the line is as sold", receipt.lines[0]?.name === "Cap" && receipt.lines[0].quantity === 2 && receipt.lines[0].unitPrice === bdt(350) && receipt.lines[0].total === bdt(700));
  check("date and time of the sale, in the store's timezone", /^Oct 27, 2026, 3:42\sPM$/u.test(receipt.issued.date) && receipt.issued.recorded === null, receipt.issued.date);

  const inconsistent = buildSaleReceipt(
    sale({ subtotal: money("1000.00"), total: money("950.00") }),
    store,
    settings
  );
  check(
    "stored totals are printed as stored — never added up again from the lines",
    inconsistent.totals.subtotal === bdt(1000) && inconsistent.totals.total === bdt(950)
  );

  check("the store's name", receipt.store.name === "Worzen Fashion");
  check("its address, line by line, blank lines dropped", JSON.stringify(receipt.store.addressLines) === JSON.stringify(["House 12, Road 5", "Dhanmondi, Dhaka"]));
  check("its phone, email and logo when configured", receipt.store.phone === "01711000000" && receipt.store.email === "hello@worzen.com" && receipt.store.logoUrl === "/uploads/stores/s1/logo.png");
  check("the support line when there is no contact phone", buildSaleReceipt(sale(), store, { supportPhone: "09610000000" }).store.phone === "09610000000");

  const bare = buildSaleReceipt(sale(), store, null);
  check(
    "a store with no settings still prints — just its name",
    bare.store.addressLines.length === 0 && bare.store.phone === null && bare.store.email === null && bare.store.logoUrl === null
  );

  const json = JSON.stringify(receipt);
  check("never called an invoice — only the line saying it is not one", (json.match(/invoice/gi) ?? []).length === 1 && receipt.footer.disclaimer === "This is a sales receipt, not a tax invoice.");
  check("never mentions VAT or a registration number it does not have", !/\bVAT\b|BIN|registration/i.test(json));

  const withNotes = buildSaleReceipt({ ...sale(), notes: "Customer argued about price" } as ReceiptSaleRecord, store, settings);
  check("the sale's internal notes are never printed", !JSON.stringify(withNotes).includes("argued"));
  check("no return policy is invented", !/return policy|exchange within|no refund/i.test(json));
  check("a short thank-you, in English and Bengali", receipt.footer.thanks.length === 2 && receipt.footer.thanks.some((line) => /[ঀ-৿]/.test(line)));

  const later = buildSaleReceipt(sale({ completedAt: new Date("2026-10-28T04:15:00Z"), saleDate: new Date(2026, 9, 20) }), store, settings);
  check(
    "a sale entered later for an earlier day keeps its day, and says when it was recorded",
    later.issued.date === "Oct 20, 2026" && /^Oct 28, 2026, 10:15\sAM$/u.test(later.issued.recorded ?? ""),
    `${later.issued.date} / ${later.issued.recorded}`
  );
  check("an unusable store timezone falls back to Dhaka, not the server's UTC", receiptTimeZone("Not/A_Zone") === RECEIPT_FALLBACK_TIME_ZONE && receiptTimeZone("") === RECEIPT_FALLBACK_TIME_ZONE);
  check("a usable one is kept", receiptTimeZone("Asia/Kolkata") === "Asia/Kolkata");
  check("an online sale says so; a counter sale needs no label", buildSaleReceipt(sale({ saleType: "ONLINE" }), store, settings).saleTypeLabel === "Online sale" && receipt.saleTypeLabel === null);
}

section("2. A walk-in sale");
{
  const receipt = buildSaleReceipt(sale({ customer: null }), store, settings);
  const component = read("apps/web/src/modules/sales/components/sale-receipt.tsx");

  check("no customer on the view", receipt.customer === null);
  check("printed as a walk-in customer", component.includes('customer?.name ?? "Walk-in customer"'));
  check("and no phone row", component.includes("{customer?.phone ? <Row"));
}

section("3. A sale with a customer");
{
  const receipt = buildSaleReceipt(sale({ customer: { name: "Rahim Uddin", phone: "01711220099" } }), store, settings);

  check("the customer's name", receipt.customer?.name === "Rahim Uddin");
  check("their number masked to the last four, as everywhere a phone leaves the dashboard", receipt.customer?.phone === "•••••••0099");
  check("the full number is nowhere on the receipt", !JSON.stringify(receipt).includes("01711220099"));
  check("a blank name still prints", buildSaleReceipt(sale({ customer: { name: "  ", phone: "01711220099" } }), store, settings).customer?.name === "Customer");
}

section("4. Discounts and several product and variant lines");
{
  const receipt = buildSaleReceipt(
    sale({
      discount: money("100.00"),
      items: [
        { discount: money("0.00"), id: "a", productName: "Cap", quantity: 2, total: money("700.00"), unitPrice: money("350.00") },
        { discount: money("50.00"), id: "b", productName: "Shirt - Black / M", quantity: 1, total: money("500.00"), unitPrice: money("550.00") },
        { discount: money("0.00"), id: "c", productName: "শাড়ি - লাল", quantity: 3, total: money("3600.00"), unitPrice: money("1200.00") }
      ],
      shipping: money("60.00"),
      subtotal: money("4800.00"),
      tax: money("24.00"),
      total: money("4784.00")
    }),
    store,
    settings
  );

  check("every line, in the sale's order", receipt.lines.map((line) => line.key).join(",") === "a,b,c");
  check("a variant line carries its option as sold", receipt.lines[1]?.name === "Shirt - Black / M");
  check("a Bengali product name passes through untouched", receipt.lines[2]?.name === "শাড়ি - লাল");
  check("a line discount is shown on its line", receipt.lines[1]?.discount === bdt(50) && receipt.lines[0]?.discount === null);
  check("the line total is the stored, discounted one", receipt.lines[1]?.total === bdt(500));
  check("the order discount", receipt.totals.discount === bdt(100));
  check("tax and shipping, because they were recorded", receipt.totals.tax === bdt(24) && receipt.totals.shipping === bdt(60));
  check("the item count is the quantity, not the lines", receipt.itemCount === 6);

  const plain = buildSaleReceipt(sale(), store, settings);
  check("no discount, tax or shipping rows when none was recorded", plain.totals.discount === null && plain.totals.tax === null && plain.totals.shipping === null);
}

section("5. Paid, partly paid and unpaid");
{
  const paid = buildSaleReceipt(sale({ paymentMethod: "BKASH" }), store, settings);
  check("paid in full: what was paid, no due line", paid.payment.paid === bdt(700) && paid.payment.due === null && paid.payment.status === "Paid in full");
  check("the method as the counter names it", paid.payment.method === "bKash");

  const partial = buildSaleReceipt(
    sale({ dueAmount: money("200.00"), paidAmount: money("500.00"), paymentStatus: "PARTIAL" }),
    store,
    settings
  );
  check("partly paid: the stored paid and due", partial.payment.paid === bdt(500) && partial.payment.due === bdt(200) && partial.payment.status === "Partially paid");

  const unpaid = buildSaleReceipt(
    sale({ dueAmount: money("700.00"), paidAmount: money("0.00"), paymentMethod: "COD", paymentStatus: "UNPAID" }),
    store,
    settings
  );
  check("unpaid: nothing paid, the whole total due", unpaid.payment.paid === bdt(0) && unpaid.payment.due === bdt(700) && unpaid.payment.status === "Unpaid" && unpaid.payment.method === "COD");
}

section("6. Drafts, voids and returns are never a normal receipt");
{
  for (const [status, kind, word] of [
    ["DRAFT", "draft", "Draft"],
    ["CANCELLED", "cancelled", "Void"],
    ["RETURNED", "returned", "Returned"]
  ] as const) {
    const receipt = buildSaleReceipt(sale({ status }), store, settings);

    check(
      `${status}: its own title and a notice saying what it is`,
      receipt.status.kind === kind && receipt.status.title !== "Sales receipt" && (receipt.status.notice ?? "").startsWith(word)
    );
  }

  const component = read("apps/web/src/modules/sales/components/sale-receipt.tsx");
  check(
    "the notice is printed under the title and again in the footer",
    (component.match(/receipt\.status\.notice \?/g) ?? []).length === 2
  );
  const screen = read("apps/web/src/modules/sales/components/sale-receipt-screen.tsx");
  check("the screen shows it as a warning, and the success banner only for a completed sale", screen.includes("!isSale && receipt.status.notice") && screen.includes("completed && isSale"));
}

section("7. Reprinting changes nothing");
{
  const first = JSON.stringify(buildSaleReceipt(sale(), store, settings));
  const second = JSON.stringify(buildSaleReceipt(sale(), store, settings));
  check("the same saved sale always gives the same receipt", first === second);

  const writes = /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(|\$transaction|\$executeRaw|\$queryRaw/;
  const service = read("apps/web/src/modules/sales/sale-receipt.service.ts");
  const page = read("apps/web/src/app/dashboard/sales/[saleId]/receipt/page.tsx");
  const screen = read("apps/web/src/modules/sales/components/sale-receipt-screen.tsx");
  const model = read("apps/web/src/modules/sales/sale-receipt.ts");

  check("the receipt read path writes nothing", !writes.test(service) && !writes.test(page));
  check("it reads only the sale and the store's settings", service.includes("getSaleByIdForStore(") && service.includes("getStoreSettingsRecord(") && !service.includes("sale.service"));
  check("the receipt model never touches the database", !model.includes("@dash/db") && !model.includes("prisma"));
  check(
    "the receipt page calls no action — printing is the browser's, not the server's",
    !page.includes("sale.actions") && !screen.includes("sale.actions") && !screen.includes("fetch(") && !screen.includes("router.refresh")
  );
  check("Print can be pressed again and again: it only opens the dialog", /const print = useCallback\(async \(\) => \{[\s\S]*?window\.print\(\);\s*\}/.test(screen));
}

section("8. Only this store's sales, behind the sale page's own guard");
{
  const page = read("apps/web/src/app/dashboard/sales/[saleId]/receipt/page.tsx");
  const service = read("apps/web/src/modules/sales/sale-receipt.service.ts");
  const repository = read("apps/web/src/modules/sales/sale.repository.ts");
  const byId = repository.slice(repository.indexOf("export async function getSaleByIdForStore("));

  check("the store is the session's", page.includes("const store = await requireStore();"));
  check("an id that is not this store's is a 404", page.includes("getSaleReceiptForStore(store, saleId)") && page.includes("if (!found) notFound();"));
  check("the sale is read by organization and store", service.includes("getSaleByIdForStore(store.organizationId, store.id, saleId)"));
  check("…and the query keeps both", /where: \{\s*id: saleId,\s*organizationId,\s*storeId\s*\}/.test(byId.slice(0, byId.indexOf("include"))));
  check("the header is this store's own settings", service.includes("getStoreSettingsRecord(store.id)"));
  check("what the screen links to is the id the store's own read returned", page.includes("saleId={found.saleId}"));
  check(
    "sales stay ordinary team-member work in the staff permission table",
    read("scripts/verify-staff-permissions.mts").includes('"sales/sale.actions.ts": "member"')
  );
  check("the sale page links to its receipt", read("apps/web/src/app/dashboard/sales/[saleId]/page.tsx").includes("href={receiptHref(sale.id)}"));
  check("so does each row of the sales list", read("apps/web/src/modules/sales/components/sale-list.tsx").includes("href={receiptHref(sale.id)}"));
}

section("9. Print CSS: 58 mm, 80 mm and A4");
{
  check("a 58 mm roll is one page the receipt's height, no margin", receiptPageRule("58mm", 100.2) === "@page { size: 58mm 103mm; margin: 0; }");
  check("an 80 mm roll likewise", receiptPageRule("80mm", 150) === "@page { size: 80mm 152mm; margin: 0; }");
  check("unmeasured, the roll's length is left to the printer, not guessed", receiptPageRule("80mm", null) === "@page { margin: 0; }");
  check("A4 is A4, with no page margin for the browser to print its URL into", receiptPageRule("a4", 500) === "@page { size: A4; margin: 0; }");
  check("CSS millimetres: 96 px is an inch", Math.abs(pxToMm(96) - 25.4) < 1e-9);
  check("an unknown paper falls back to 80 mm", parseReceiptPaper("letter") === "80mm" && parseReceiptPaper("58mm") === "58mm");

  const css = receiptStylesheet();
  check("58 mm: 5 mm sides leave the 48 mm a 58 mm head prints", /\[data-paper="58mm"\] \{[^}]*padding: 3mm 5mm 6mm;[^}]*width: 58mm;/.test(css));
  check("80 mm: 4 mm sides leave the 72 mm an 80 mm head prints", /\[data-paper="80mm"\] \{[^}]*padding: 4mm 4mm 7mm;[^}]*width: 80mm;/.test(css));
  check("A4: a full-width page", /\[data-paper="a4"\] \{[^}]*width: 210mm;/.test(css));
  check("A4 lays an item out as one row of three columns", /\[data-paper="a4"\] \.r-item,[\s\S]*?grid-template-areas: "name calc total";/.test(css));
  check("long names wrap", css.includes("overflow-wrap: anywhere;"));
  check("amounts never wrap and stay right-aligned", /\.r-item-total \{[^}]*text-align: right; white-space: nowrap;/.test(css) && /\.r-row > span:last-child \{[^}]*white-space: nowrap;/.test(css));
  check("figures line up", css.includes("font-variant-numeric: tabular-nums;"));
  check("an item is never split across pages", css.includes("break-inside: avoid;"));
  check("black on white — a thermal head prints nothing else", css.includes("background: #fff;") && css.includes("color: #000;"));
  check("the font stack reaches a Bengali face", css.includes('"Nirmala UI"') && css.includes('"Noto Sans Bengali"'));
  check("the logo is greyed on a roll", /\[data-paper="58mm"\] \.r-logo, [^{]*\[data-paper="80mm"\] \.r-logo \{ filter: grayscale\(1\)/.test(css));

  const printRoot = receiptPrintRootStylesheet();
  check("on screen the print copy does not exist", printRoot.includes(`@media screen {\n  .${RECEIPT_PRINT_ROOT_CLASS} { display: none !important; }`));
  check("in print it is the only thing that does — no dashboard, no blank space", printRoot.includes(`body > *:not(.${RECEIPT_PRINT_ROOT_CLASS}) { display: none !important; }`));

  const screen = read("apps/web/src/modules/sales/components/sale-receipt-screen.tsx");
  check("Ctrl+P is covered too: the page rule is rewritten on beforeprint", screen.includes('window.addEventListener("beforeprint", syncPageRule)'));
  check("the print copy is portalled under <body>", screen.includes("document.body") && screen.includes("createPortal("));
  check("a logo is waited for before the dialog opens", screen.includes("await imagesReady(printRootRef.current);"));
  check("the paper is remembered per device, and storage failing costs nothing", screen.includes("RECEIPT_PAPER_STORAGE_KEY") && (screen.match(/catch \{/g) ?? []).length >= 2);
  check("receipt styles stay out of globals.css, away from the dark-mode generator", !read("apps/web/src/app/globals.css").includes("storeim-receipt"));
}

section("10. The counter flow");
{
  const actions = read("apps/web/src/modules/sales/sale.actions.ts");
  const create = actions.slice(actions.indexOf("export async function createSaleFormAction("), actions.indexOf("export async function updateSaleFormAction("));
  const update = actions.slice(actions.indexOf("export async function updateSaleFormAction("), actions.indexOf("export async function voidSaleAction("));

  check(
    "a completed sale goes to its receipt — and only after createSale has resolved",
    create.indexOf("sale = await createSale(") > 0 && create.indexOf("redirect(receiptHref(") > create.indexOf("sale = await createSale(")
  );
  check("only a completed sale; a draft goes back to the list as before", create.includes('if (sale.status === "COMPLETED") {') && create.includes('redirect("/dashboard/sales?created=1");'));
  check("the success banner, and the print dialog only for Complete & print", create.includes("receiptHref(sale.id, { completed: true, print: wantsPrint(formData) })"));
  check("an edit prints only when asked and only when completed", update.includes('if (status === "COMPLETED" && wantsPrint(formData)) {'));
  check("intent=print is a submitter value, not a field the sale stores", actions.includes('formData.get("intent") === "print"') && !read("apps/web/src/modules/sales/sale.schema.ts").includes("intent"));
  check("receipt links are built in one place", receiptHref("abc") === "/dashboard/sales/abc/receipt" && receiptHref("abc", { completed: true, print: true }) === "/dashboard/sales/abc/receipt?completed=1&print=1");

  const form = read("apps/web/src/modules/sales/components/sale-form.tsx");
  check(
    "Complete & print sits beside Complete sale, only for a completed sale, and locks while saving",
    form.includes('status === "COMPLETED" ? (') && /disabled=\{isPending\} name="intent" type="submit" value="print"/.test(form)
  );

  const screen = read("apps/web/src/modules/sales/components/sale-receipt-screen.tsx");
  const auto = screen.slice(screen.indexOf("if (!autoPrint || !portalReady)"));
  check(
    "the dialog opens once: the flag leaves the address before it prints, so a refresh does not reprint",
    auto.indexOf("autoPrinted.current = true;") > 0 &&
      auto.indexOf('window.history.replaceState(null, "", receiptHref(saleId, { completed }));') < auto.indexOf("void print();")
  );

  check("New sale opens the counter afresh", screen.includes('href="/dashboard/sales/new"'));
  const newPage = read("apps/web/src/app/dashboard/sales/new/page.tsx");
  check("the counter page passes no sale, so the form starts from one empty line", !/\bsale=\{/.test(newPage) && form.includes("sale?.items?.length ? sale.items : [emptyItem()]"));
  for (const path of [
    "apps/web/src/modules/sales/components/sale-form.tsx",
    "apps/web/src/modules/sales/components/sale-scan-box.tsx",
    "apps/web/src/modules/sales/sale-scan.ts"
  ]) {
    check(`${path} keeps no cart in storage to carry into the next sale`, !/localStorage|sessionStorage/.test(read(path)));
  }
  check("after a print, focus moves to New sale for the next customer", screen.includes("newSaleRef.current?.focus();"));
}

console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
