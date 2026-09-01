/**
 * AI Shopping Agent check.
 *
 * There is no test runner in this repo, so this is the executable check for the
 * customer-facing agent — the same shape as `verify-store-copilot.mts`, and
 * deliberately the half of it that needs neither a database nor a session.
 *
 * Five layers are driven.
 *
 * The *registry* checks assert the tool table agrees with itself: every tool has
 * an args schema, a description and a runner, and the three lists cannot drift
 * apart without failing here rather than in a shopper's chat.
 *
 * The *contract* checks run the schemas for real, and they matter more here than
 * anywhere else in the codebase, because this model's output is untrusted input
 * that can reach `createCheckoutOrder`. An order proposal missing a phone
 * number, carrying a two-character address, naming a payment method that does
 * not exist, or smuggling a `storeId` must come back as "no action" rather than
 * as something with a Confirm button on it.
 *
 * The *intent* checks drive the guided classifier and the budget reader across
 * English and Bangla, including Bengali numerals, because that path is what a
 * shop on a plan with no provider key actually gets — a misread budget there is
 * a wrong-looking shelf with no model to blame.
 *
 * The *reuse* checks read the module as text rather than calling it — it pulls
 * in Prisma and `next/headers` through the storefront resolver, which cannot
 * load outside Next, the same reason `verify-staff-permissions.mts` inspects
 * action modules as text. For the commerce boundary it is also the stronger
 * assertion: "the agent never writes an order row of its own" is true of the
 * code or it is not, whereas one call that happens to go through the checkout
 * service proves nothing about the next.
 *
 * The *entitlement* checks tie the agent to the same `ai` plan key the other two
 * StoreIM AI surfaces use, and assert the seller's own switch on top of it.
 *
 * Covers:
 * - the tool list, descriptions, args schemas and runners agreeing;
 * - tool args being parsed rather than trusted: bad limits clamped, unknown
 *   sorts defaulted, unknown tools dropped from a plan;
 * - the row limit staying below the storefront listing's own page size;
 * - the order body being a strict narrowing of `checkoutSchema`, so a proposal
 *   that parses is one `createCheckoutOrder` can already execute;
 * - an order missing contact or address details producing no Confirm button;
 * - an invented action type, and a smuggled tenant selector, producing nothing;
 * - the plan and answer readers surviving malformed model output;
 * - the system prompt naming every tool and telling the model it cannot buy;
 * - observations being truncated before they reach a prompt;
 * - the guided classifier and budget reader on English, Bangla and Bengali
 *   numerals;
 * - reads going through the storefront resolver rather than Prisma;
 * - writes going through the cart and checkout services rather than Prisma, so
 *   stock, coupons, plan limits and the duplicate-submission guard still apply;
 * - the post-order side effects being the shared ones, not a second copy;
 * - no private column being named anywhere in the module;
 * - the `ai` entitlement plus the seller's own storefront switch.
 *
 * Run with: npm run verify:shopping-agent
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isPaidFeature, PLAN_CATALOG } from "../apps/web/src/modules/admin/plan-catalog";
import { PLAN_FEATURE_KEYS } from "../apps/web/src/modules/billing/plan-features";
import { checkoutSchema } from "../apps/web/src/modules/checkout/checkout.schema";
import {
  classifyShoppingAgentMessage,
  readShoppingBudget,
  readShoppingQuery,
  SHOPPING_AGENT_INTENTS
} from "../apps/web/src/modules/shopping-agent/shopping-agent-intent";
import {
  buildShoppingAgentAnswerPrompt,
  buildShoppingAgentSystemPrompt,
  readShoppingAgentAction,
  readShoppingAgentAnswer,
  readShoppingAgentPlan
} from "../apps/web/src/modules/shopping-agent/shopping-agent-prompt";
import {
  SHOPPING_AGENT_ACTION_LABELS,
  SHOPPING_AGENT_ACTION_WEIGHTS,
  SHOPPING_AGENT_ROW_LIMIT,
  SHOPPING_AGENT_TOOL_DESCRIPTIONS,
  SHOPPING_AGENT_TOOLS,
  shoppingAgentActionSchema,
  shoppingAgentAskSchema,
  shoppingAgentOrderBodySchema,
  shoppingAgentToolArgSchemas
} from "../apps/web/src/modules/shopping-agent/shopping-agent.schema";

const MODULE_DIR = join(process.cwd(), "apps", "web", "src", "modules", "shopping-agent");

const source = {
  actions: read("shopping-agent.actions.ts"),
  catalog: read("shopping-agent-catalog.ts"),
  guide: read("shopping-agent-guide.ts"),
  intent: read("shopping-agent-intent.ts"),
  prompt: read("shopping-agent-prompt.ts"),
  schema: read("shopping-agent.schema.ts"),
  service: read("shopping-agent.service.ts"),
  tools: read("shopping-agent-tools.ts")
};

const checkoutRoute = readFileSync(
  join(process.cwd(), "apps", "web", "src", "app", "api", "checkout", "route.ts"),
  "utf8"
);

/** A complete order body, reused as the base for the malformed variants below. */
const VALID_ORDER = {
  addressLine1: "House 12, Road 4, Dhanmondi, Dhaka",
  district: "Dhaka",
  name: "Rahim Uddin",
  paymentMethod: "COD",
  phone: "01712345678",
  shippingRateId: "rate_inside_dhaka"
};

let failures = 0;

function read(file: string) {
  return readFileSync(join(MODULE_DIR, file), "utf8");
}

/**
 * The module with its prose taken out.
 *
 * The checks below that assert a name is *absent* — `costPrice`, `DRAFT` — have
 * to read the code, because the doc comments name both while explaining why
 * neither is in the mapping. Scanning the raw file would fail on its own
 * explanation, which is the worst kind of check: it punishes the comment that
 * makes the guarantee legible.
 *
 * Only block comments and whole-line `//` are stripped, so an inline regex
 * containing a slash survives intact.
 */
function code(text: string) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join("\n");
}

function check(label: string, passed: boolean, detail = "") {
  if (passed) {
    console.log(`  ok   ${label}`);
    return;
  }

  failures += 1;
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
}

console.log("=== Tool registry ===");

check(
  "every tool has an args schema",
  SHOPPING_AGENT_TOOLS.every((tool) => tool in shoppingAgentToolArgSchemas)
);
check(
  "every tool has a description for the prompt",
  SHOPPING_AGENT_TOOLS.every((tool) => Boolean(SHOPPING_AGENT_TOOL_DESCRIPTIONS[tool]))
);
check(
  "no args schema without a tool",
  Object.keys(shoppingAgentToolArgSchemas).every((key) =>
    (SHOPPING_AGENT_TOOLS as readonly string[]).includes(key)
  )
);
check(
  "every tool has a runner",
  SHOPPING_AGENT_TOOLS.every((tool) => source.tools.includes(`${tool}:`))
);

console.log("\n=== Tool arguments are parsed, not trusted ===");

const overLimit = shoppingAgentToolArgSchemas.search_products.safeParse({ limit: 500 });

check("a limit above the ceiling is refused", overLimit.success === false);
check(
  "a missing limit becomes the default",
  shoppingAgentToolArgSchemas.search_products.parse({}).limit > 0
);
check(
  "a sort outside the vocabulary is refused rather than passed through",
  shoppingAgentToolArgSchemas.search_products.safeParse({ sort: "by-vibes" }).success === false
);
check(
  "a negative price is refused",
  shoppingAgentToolArgSchemas.search_products.safeParse({ maxPrice: -5 }).success === false
);
check(
  "a comparison of one product is refused",
  shoppingAgentToolArgSchemas.compare_products.safeParse({ productIds: ["a"] }).success === false
);
check(
  "a comparison wider than the table is refused",
  shoppingAgentToolArgSchemas.compare_products.safeParse({
    productIds: ["a", "b", "c", "d", "e"]
  }).success === false
);
check(
  "product_details without an id is refused",
  shoppingAgentToolArgSchemas.product_details.safeParse({}).success === false
);
check(
  "the row limit stays small enough to read in a chat bubble",
  SHOPPING_AGENT_ROW_LIMIT <= 12,
  String(SHOPPING_AGENT_ROW_LIMIT)
);

console.log("\n=== The plan the model returns ===");

const plan = readShoppingAgentPlan({
  tools: [
    { args: { query: "headphones" }, tool: "search_products" },
    { args: {}, tool: "raid_the_database" },
    { args: { query: "headphones" }, tool: "search_products" }
  ]
});

check("an unknown tool is dropped from the plan", plan.tools.length === 1);
check(
  "a repeated tool is read once",
  plan.tools.filter((entry) => entry.tool === "search_products").length === 1
);
check(
  "two product_details calls with different ids both survive",
  readShoppingAgentPlan({
    tools: [
      { args: { productId: "a" }, tool: "product_details" },
      { args: { productId: "b" }, tool: "product_details" }
    ]
  }).tools.length === 2
);
check(
  "garbage is an empty plan rather than a thrown turn",
  readShoppingAgentPlan({ tools: "nope" }).tools.length === 0
);
check("a malformed answer produces nothing", readShoppingAgentAnswer({ answer: "" }) === null);
check(
  "an answer with product ids survives",
  readShoppingAgentAnswer({ answer: "Here are two options.", productIds: ["a", "b"] })?.productIds
    .length === 2
);

console.log("\n=== Proposals, and what cannot become one ===");

check(
  "every action type has a label for the confirmation card",
  Object.keys(SHOPPING_AGENT_ACTION_LABELS).length === shoppingAgentActionSchema.options.length
);
check(
  "every action type has a weight, so the order button is styled apart",
  Object.keys(SHOPPING_AGENT_ACTION_WEIGHTS).length === shoppingAgentActionSchema.options.length
);
check(
  "placing an order is the only high-weight action",
  Object.entries(SHOPPING_AGENT_ACTION_WEIGHTS)
    .filter(([, weight]) => weight === "high")
    .map(([type]) => type)
    .join(",") === "place_order"
);
check(
  "a well-formed add-to-cart parses",
  readShoppingAgentAction({ productId: "prod_1", quantity: 2, type: "add_to_cart" })?.type ===
    "add_to_cart"
);
check(
  "an invented action type produces nothing",
  readShoppingAgentAction({ productId: "prod_1", type: "apply_discount" }) === null
);
check(
  "a zero quantity produces nothing",
  readShoppingAgentAction({ productId: "prod_1", quantity: 0, type: "add_to_cart" }) === null
);
check(
  "a well-formed order proposal parses",
  readShoppingAgentAction({ body: VALID_ORDER, type: "place_order" })?.type === "place_order"
);
check(
  "an order with no phone number produces nothing",
  readShoppingAgentAction({
    body: { ...VALID_ORDER, phone: undefined },
    type: "place_order"
  }) === null
);
check(
  "an order with a half-typed address produces nothing",
  readShoppingAgentAction({
    body: { ...VALID_ORDER, addressLine1: "Dhaka" },
    type: "place_order"
  }) === null
);
check(
  "an order with no shipping rate produces nothing",
  readShoppingAgentAction({
    body: { ...VALID_ORDER, shippingRateId: "" },
    type: "place_order"
  }) === null
);
check(
  "a payment method the platform does not have produces nothing",
  readShoppingAgentAction({
    body: { ...VALID_ORDER, paymentMethod: "CRYPTO" },
    type: "place_order"
  }) === null
);
check(
  "a phone number that is not one produces nothing",
  readShoppingAgentAction({
    body: { ...VALID_ORDER, phone: "call me" },
    type: "place_order"
  }) === null
);

// The model must not be able to name a price, a total or a discount. Those come
// off the shop's own rows inside the checkout transaction; a body carrying them
// would be a price the conversation chose.
const smuggled = readShoppingAgentAction({
  body: { ...VALID_ORDER, discountAmount: "9999", storeId: "someone-else", totalAmount: "1" },
  type: "place_order"
});

check("a smuggled tenant selector is stripped from an order body", !hasKey(smuggled, "storeId"));
check("a smuggled total is stripped from an order body", !hasKey(smuggled, "totalAmount"));
check("a smuggled discount is stripped from an order body", !hasKey(smuggled, "discountAmount"));

console.log("\n=== The order body is a narrowing of the checkout form ===");

const checkoutKeys = Object.keys(checkoutSchema.shape).sort();
const agentKeys = Object.keys(shoppingAgentOrderBodySchema.shape).sort();
const dropped = checkoutKeys.filter((key) => !agentKeys.includes(key)).sort();

check(
  "the agent adds no field the checkout form does not have",
  agentKeys.every((key) => checkoutKeys.includes(key)),
  agentKeys.filter((key) => !checkoutKeys.includes(key)).join(", ")
);
check(
  "and drops exactly the four a shopper cannot type into a chat",
  dropped.join(",") === "orderBumpProductId,paymentNote,submissionId,verificationCode",
  dropped.join(", ")
);

console.log("\n=== What the shopper says ===");

check(
  "an empty message is refused",
  shoppingAgentAskSchema.safeParse({ message: "  " }).success === false
);
check(
  "a message longer than the limit is refused",
  shoppingAgentAskSchema.safeParse({ message: "x".repeat(601) }).success === false
);
check(
  "the history is bounded",
  shoppingAgentAskSchema.safeParse({
    history: Array.from({ length: 30 }, () => ({ content: "hi", role: "user" })),
    message: "show me headphones"
  }).success === false
);

console.log("\n=== The prompt ===");

const system = buildShoppingAgentSystemPrompt({ currency: "BDT", storeName: "Worzen" });

check(
  "the system prompt names every tool",
  SHOPPING_AGENT_TOOLS.every((tool) => system.includes(tool)),
  SHOPPING_AGENT_TOOLS.filter((tool) => !system.includes(tool)).join(", ")
);
check(
  "the system prompt carries the shop's name and currency",
  system.includes("Worzen") && system.includes("BDT")
);
check(
  "the model is told it cannot buy anything itself",
  system.includes("You cannot buy anything yourself")
);
check("the model is told never to invent a product", system.includes("Never invent a product"));
check("the model is told never to guess a variant", system.includes("Never guess a variant"));
check(
  "the model is told to answer in the shopper's language",
  system.includes("language the customer wrote in")
);
check(
  "the model is told not to fill an order field the customer did not give",
  system.includes("Never fill an order field")
);

const bigRows = Array.from({ length: 400 }, (_, index) => ({
  id: `prod-${index}`,
  title: "A reasonably long product title to pad the payload out"
}));

check(
  "an oversized observation is truncated before it reaches the model",
  buildShoppingAgentAnswerPrompt({
    cartSummary: "empty",
    history: [],
    observations: [{ args: {}, result: bigRows, tool: "search_products" }],
    question: "what do you have?"
  }).includes("truncated")
);
check(
  "a failed tool is reported to the model rather than hidden",
  buildShoppingAgentAnswerPrompt({
    cartSummary: "empty",
    history: [],
    observations: [
      { args: {}, error: "search_products could not be read.", tool: "search_products" }
    ],
    question: "what do you have?"
  }).includes("FAILED")
);
check(
  "the cart is in front of the model on every turn",
  buildShoppingAgentAnswerPrompt({
    cartSummary: "2x Silk saree (lineId abc) — subtotal 4200.00 BDT before delivery",
    history: [],
    observations: [],
    question: "how much is delivery?"
  }).includes("lineId abc")
);

console.log("\n=== The guided assistant ===");

const INTENT_CASES: Array<[string, (typeof SHOPPING_AGENT_INTENTS)[number]]> = [
  ["What is in my cart?", "cart"],
  ["আমার কার্টে কী আছে?", "cart"],
  ["how much is the delivery charge", "checkout"],
  ["আমি অর্ডার করতে চাই", "checkout"],
  ["what categories do you have", "categories"],
  ["তোমাদের ক্যাটাগরি কী কী?", "categories"],
  ["compare these two headphones", "compare"],
  ["কোনটা ভালো?", "compare"],
  ["show me your cheapest sarees", "cheapest"],
  ["কম দামে শাড়ি দেখাও", "cheapest"],
  ["I need a red cotton shirt", "browse"],
  ["hello", "browse"]
];

for (const [message, expected] of INTENT_CASES) {
  const actual = classifyShoppingAgentMessage(message);

  check(
    `"${message}" → ${expected}`,
    actual === expected,
    actual === expected ? "" : `got ${actual}`
  );
}

const BUDGET_CASES: Array<[string, { maxPrice?: number; minPrice?: number }]> = [
  ["headphones under 3000", { maxPrice: 3000 }],
  ["something below 1500 taka", { maxPrice: 1500 }],
  ["a saree between 2000 and 5000", { maxPrice: 5000, minPrice: 2000 }],
  ["shirts 1000-2500", { maxPrice: 2500, minPrice: 1000 }],
  ["anything over 10000", { minPrice: 10000 }],
  ["৩০০০ টাকার নিচে হেডফোন", { maxPrice: 3000 }],
  ["শাড়ি ২০০০ থেকে ৫০০০", { maxPrice: 5000, minPrice: 2000 }],
  ["a saree for 4500 taka", { maxPrice: 4500 }],
  ["show me a red shirt", {}]
];

for (const [message, expected] of BUDGET_CASES) {
  const actual = readShoppingBudget(message);

  check(
    `budget "${message}" → ${JSON.stringify(expected)}`,
    JSON.stringify(actual) === JSON.stringify(expected),
    JSON.stringify(actual)
  );
}

check(
  "the scaffolding words are stripped before the search index sees the query",
  readShoppingQuery("show me some cheap wireless headphones under 3000 taka") ===
    "wireless headphones",
  readShoppingQuery("show me some cheap wireless headphones under 3000 taka")
);
check(
  "a message that was all scaffolding leaves no query at all",
  readShoppingQuery("show me something cheap please") === ""
);

console.log("\n=== Reuse: no second commerce system ===");

check(
  "no module in the feature imports Prisma directly",
  Object.values(source).every((text) => !text.includes('from "@dash/db"'))
);
check(
  "no module in the feature calls Prisma",
  Object.values(source).every((text) => !/\bprisma\./.test(text))
);
check(
  "the catalogue reads through the storefront resolver",
  source.catalog.includes('from "../storefront/resolver"')
);
check(
  "adding to the cart goes through the cart service",
  source.service.includes('from "../cart/cart.service"') &&
    source.service.includes("addToCart") &&
    source.service.includes("removeCartItem")
);
check(
  "the order goes through the same checkout service the form posts to",
  source.service.includes("createCheckoutOrder") &&
    source.service.includes('from "../checkout/checkout.service"')
);
check(
  "the agent writes no order, order item, customer or address row of its own",
  !/(order|orderItem|customer|address)\.(create|update|upsert|delete)/i.test(source.service)
);
check(
  "the post-order side effects are the shared ones, not a second copy",
  source.service.includes("completeCheckoutOrder") &&
    checkoutRoute.includes("completeCheckoutOrder") &&
    !source.service.includes("sendOrderConfirmationSms")
);
check(
  "a replayed submission does not re-send the confirmation or re-report the sale",
  source.service.includes("if (!replayed)")
);
check(
  "one submission id is minted per confirmed press, so a double tap buys once",
  source.service.includes("submissionId: randomUUID()")
);
check(
  "a shop that verifies phone numbers is handed to the checkout page rather than bypassed",
  source.service.includes("isCheckoutPhoneOtpRequired")
);
check(
  "the merchant's own provider key is resolved by the one function that decrypts it",
  source.service.includes("resolveAiProvider") && !source.service.includes("decryptSecret")
);
check(
  "nothing in the feature depends on StoreOS",
  Object.values(source).every((text) => !/storeos/i.test(text))
);

console.log("\n=== Tenancy on a surface with no session ===");

check(
  "both shopper-facing actions resolve the store from the storefront slug",
  (source.actions.match(/resolveAgentStore\(/g) ?? []).length >= 3
);
check(
  "the store is resolved by the public storefront resolver, which only matches a live shop",
  source.actions.includes("getStorefrontBySlug")
);
check(
  "no shopper-facing action accepts a store id from the browser",
  !/storeId:\s*(input|formData|params)/.test(source.actions)
);
check(
  "the seller's switch is guarded as a manager action",
  source.actions.includes("requireStoreManager()")
);
check(
  "the confirmed proposal is re-parsed on the server before it runs",
  source.actions.includes("shoppingAgentActionSchema.safeParse(input.action)")
);
check(
  "both gates are re-checked before a confirmed change runs",
  source.actions.includes("getShoppingAgentCapability(store.id)") &&
    source.actions.includes("!capability.enabled || !capability.entitled")
);
check(
  "the agent is throttled per shopper and per shop",
  source.service.includes("shopping-agent:ip:") && source.service.includes("shopping-agent:store:")
);

console.log("\n=== Nothing private reaches a shopper ===");

for (const column of [
  "costPrice",
  "riskScore",
  "riskFactors",
  "lowStockThreshold",
  "customerPhone",
  "customerEmail"
]) {
  check(
    `${column} is never named in what the agent reads or renders`,
    [source.catalog, source.guide, source.prompt, source.tools].every(
      (text) => !code(text).includes(column)
    )
  );
}

check(
  "the catalogue only ever surfaces products the storefront already shows",
  code(source.catalog).includes("getStorefrontProducts") &&
    !code(source.catalog).includes("DRAFT") &&
    !code(source.catalog).includes("HIDDEN")
);

console.log("\n=== StoreIM AI is a paid entitlement, and the seller opts in ===");

check(
  "`ai_shopping_agent` is a registered feature key",
  PLAN_FEATURE_KEYS.includes("ai_shopping_agent")
);
check(
  "`ai_shopping_agent` is paid — the Free tier does not grant it",
  isPaidFeature("ai_shopping_agent")
);
check(
  "the agent is gated on its own key, not on the copilot's",
  source.service.includes('hasPlanFeature(storeId, "ai_shopping_agent")')
);
check(
  // The rule the plan sells on: a key the merchant owns picks the engine that
  // writes the replies, it is not a second way to qualify for the surface.
  "an own provider key does not stand in for the plan",
  source.service.includes("entitled,") && !source.service.includes("Boolean(provider) ||")
);
check(
  "and the seller's own switch is required on top of the entitlement",
  source.service.includes("isShoppingAgentEnabled") &&
    source.service.includes("!capability.enabled || !capability.entitled")
);
check(
  "the switch defaults off, so a plan alone never publishes an assistant",
  readFileSync(join(process.cwd(), "packages", "db", "prisma", "schema.prisma"), "utf8").includes(
    "shoppingAgentEnabled Boolean @default(false)"
  )
);
check(
  // The hole this section was written after: the save action reflected the plan
  // in its message and stored the `true` anyway, so an unentitled store kept a
  // switch that would go live the moment it was entitled again.
  "switching the agent ON is refused by the plan, in the action that writes it",
  source.actions.includes('requirePlanFeature(store.id, "ai_shopping_agent")') &&
    source.actions.includes("if (enabled) {")
);
check(
  "and the refusal comes back as a key the page can open the upgrade dialog with",
  source.actions.includes("lockedFeature: error.featureKey")
);
check(
  // Symmetrical to the coupon, bundle and blocklist gates: a lapsed store has to
  // be able to take a public assistant off its own storefront.
  "switching it OFF is never gated",
  !source.actions.includes("requirePlanFeature(store.id, \"ai_shopping_agent\");\n    const view")
);

const aiPlans = PLAN_CATALOG.filter((plan) => plan.features.includes("ai_shopping_agent"))
  .map((plan) => plan.slug)
  .sort();

check(
  "the `ai_shopping_agent` key is granted from Growth up",
  aiPlans.join(",") === "growth,pro",
  aiPlans.join(", ")
);

console.log(
  failures === 0
    ? "\nAI Shopping Agent: all checks passed."
    : `\nAI Shopping Agent: ${failures} check${failures === 1 ? "" : "s"} failed.`
);

process.exit(failures === 0 ? 0 : 1);

function hasKey(value: unknown, key: string) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const body = (value as { body?: unknown }).body;

  return Boolean(body && typeof body === "object" && key in body);
}
