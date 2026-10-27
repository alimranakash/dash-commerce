/**
 * Sale discount check.
 *
 * There is no test runner in this repo, so this is the executable check for the
 * counter's sale-level discount at /dashboard/sales/new, typed either as money
 * or as a percentage of the subtotal — without a database.
 *
 * Covers:
 * - an amount comes off as typed and is capped at the subtotal, as it always was;
 * - a percentage is worked out in whole cents and basis points, rounded half up,
 *   so 12.5% of 333.33 is 41.67 and never a float's 41.66;
 * - the schema refuses more than 100%, keeps an amount over 100 legal, refuses
 *   an unknown type and reads a missing one as an amount;
 * - the service and the form both call the one rule, and only the amount it
 *   came to is stored — there is no discount-type column to drift.
 *
 * Run with: npm run verify:sale-discount
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { saleDiscountCents } from "../apps/web/src/modules/sales/sale-discount";
import { createSaleSchema } from "../apps/web/src/modules/sales/sale.schema";

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

function equals(label: string, actual: number, expected: number) {
  check(label, actual === expected, `got ${actual}, expected ${expected}`);
}

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const baseSale = {
  items: [{ productId: "p1", quantity: 1, unitPrice: "1200.00" }],
  saleDate: "2026-10-27"
};

{
  section("an amount");
  equals("50 taka off 1,200 is 50 taka", saleDiscountCents(120_000, "50", "AMOUNT"), 5_000);
  equals("cents survive: 12.34 is 1,234 cents", saleDiscountCents(120_000, "12.34", "AMOUNT"), 1_234);
  equals("more than the subtotal is capped at it", saleDiscountCents(10_000, "250", "AMOUNT"), 10_000);
  equals("an empty box takes nothing off", saleDiscountCents(120_000, "", "AMOUNT"), 0);
  equals("a negative takes nothing off", saleDiscountCents(120_000, "-20", "AMOUNT"), 0);
  equals("a word takes nothing off", saleDiscountCents(120_000, "ten", "AMOUNT"), 0);
}

{
  section("a percentage");
  equals("10% of 1,200 is 120", saleDiscountCents(120_000, "10", "PERCENT"), 12_000);
  equals("12.5% of 333.33 rounds half up to 41.67", saleDiscountCents(33_333, "12.5", "PERCENT"), 4_167);
  equals("33.33% of 99.99 is 33.33", saleDiscountCents(9_999, "33.33", "PERCENT"), 3_333);
  equals("100% is the whole subtotal", saleDiscountCents(120_000, "100", "PERCENT"), 120_000);
  equals("more than 100% never takes more than the subtotal", saleDiscountCents(120_000, "150", "PERCENT"), 120_000);
  equals("0% takes nothing off", saleDiscountCents(120_000, "0", "PERCENT"), 0);
  equals("an empty box takes nothing off", saleDiscountCents(120_000, "", "PERCENT"), 0);
  equals("a percentage of an empty cart is nothing", saleDiscountCents(0, "10", "PERCENT"), 0);
  equals("0.01% of 1 taka rounds to nothing, not to a cent", saleDiscountCents(100, "0.01", "PERCENT"), 0);
}

{
  section("the schema");
  const percent = createSaleSchema.safeParse({ ...baseSale, discount: "10", discountType: "PERCENT" });
  check("10% parses", percent.success);

  const full = createSaleSchema.safeParse({ ...baseSale, discount: "100", discountType: "PERCENT" });
  check("100% parses", full.success);

  const over = createSaleSchema.safeParse({ ...baseSale, discount: "100.01", discountType: "PERCENT" });
  check(
    "100.01% is refused, on the discount field",
    !over.success && over.error.issues.some((issue) => issue.path[0] === "discount")
  );

  const amount = createSaleSchema.safeParse({ ...baseSale, discount: "500", discountType: "AMOUNT" });
  check("an amount over 100 is still an amount, and legal", amount.success);

  const missing = createSaleSchema.safeParse({ ...baseSale, discount: "50" });
  check(
    "no type reads as an amount — what every form before the switch meant",
    missing.success && missing.data.discountType === "AMOUNT"
  );

  const unknown = createSaleSchema.safeParse({ ...baseSale, discount: "10", discountType: "RATIO" });
  check("an unknown type is refused", !unknown.success);

  const precise = createSaleSchema.safeParse({ ...baseSale, discount: "12.345", discountType: "PERCENT" });
  check("a percentage with three decimals is refused, as money is", !precise.success);
}

{
  section("one rule, one stored figure");
  const service = read("apps/web/src/modules/sales/sale.service.ts");
  check(
    "the service applies the rule to its own subtotal",
    service.includes("saleDiscountCents(subtotalCents, discount, discountType)")
  );
  check(
    "create and update both pass the type through",
    service.split("calculateTotals(items, data.discount, data.discountType,").length === 3
  );

  const form = read("apps/web/src/modules/sales/components/sale-form.tsx");
  check("the form's live total uses the same rule", form.includes("saleDiscountCents(Math.round(subtotal * 100), discount, discountType)"));
  check("the form posts the type beside the value", form.includes('name="discountType" type="hidden" value={discountType}'));

  const schema = read("packages/db/prisma/schema.prisma");
  const saleModel = schema.slice(schema.indexOf("model Sale {"), schema.indexOf("}", schema.indexOf("model Sale {")));
  check("Sale stores the amount alone — no discount type to drift from it", saleModel.includes("discount") && !/discountType/.test(saleModel));
}

console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
