/**
 * AI Store Copilot check.
 *
 * There is no test runner in this repo, so this is the executable check for the
 * chat agent — the same shape as `verify-product-content.mts`, and deliberately
 * the half of it that needs neither a database nor a session.
 *
 * Four layers are driven.
 *
 * The *registry* checks assert the tool table agrees with itself: every tool has
 * an args schema, a description and a runner, and the three lists cannot drift
 * apart without failing here rather than in a merchant's chat.
 *
 * The *contract* checks run the schemas for real. They matter more than usual
 * because the model's output is untrusted input: a tool that does not exist, a
 * discount type that was never in the vocabulary, an action that names no field
 * to change. Every one of those must come back as "no action" rather than as
 * something with a Confirm button on it.
 *
 * The *intent* checks drive the offline classifier across English and Bangla,
 * because that path is what a store with no provider key actually gets, and a
 * misrouted question there is a wrong-looking answer with no model to blame.
 *
 * The *source* checks read the action and service modules as text rather than
 * calling them — they pull in NextAuth through `requireStore`, which cannot load
 * outside Next, the same reason `verify-staff-permissions.mts` inspects action
 * modules as text. For tenancy it is also the stronger assertion: "the action
 * never takes a store selector from the caller" is true of the code or it is
 * not, whereas one call that happens to pass no `storeId` proves nothing about
 * the next.
 *
 * Covers:
 * - the tool list, descriptions, args schemas and runners agreeing;
 * - tool args being parsed rather than trusted: bad limits clamped, unknown
 *   filters defaulted, unknown tools dropped from a plan;
 * - the row limit staying below the AI API's own page ceiling;
 * - an action proposal parsing only into something the AI action services can
 *   already execute, and an invented action type producing nothing;
 * - a product update with no fields being refused, so no empty Confirm appears;
 * - the plan and answer readers surviving malformed model output;
 * - the system prompt naming every tool and telling the model it cannot execute;
 * - observations being truncated before they reach a prompt;
 * - the offline classifier routing English and Bangla questions correctly;
 * - the actions guarding with `requireStore()` and taking no store, tenant or
 *   organization selector from the caller;
 * - writes going through `ai-actions.service.ts` rather than a repository, so
 *   the dashboard's own invariants and audit log still apply;
 * - reads going through `modules/ai/*.service.ts` rather than Prisma;
 * - no StoreOS dependency anywhere in the module;
 * - no redacted column being named anywhere in the module.
 *
 * Run with: npm run verify:store-copilot
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildStoreCopilotAnswerPrompt,
  buildStoreCopilotSystemPrompt,
  readStoreCopilotAction,
  readStoreCopilotAnswer,
  readStoreCopilotPlan
} from "../apps/web/src/modules/store-copilot/store-copilot-prompt";
import {
  classifyStoreCopilotQuestion,
  STORE_COPILOT_INTENTS
} from "../apps/web/src/modules/store-copilot/store-copilot-intent";
import {
  STORE_COPILOT_ACTION_LABELS,
  STORE_COPILOT_ROW_LIMIT,
  STORE_COPILOT_TOOL_DESCRIPTIONS,
  STORE_COPILOT_TOOLS,
  storeCopilotActionSchema,
  storeCopilotAskSchema,
  storeCopilotToolArgSchemas
} from "../apps/web/src/modules/store-copilot/store-copilot.schema";
import { AI_PAGE_LIMIT_MAX } from "../apps/web/src/modules/ai/ai.schema";
import { isPaidFeature, PLAN_CATALOG } from "../apps/web/src/modules/admin/plan-catalog";
import { PLAN_FEATURE_KEYS } from "../apps/web/src/modules/billing/plan-features";

const MODULE_DIR = join(process.cwd(), "apps", "web", "src", "modules", "store-copilot");

const source = {
  actions: read("store-copilot.actions.ts"),
  briefing: read("store-copilot-briefing.ts"),
  prompt: read("store-copilot-prompt.ts"),
  schema: read("store-copilot.schema.ts"),
  service: read("store-copilot.service.ts"),
  tools: read("store-copilot-tools.ts")
};

let failures = 0;

function read(file: string) {
  return readFileSync(join(MODULE_DIR, file), "utf8");
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
  STORE_COPILOT_TOOLS.every((tool) => tool in storeCopilotToolArgSchemas)
);
check(
  "every tool has a description for the prompt",
  STORE_COPILOT_TOOLS.every((tool) => Boolean(STORE_COPILOT_TOOL_DESCRIPTIONS[tool]))
);
check(
  "no args schema without a tool",
  Object.keys(storeCopilotToolArgSchemas).every((key) =>
    (STORE_COPILOT_TOOLS as readonly string[]).includes(key)
  )
);
check(
  "the runner table names exactly the tools",
  STORE_COPILOT_TOOLS.every((tool) => source.tools.includes(`${tool}:`)),
  STORE_COPILOT_TOOLS.filter((tool) => !source.tools.includes(`${tool}:`)).join(", ")
);
check(
  `the chat row limit (${STORE_COPILOT_ROW_LIMIT}) stays under the API page ceiling (${AI_PAGE_LIMIT_MAX})`,
  STORE_COPILOT_ROW_LIMIT < AI_PAGE_LIMIT_MAX
);

console.log("\n=== Tool arguments are parsed, not trusted ===");

check(
  "a limit above the ceiling does not parse",
  storeCopilotToolArgSchemas.list_orders.safeParse({ limit: 500 }).success === false
);
check(
  "an unknown order status does not parse",
  storeCopilotToolArgSchemas.list_orders.safeParse({ status: "SHIPPED_MAYBE" }).success === false
);
check(
  "an empty args object gets the defaults",
  storeCopilotToolArgSchemas.list_inventory.parse({}).filter === "low" &&
    storeCopilotToolArgSchemas.list_inventory.parse({}).limit === 10
);
check(
  "a report key outside the catalogue does not parse",
  storeCopilotToolArgSchemas.sales_report.safeParse({ key: "profit_margins" }).success === false
);
check(
  "store_overview takes no arguments at all",
  Object.keys(storeCopilotToolArgSchemas.store_overview.parse({ storeId: "other" })).length === 0
);

console.log("\n=== The plan the model returns ===");

const plan = readStoreCopilotPlan({
  tools: [
    { args: {}, tool: "store_overview" },
    { args: {}, tool: "drop_database" },
    { args: { limit: 5 }, tool: "list_orders" },
    { args: {}, tool: "store_overview" }
  ]
});

check(
  "an invented tool is dropped from the plan",
  plan.tools.every((entry) => String(entry.tool) !== "drop_database")
);
check("the real tools survive", plan.tools.length === 2);
check(
  "a tool asked for twice is read once",
  plan.tools.filter((entry) => entry.tool === "store_overview").length === 1
);
check(
  "a plan that is not a plan reads as empty",
  readStoreCopilotPlan({ tools: "everything" }).tools.length === 0
);
check(
  "a plan may carry a plain reply instead of tools",
  readStoreCopilotPlan({ reply: "Hello!" }).reply === "Hello!"
);

console.log("\n=== The answer the model returns ===");

check("an empty answer is refused", readStoreCopilotAnswer({ answer: "   " }) === null);
check(
  "an answer with follow-ups is read",
  readStoreCopilotAnswer({ answer: "You sold BDT 4,200 today.", followUps: ["And yesterday?"] })
    ?.followUps.length === 1
);
check("a missing answer is refused", readStoreCopilotAnswer({ followUps: ["x"] }) === null);

console.log("\n=== Proposals only become actions if they are executable ===");

const coupon = readStoreCopilotAction({
  body: {
    code: "EID10",
    discountType: "PERCENTAGE",
    discountValue: "10",
    expiresAt: "2026-09-30",
    name: "Eid discount",
    usageLimitTotal: 100
  },
  type: "create_coupon"
});

check("a well-formed coupon proposal parses", coupon?.type === "create_coupon");
check(
  "every action type has a label for the confirmation card",
  Object.keys(STORE_COPILOT_ACTION_LABELS).length === storeCopilotActionSchema.options.length
);
check(
  "an invented action type produces nothing",
  readStoreCopilotAction({ productId: "abc", type: "delete_product" }) === null
);
check(
  "a discount type outside the vocabulary produces nothing",
  readStoreCopilotAction({
    body: { code: "X10", discountType: "BUY_ONE_GET_ONE", discountValue: "10", name: "X" },
    type: "create_coupon"
  }) === null
);
check(
  "a coupon with no name produces nothing",
  readStoreCopilotAction({
    body: { code: "X10", discountType: "PERCENTAGE", discountValue: "10" },
    type: "create_coupon"
  }) === null
);
check(
  "a product update naming no field produces nothing",
  readStoreCopilotAction({ body: {}, productId: "abc", type: "update_product" }) === null
);
check(
  "an order status the API will not set produces nothing",
  readStoreCopilotAction({ orderId: "abc", status: "REFUNDED", type: "update_order_status" }) ===
    null
);
check(
  "a tenant selector smuggled into a coupon body produces nothing",
  readStoreCopilotAction({
    body: {
      code: "X10",
      discountType: "PERCENTAGE",
      discountValue: "10",
      name: "X",
      storeId: "someone-else"
    },
    type: "create_coupon"
  }) === null
);

console.log("\n=== The question the merchant asks ===");

check(
  "an empty question is refused",
  storeCopilotAskSchema.safeParse({ message: "  " }).success === false
);
check(
  "a question longer than the limit is refused",
  storeCopilotAskSchema.safeParse({ message: "x".repeat(1001) }).success === false
);
check(
  "the history is bounded",
  storeCopilotAskSchema.safeParse({
    history: Array.from({ length: 20 }, () => ({ content: "hi", role: "user" })),
    message: "how are sales?"
  }).success === false
);

console.log("\n=== The prompt ===");

const system = buildStoreCopilotSystemPrompt({
  currency: "BDT",
  storeName: "Worzen",
  timezone: "Asia/Dhaka",
  today: "2026-08-31"
});

check(
  "the system prompt names every tool",
  STORE_COPILOT_TOOLS.every((tool) => system.includes(tool)),
  STORE_COPILOT_TOOLS.filter((tool) => !system.includes(tool)).join(", ")
);
check(
  "the system prompt carries the store's currency and date",
  system.includes("BDT") && system.includes("2026-08-31")
);
check(
  "the model is told it cannot execute anything itself",
  system.includes("You cannot change anything yourself")
);
check(
  "the model is told never to invent a figure",
  system.toLowerCase().includes("never estimate")
);
check(
  "the model is told to answer in the merchant's language",
  system.includes("same language the merchant wrote in")
);

const bigRows = Array.from({ length: 400 }, (_, index) => ({
  id: `order-${index}`,
  title: "A reasonably long product title to pad the payload out"
}));
const answerPrompt = buildStoreCopilotAnswerPrompt({
  history: [],
  observations: [{ args: {}, result: bigRows, tool: "list_orders" }],
  question: "how many orders?"
});

check(
  "an oversized observation is truncated before it reaches the model",
  answerPrompt.includes("truncated")
);
check(
  "a failed tool is reported to the model rather than hidden",
  buildStoreCopilotAnswerPrompt({
    history: [],
    observations: [{ args: {}, error: "list_orders could not be read.", tool: "list_orders" }],
    question: "how many orders?"
  }).includes("FAILED")
);

console.log("\n=== The offline classifier ===");

const INTENT_CASES: Array<[string, (typeof STORE_COPILOT_INTENTS)[number]]> = [
  ["Which products are low on stock?", "inventory"],
  ["কম স্টক পণ্যগুলো দেখাও", "inventory"],
  ["what do I need to reorder", "inventory"],
  ["Which products are out of stock?", "inventory"],
  ["Who ordered most recently?", "orders"],
  ["Who are my best customers?", "customers"],
  ["গ্রাহক কতজন?", "customers"],
  ["What are my best sellers?", "products"],
  ["সেরা বিক্রিত পণ্য কোনগুলো?", "products"],
  ["How many orders are pending?", "orders"],
  ["আজ কত অর্ডার এসেছে?", "orders"],
  ["How much revenue this month?", "revenue"],
  // Every follow-up the briefing offers has to route back into the briefing.
  ["How much did we sell this month?", "revenue"],
  ["How much did we sell today?", "revenue"],
  ["এই মাসে মোট বিক্রি কত?", "revenue"],
  ["How are we doing?", "overview"],
  ["hello", "overview"]
];

for (const [question, expected] of INTENT_CASES) {
  const actual = classifyStoreCopilotQuestion(question);

  check(
    `"${question}" → ${expected}`,
    actual === expected,
    actual === expected ? "" : `got ${actual}`
  );
}

console.log("\n=== Tenancy and reuse ===");

check(
  "both server actions resolve the store from the session",
  (source.actions.match(/await requireStore\(\)/g) ?? []).length === 2
);
check(
  "no server action takes a store, tenant or organization selector",
  !/\b(storeId|organizationId|tenantId)\s*[:,)]/.test(
    source.actions.replace(/storeId: store\.id/g, "")
  )
);
check(
  "the confirmed proposal is re-parsed on the server before it runs",
  source.actions.includes("storeCopilotActionSchema.safeParse(input)")
);
check(
  "writes go through the AI action services, never a domain service or repository",
  source.service.includes('from "../ai/ai-actions.service"') &&
    !/\b(createCoupon|updateProduct|updateOrderStatus)\(/.test(source.service)
);
check(
  // The service's two repository imports are reads, and they are the same
  // store-scoped lookups `ai-actions.service.ts` itself uses to prove a target
  // belongs to the tenant before touching it. A proposal naming a product from
  // another store must resolve to nothing rather than to a Confirm button.
  "the only domain reads are store-scoped lookups that validate a proposal target",
  ["getOrderByIdForStore", "getProductByIdForStore", "getStoreIdentityById"].every((fn) =>
    source.service.includes(fn)
  ) && !/prisma\./.test(source.service)
);
check(
  "the three write functions are exactly the AI API's own",
  ["createAiCoupon", "setAiOrderStatus", "updateAiProduct"].every((fn) =>
    source.service.includes(fn)
  )
);
check(
  "reads go through the AI read services rather than Prisma",
  !source.tools.includes("prisma") && !source.briefing.includes("prisma")
);
check(
  "no module in the feature imports Prisma directly",
  Object.values(source).every((text) => !text.includes('from "@dash/db"'))
);
check(
  "the merchant's own provider key is resolved by the one function that decrypts it",
  source.service.includes("resolveAiProvider") && !source.service.includes("decryptSecret")
);
check(
  "nothing in the feature depends on StoreOS",
  Object.values(source).every((text) => !/storeos/i.test(text.replace(/"storeos"/g, "")))
);
check(
  "every action is attributed to the person who approved it",
  source.actions.includes('via: "store-copilot"') && source.actions.includes("getCurrentUser()")
);

console.log("\n=== StoreIM AI is a paid entitlement ===");

check("`ai_copilot` is a registered feature key", PLAN_FEATURE_KEYS.includes("ai_copilot"));
check("`ai_copilot` is paid — the Free tier does not grant it", isPaidFeature("ai_copilot"));

// `aiEnabled` is the pricing table's "this plan includes some StoreIM AI" flag,
// and the three per-surface keys are what the services read. A plan carrying one
// without the other means either a "Paid" pill over a working page or a working
// page with no pill, so the two are asserted to agree.
const AI_SURFACE_KEYS = ["ai_copilot", "ai_product_content", "ai_shopping_agent"] as const;
const aiKeyPlans = PLAN_CATALOG.filter((plan) =>
  AI_SURFACE_KEYS.some((key) => plan.features.includes(key))
)
  .map((plan) => plan.slug)
  .sort();
const aiFlagPlans = PLAN_CATALOG.filter((plan) => plan.aiEnabled)
  .map((plan) => plan.slug)
  .sort();

check(
  "some StoreIM AI key is granted by exactly the plans with aiEnabled",
  aiKeyPlans.join(",") === aiFlagPlans.join(","),
  `keys: [${aiKeyPlans.join(", ")}] vs aiEnabled: [${aiFlagPlans.join(", ")}]`
);
check(
  "and that is Starter up",
  aiKeyPlans.join(",") === "growth,pro,starter",
  aiKeyPlans.join(", ")
);

check(
  "the copilot refuses a store whose plan does not include it",
  source.service.includes('hasPlanFeature(storeId, "ai_copilot")') &&
    source.service.includes("if (!planAllowsAi)") &&
    source.service.includes("STORE_COPILOT_LOCKED_MESSAGE")
);
check(
  "the entitlement is re-checked before a confirmed change runs",
  source.actions.includes("getStoreCopilotCapability(store.id)).locked")
);
check(
  // The rule the plan sells on, shared with the content studio and the shopping
  // agent: a key the merchant owns picks the engine that writes the answer, and
  // buys a real conversation over the offline briefing. It is not a second way
  // to qualify for the surface.
  "an own provider key does not stand in for the plan",
  !source.service.includes("if (!provider && !planAllowsAi)") &&
    source.service.includes("locked: !planAllowsAi")
);

console.log("\n=== Redaction is inherited, not re-implemented ===");

for (const column of ["costPrice", "riskScore", "riskFactors", "ipAddress", "verificationStatus"]) {
  check(
    `${column} is never named in the feature`,
    Object.values(source).every((text) => !text.includes(column))
  );
}

console.log(
  failures === 0
    ? "\nAI Store Copilot: all checks passed."
    : `\nAI Store Copilot: ${failures} check(s) failed.`
);

process.exit(failures === 0 ? 0 : 1);
