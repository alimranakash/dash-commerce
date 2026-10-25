/**
 * Variant picker check.
 *
 * There is no test runner in this repo, so this is the executable check for the
 * option picker the product page and Quick View share — pure functions only, no
 * database and no browser.
 *
 * The feature is one sentence: **a shopper picks a colour and a size, and the
 * buy box gets exactly the variant they meant.** The ways that goes wrong are
 * all quiet ones, so each is driven here:
 *
 * - the rows coming out in the wrong order, because `jsonb` sorts option keys
 *   shortest-first and "Size" would lead "Color";
 * - two variants sharing one combination (the editor's Duplicate makes exactly
 *   that) being grouped anyway, so one of them can no longer be picked;
 * - a click silently throwing away the shopper's other choice, or landing on a
 *   sold-out variant when a buyable one keeps everything they picked;
 * - the page opening on a sold-out option with a buy box greyed out on arrival;
 * - a colour dot guessed from a name it does not know;
 * - a size borrowing a picture from another colour.
 *
 * Run with: npm run verify:variant-picker
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  initialPickerVariant,
  isVariantPurchasable,
  optionSwatchColour,
  optionValueState,
  pickerVariantImage,
  variantForOptionValue,
  variantOptionGroups,
  type PickerVariant
} from "../apps/web/src/modules/storefront/variant-options";

const WEB_DIR = join(process.cwd(), "apps", "web", "src");

let failures = 0;

function check(label: string, passed: boolean, detail = "") {
  if (passed) {
    console.log(`  ok   ${label}`);
    return;
  }

  failures += 1;
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
}

function variant(
  title: string,
  options: Record<string, string>,
  extra: Partial<PickerVariant> = {}
): PickerVariant {
  return {
    continueSelling: false,
    imageUrl: null,
    optionSignature: title.toLowerCase(),
    options,
    stockQuantity: 5,
    title,
    ...extra
  };
}

// Keys in `jsonb` order — shortest first — as the database hands them back.
const BLACK_M = variant("Black / M", { Size: "M", Color: "Black" }, { imageUrl: "/black.jpg" });
const BLACK_L = variant("Black / L", { Size: "L", Color: "Black" }, { stockQuantity: 0 });
const RED_M = variant("Red / M", { Size: "M", Color: "Red" }, { imageUrl: "/red.jpg" });
const RED_L = variant("Red / L", { Size: "L", Color: "Red" });
const SHIRTS = [BLACK_M, BLACK_L, RED_M, RED_L];

console.log("=== Rows, in the seller's order ===");

const groups = variantOptionGroups(SHIRTS);

check(
  "one row per attribute, ordered by the title rather than by jsonb's key order",
  groups?.map((group) => group.name).join(",") === "Color,Size",
  groups?.map((group) => group.name).join(",")
);
check(
  "values in the order the variants list them",
  groups?.[0]?.values.join(",") === "Black,Red" && groups?.[1]?.values.join(",") === "M,L"
);
check(
  "a single attribute is still a row of its own",
  variantOptionGroups([variant("S", { Size: "S" }), variant("M", { Size: "M" })])?.length === 1
);
check(
  "two variants in one combination fall back to the flat list, so both stay pickable",
  variantOptionGroups([
    BLACK_M,
    { ...BLACK_M, optionSignature: "black / m__copy_1", title: "Black / M Copy" }
  ]) === null
);
check(
  "a variant with no options falls back to the flat list",
  variantOptionGroups([variant("Default", {}), variant("Large", {})]) === null
);
check(
  "variants naming different attributes fall back to the flat list",
  variantOptionGroups([variant("Black", { Color: "Black" }), variant("M", { Size: "M" })]) === null
);
check("no variants, no rows", variantOptionGroups([]) === null);

console.log("\n=== What a click selects ===");

check(
  "tapping a colour keeps the size the shopper picked",
  variantForOptionValue(SHIRTS, groups ?? [], BLACK_M, "Color", "Red") === RED_M
);
check(
  "it keeps the size even when that one is sold out — the shopper asked about that size",
  variantForOptionValue(SHIRTS, groups ?? [], RED_L, "Color", "Black") === BLACK_L
);
check(
  "when no variant keeps the other choice, a buyable one is preferred",
  variantForOptionValue(
    [BLACK_M, variant("Red / L", { Size: "L", Color: "Red" }, { stockQuantity: 0 }), RED_M],
    [
      { name: "Color", values: ["Black", "Red"] },
      { name: "Size", values: ["M", "L"] }
    ],
    variant("Black / XL", { Size: "XL", Color: "Black" }),
    "Color",
    "Red"
  ) === RED_M
);

console.log("\n=== How a value reads ===");

check(
  "a value that pairs with the other choice and has stock is available",
  optionValueState(SHIRTS, groups ?? [], BLACK_M, "Size", "M") === "available"
);
check(
  "a value whose pairing has no stock is sold out",
  optionValueState(SHIRTS, groups ?? [], BLACK_M, "Size", "L") === "sold-out"
);
check(
  "a value never made with the other choice is unavailable",
  optionValueState(
    [BLACK_M, RED_L],
    [
      { name: "Color", values: ["Black", "Red"] },
      { name: "Size", values: ["M", "L"] }
    ],
    BLACK_M,
    "Size",
    "L"
  ) === "unavailable"
);
check(
  "sold out is the stepper's rule: no stock and not set to keep selling",
  !isVariantPurchasable({ continueSelling: false, stockQuantity: 0 }) &&
    isVariantPurchasable({ continueSelling: true, stockQuantity: 0 }) &&
    !isVariantPurchasable({ continueSelling: false, stockQuantity: -2 })
);

console.log("\n=== Where the page opens ===");

check(
  "on the first option a shopper can buy, not on a sold-out one",
  initialPickerVariant([BLACK_L, RED_M]) === RED_M
);
check(
  "on the first option when none can be bought, rather than on nothing",
  initialPickerVariant([BLACK_L]) === BLACK_L
);

console.log("\n=== Swatches and pictures ===");

check("a known colour name gets its dot", optionSwatchColour("Color", "Navy Blue") === "#1f2a5a");
check("a Bangla colour name gets its dot", optionSwatchColour("রং", "লাল") === "#d32f2f");
check("a hex value is its own dot", optionSwatchColour("Colour", "#A1B2C3") === "#a1b2c3");
check(
  "an unknown name gets no dot rather than a guess",
  optionSwatchColour("Color", "Sunset") === null
);
check("only a colour attribute gets dots", optionSwatchColour("Size", "Black") === null);
check("a variant's own picture wins", pickerVariantImage(SHIRTS, groups, RED_M) === "/red.jpg");
check(
  "a size with no picture borrows its colour's",
  pickerVariantImage(SHIRTS, groups, RED_L) === "/red.jpg"
);
check(
  "a picture is never borrowed across colours",
  pickerVariantImage(
    [BLACK_M, variant("Blue / M", { Size: "M", Color: "Blue" })],
    variantOptionGroups([BLACK_M, variant("Blue / M", { Size: "M", Color: "Blue" })]),
    variant("Blue / M", { Size: "M", Color: "Blue" })
  ) === ""
);

console.log("\n=== One picker, two surfaces ===");

const productPage = readFileSync(
  join(
    WEB_DIR,
    "modules",
    "storefront",
    "templates",
    "general-default",
    "product-variant-controls.tsx"
  ),
  "utf8"
);
const quickView = readFileSync(
  join(WEB_DIR, "modules", "quick-view", "components", "quick-view-modal.tsx"),
  "utf8"
);

check(
  "the product page and Quick View render the same picker",
  productPage.includes("<VariantOptionPicker") && quickView.includes("<VariantOptionPicker")
);
check(
  "both open on the same option",
  productPage.includes("initialPickerVariant(") && quickView.includes("initialPickerVariant(")
);

console.log("");

if (failures > 0) {
  console.log(`${failures} check(s) failed.`);
  process.exit(1);
}

console.log("All checks passed.");
