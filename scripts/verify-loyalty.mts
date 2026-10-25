/**
 * Loyalty check (Phase 1: settings, rules and the ledger).
 *
 * There is no test runner in this repo, so this is the executable check for
 * the loyalty module, and like the others it needs neither a database nor a
 * session.
 *
 * The *rules* checks run `loyalty.rules.ts` and `loyalty.schema.ts` for real:
 * the earning base, rounding down at every boundary, which orders are eligible,
 * reconciling an order's points to a target, the phone key, and the shape and
 * sign of every ledger row.
 *
 * The *ledger* checks run the real `appendLoyaltyLedgerEntry` against an
 * in-memory stand-in for the two Prisma delegates it touches. The stand-in
 * models what the writer relies on from Postgres — a row lock taken by the
 * balance update and held to commit, each statement seeing what is committed
 * plus its own writes, the unique key, and rollback discarding everything — so
 * the writer's own logic is exercised under real interleavings: concurrent
 * replays, concurrent spends, a failure after the balance moved. It is a model
 * of those semantics, not Postgres itself; the database guarantees are pinned
 * separately by the schema checks below.
 *
 * The *structure* checks read the module, the schema and the wiring as text,
 * because the service and actions pull in Prisma and `next/*`: every statement
 * scoped by store, the ledger append-only, the plan gate only on switching on,
 * the action manager-only and blind to anything but its three settings.
 *
 * Run with: npm run verify:loyalty
 */
import { createHmac } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isPaidFeature,
  minPlanForFeature,
  PLAN_CATALOG
} from "../apps/web/src/modules/admin/plan-catalog";
import {
  PLAN_FEATURE_KEYS,
  PLAN_FEATURE_REGISTRY
} from "../apps/web/src/modules/billing/plan-features";
import {
  checkoutCouponBase,
  checkoutGoodsSubtotal,
  checkoutRedemptionBaseCents
} from "../apps/web/src/modules/checkout/checkout-pricing";
import { appendLoyaltyLedgerEntry } from "../apps/web/src/modules/loyalty/loyalty.ledger";
import {
  debitCheckoutRedemption,
  enrollLoyaltyMember,
  priceCheckoutRedemption,
  reconcileOrderLoyalty,
  type OrderLoyaltyClient
} from "../apps/web/src/modules/loyalty/loyalty.orders";
import {
  readRedemptionToken,
  signRedemptionToken
} from "../apps/web/src/modules/loyalty/loyalty.redemption";
import {
  balanceFloorFor,
  describeOrderPoints,
  loyaltyOtpPhone,
  checkoutRedemptionKey,
  checkRedemption,
  couponCoversShipping,
  loyaltyRedemptionLive,
  planOrderRedemption,
  redemptionLimits,
  type RedemptionPolicy,
  decideMemberLink,
  earnCorrection,
  firstBrokenLedgerLink,
  isOrderEligibleForPoints,
  ledgerBalance,
  ledgerEntryProblem,
  LOYALTY_ADJUSTMENT_MAX,
  LOYALTY_EARNING_ORDER_STATUS,
  LOYALTY_POINTS_MAX,
  loyaltyMembershipStatus,
  loyaltyPhoneSearchDigits,
  memberActionNeedsPlan,
  splitLookaheadPage,
  loyaltyCapability,
  loyaltyEarningBaseCents,
  LoyaltyError,
  loyaltyLedgerKey,
  loyaltyPhoneKey,
  orderEarnsForMember,
  orderPointsTarget,
  planOrderLoyalty,
  planSaleLoyalty,
  pointsForBase,
  resolveSaleOptIn,
  returnedGoodsCents,
  shouldEnrollAtCheckout,
  toCents,
  type LoyaltyEarningAmounts,
  type LoyaltyLedgerLine,
  type OrderLoyaltyContext,
  type OrderLoyaltyFacts,
  type SaleLoyaltyFacts,
  type SaleLoyaltyPlan
} from "../apps/web/src/modules/loyalty/loyalty.rules";
import {
  adjustmentLedgerEntry,
  LOYALTY_LEDGER_KEY_PATTERN,
  LOYALTY_NOTE_MAX,
  LOYALTY_SETTINGS_DEFAULTS,
  LOYALTY_SOURCE_TYPES,
  LOYALTY_TRANSACTION_TYPES,
  loyaltyAdjustmentSchema,
  loyaltyLedgerEntrySchema,
  loyaltySettingsSchema,
  type LoyaltyLedgerEntry,
  type LoyaltyLedgerEntryInput
} from "../apps/web/src/modules/loyalty/loyalty.schema";
import {
  canOfferMembershipJoin,
  canOfferSaleOptIn,
  findSaleCustomersByPhone,
  mergeSaleCustomerOptions,
  newCustomerDraft,
  saleMembershipNote,
  searchSaleCustomers,
  toSaleCustomerOption
} from "../apps/web/src/modules/sales/sale-customer";
import {
  customerPhoneForStorage,
  customerPhoneMatchKey
} from "../apps/web/src/modules/customers/customer-phone";
import { counterCustomerSchema } from "../apps/web/src/modules/customers/customer.schema";
import { maskRecipient } from "../apps/web/src/modules/notifications/notifications.redact";

const ROOT = process.cwd();
const WEB = join(ROOT, "apps", "web", "src");
const MODULE_DIR = join(WEB, "modules", "loyalty");

const MODULES = join(WEB, "modules");

const source = {
  actions: read(join(MODULE_DIR, "loyalty.actions.ts")),
  checkoutForm: read(join(MODULES, "checkout", "components", "checkout-form.tsx")),
  checkoutPage: read(join(WEB, "app", "storefront", "[slug]", "checkout", "page.tsx")),
  checkoutRoute: read(join(WEB, "app", "api", "checkout", "route.ts")),
  checkoutSchema: read(join(MODULES, "checkout", "checkout.schema.ts")),
  checkoutService: read(join(MODULES, "checkout", "checkout.service.ts")),
  conflictsPage: read(
    join(WEB, "app", "dashboard", "marketing", "loyalty", "conflicts", "page.tsx")
  ),
  customerDashboard: read(join(MODULES, "customers", "components", "customer-dashboard.tsx")),
  customerRepository: read(join(MODULES, "customers", "customer.repository.ts")),
  customerService: read(join(MODULES, "customers", "customer.service.ts")),
  aiActions: read(join(MODULES, "ai", "ai-actions.service.ts")),
  aiDoc: read(join(ROOT, "docs", "ai-api.md")),
  checkoutExperience: read(join(MODULES, "checkout", "components", "checkout-experience.tsx")),
  checkoutQuote: read(join(MODULES, "checkout", "checkout-quote.ts")),
  couponRoute: read(join(WEB, "app", "api", "checkout", "coupon", "route.ts")),
  guestHistory: read(join(MODULES, "guest-orders", "components", "guest-order-history.tsx")),
  guestRender: read(join(MODULES, "guest-orders", "guest-orders.render.ts")),
  loyaltyQuoteRoute: read(join(WEB, "app", "api", "checkout", "loyalty-quote", "route.ts")),
  notificationsService: read(join(MODULES, "notifications", "notifications.service.ts")),
  returnsPanel: read(join(MODULES, "returns", "components", "order-returns-panel.tsx")),
  loyaltyCodeRoute: read(join(WEB, "app", "api", "checkout", "loyalty-code", "route.ts")),
  loyaltyVerifyRoute: read(join(WEB, "app", "api", "checkout", "loyalty-verify", "route.ts")),
  memberPage: read(
    join(WEB, "app", "dashboard", "marketing", "loyalty", "members", "[memberId]", "page.tsx")
  ),
  orderDetailPage: read(join(WEB, "app", "dashboard", "orders", "[orderId]", "page.tsx")),
  orderEditForm: read(join(MODULES, "orders", "components", "order-edit-form.tsx")),
  pointsPanel: read(join(MODULES, "checkout", "components", "checkout-points-redemption.tsx")),
  membersPage: read(join(WEB, "app", "dashboard", "marketing", "loyalty", "members", "page.tsx")),
  fakeOrderService: read(join(MODULES, "fake-orders", "fake-order.service.ts")),
  ledger: read(join(MODULE_DIR, "loyalty.ledger.ts")),
  manualOrder: read(join(MODULES, "orders", "order-create.service.ts")),
  nav: read(join(WEB, "components", "dashboard", "dashboard-nav.tsx")),
  orderService: read(join(MODULES, "orders", "order.service.ts")),
  orders: read(join(MODULE_DIR, "loyalty.orders.ts")),
  page: read(join(WEB, "app", "dashboard", "marketing", "loyalty", "page.tsx")),
  prisma: read(join(ROOT, "packages", "db", "prisma", "schema.prisma")),
  repository: read(join(MODULE_DIR, "loyalty.repository.ts")),
  returnService: read(join(MODULES, "returns", "return.service.ts")),
  rules: read(join(MODULE_DIR, "loyalty.rules.ts")),
  service: read(join(MODULE_DIR, "loyalty.service.ts")),
  shoppingAgent: readdirSync(join(MODULES, "shopping-agent"))
    .filter((name) => name.endsWith(".ts"))
    .map((name) => read(join(MODULES, "shopping-agent", name)))
    .join("\n"),
  staffPermissions: read(join(ROOT, "scripts", "verify-staff-permissions.mts"))
};

let failures = 0;

function read(file: string) {
  return readFileSync(file, "utf8");
}

/** The module with its prose taken out, for checks that assert a name is absent. */
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

/** The values of a Prisma enum, read from the schema. */
function prismaEnum(name: string) {
  const body = new RegExp(`enum ${name} \\{([\\s\\S]*?)\\}`).exec(source.prisma)?.[1] ?? "";

  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[A-Z_]+$/.test(line));
}

function prismaModel(name: string) {
  return new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`).exec(source.prisma)?.[1] ?? "";
}

console.log("=== Settings contract ===");

check("the programme is off by default", LOYALTY_SETTINGS_DEFAULTS.enabled === false);
check("the defaults parse", loyaltySettingsSchema.safeParse(LOYALTY_SETTINGS_DEFAULTS).success);

const settingsInput = {
  amountPerPoint: "100",
  enabled: true,
  maxRedeemPercent: "50",
  minRedeemPoints: "100",
  pointValue: "1",
  programName: "Rewards",
  redemptionEnabled: false
};
const normalisedAmount = loyaltySettingsSchema.safeParse(settingsInput);
check(
  "an amount per point is stored to two places",
  normalisedAmount.success && normalisedAmount.data.amountPerPoint === "100.00",
  normalisedAmount.success ? normalisedAmount.data.amountPerPoint : "refused"
);

for (const amountPerPoint of ["0", "0.00", "-1", "abc", "", "1.234", "1e3", "1000000.01"]) {
  check(
    `amount per point ${JSON.stringify(amountPerPoint)} is refused`,
    !loyaltySettingsSchema.safeParse({ ...settingsInput, amountPerPoint }).success
  );
}

check(
  "the smallest amount per point, 0.01, is accepted",
  loyaltySettingsSchema.safeParse({ ...settingsInput, amountPerPoint: "0.01" }).success
);

const renamed = loyaltySettingsSchema.safeParse({
  ...settingsInput,
  programName: "  Gold \n Club\u0007 "
});
check(
  "a programme name is kept to one trimmed line",
  renamed.success && renamed.data.programName === "Gold Club",
  renamed.success ? JSON.stringify(renamed.data.programName) : "refused"
);
check(
  "a blank programme name is refused",
  !loyaltySettingsSchema.safeParse({ ...settingsInput, programName: " \n " }).success
);
check(
  "a programme name over the limit is refused",
  !loyaltySettingsSchema.safeParse({ ...settingsInput, programName: "x".repeat(61) }).success
);

console.log("\n=== Earning base ===");

const amounts = (overrides: Partial<LoyaltyEarningAmounts> = {}): LoyaltyEarningAmounts => ({
  bundleDiscountAmount: "0.00",
  couponCoversShipping: false,
  discountAmount: "0.00",
  subtotalAmount: "1000.00",
  ...overrides
});

check(
  "net goods are the subtotal less coupon and bundle discounts",
  loyaltyEarningBaseCents(amounts({ bundleDiscountAmount: "50.00", discountAmount: "100.00" })) ===
    85_000
);
check(
  "a free-shipping coupon does not reduce the goods",
  loyaltyEarningBaseCents(amounts({ couponCoversShipping: true, discountAmount: "70.00" })) ===
    100_000
);
check(
  "a points discount is taken off the goods once it exists",
  loyaltyEarningBaseCents(amounts({ loyaltyDiscountAmount: "200.00" })) === 80_000
);
check(
  "discounts larger than the goods earn nothing rather than going negative",
  loyaltyEarningBaseCents(amounts({ discountAmount: "900.00", bundleDiscountAmount: "300.00" })) ===
    0
);
check(
  "a negative discount cannot raise the base",
  loyaltyEarningBaseCents(amounts({ discountAmount: "-50.00" })) === 100_000
);
check(
  "an unreadable discount earns nothing",
  loyaltyEarningBaseCents(amounts({ discountAmount: "abc" })) === 0
);
check(
  "an unreadable or zero subtotal earns nothing",
  loyaltyEarningBaseCents(amounts({ subtotalAmount: "" })) === 0 &&
    loyaltyEarningBaseCents(amounts({ subtotalAmount: "0" })) === 0
);
check("toCents refuses non-numbers", toCents("abc") === null && toCents(Number.NaN) === null);
check("toCents rounds to whole cents", toCents("0.1") === 10 && toCents(0.1 + 0.2) === 30);

console.log("\n=== Rounding down ===");

const boundaries: Array<[number, string, number]> = [
  [9_999, "100.00", 0],
  [10_000, "100.00", 1],
  [19_999, "100.00", 1],
  [20_000, "100.00", 2],
  [124_999, "100.00", 12],
  // 0.30 / 0.10 is 2.9999999999999996 in floating point; the rule must say 3.
  [30, "0.10", 3],
  [999, "3.33", 3],
  [998, "3.33", 2],
  [12_345, "0.01", 12_345]
];

for (const [baseCents, per, expected] of boundaries) {
  const actual = pointsForBase(baseCents, per);

  check(
    `${baseCents} cents at ${per} per point earns ${expected}`,
    actual === expected,
    `got ${actual}`
  );
}

for (const per of ["0", "-5", "abc", ""]) {
  check(
    `an amount per point of ${JSON.stringify(per)} earns nothing`,
    pointsForBase(10_000, per) === 0
  );
}

check(
  "a negative, fractional or non-finite base earns nothing",
  pointsForBase(-100, "1.00") === 0 &&
    pointsForBase(10.5, "0.01") === 0 &&
    pointsForBase(Number.POSITIVE_INFINITY, "1.00") === 0
);
check(
  "points are capped at the per-entry maximum",
  pointsForBase(1e15, "0.01") === LOYALTY_POINTS_MAX
);

console.log("\n=== Eligible orders ===");

const orderStatuses = prismaEnum("OrderStatus");
const verificationStatuses = prismaEnum("OrderVerificationStatus");

check(
  "the earning status is a real OrderStatus",
  orderStatuses.includes(LOYALTY_EARNING_ORDER_STATUS),
  orderStatuses.join(", ")
);

for (const status of orderStatuses) {
  const eligible = isOrderEligibleForPoints({
    markedFakeAt: null,
    status,
    verificationStatus: "NORMAL"
  });

  check(
    `${status.padEnd(10)} ${status === "COMPLETED" ? "earns" : "does not earn"}`,
    eligible === (status === "COMPLETED")
  );
}

for (const verificationStatus of verificationStatuses) {
  const rejected = verificationStatus === "FAKE" || verificationStatus === "BLOCKED";
  const eligible = isOrderEligibleForPoints({
    markedFakeAt: null,
    status: "COMPLETED",
    verificationStatus
  });

  check(
    `a completed ${verificationStatus} order ${rejected ? "does not earn" : "earns"}`,
    eligible === !rejected
  );
}

check(
  "a completed order the seller marked fake does not earn",
  !isOrderEligibleForPoints({
    markedFakeAt: new Date(),
    status: "COMPLETED",
    verificationStatus: "NORMAL"
  })
);

const completedOrder = {
  ...amounts({ subtotalAmount: "1250.00" }),
  markedFakeAt: null,
  status: "COMPLETED",
  verificationStatus: "NORMAL"
};
check(
  "a completed 1,250 order at 100 per point targets 12",
  orderPointsTarget(completedOrder, { amountPerPoint: "100.00" }) === 12
);
check(
  "the same order while pending targets 0",
  orderPointsTarget({ ...completedOrder, status: "PENDING" }, { amountPerPoint: "100.00" }) === 0
);

console.log("\n=== Reconciliation ===");

const first = earnCorrection("order_1", 120, []);
check(
  "an order with no earn rows earns its whole target",
  first?.type === "EARN" && first.points === 120 && first.idempotencyKey === "order:order_1:earn:0",
  JSON.stringify(first)
);
check(
  "the same event twice builds the same key",
  earnCorrection("order_1", 120, [])?.idempotencyKey === first?.idempotencyKey
);

const earned: LoyaltyLedgerLine[] = [{ points: 120, type: "EARN" }];
check(
  "an order already at its target writes nothing",
  earnCorrection("order_1", 120, earned) === null
);

const reversal = earnCorrection("order_1", 0, earned);
check(
  "leaving COMPLETED reverses exactly what was earned",
  reversal?.type === "EARN_REVERSAL" &&
    reversal.points === -120 &&
    reversal.idempotencyKey === "order:order_1:earn:1",
  JSON.stringify(reversal)
);

const bounced: LoyaltyLedgerLine[] = [...earned, { points: -120, type: "EARN_REVERSAL" }];
const reEarn = earnCorrection("order_1", 120, bounced);
check(
  "completing it again earns again, under a key not used before",
  reEarn?.type === "EARN" &&
    reEarn.points === 120 &&
    reEarn.idempotencyKey === "order:order_1:earn:2",
  JSON.stringify(reEarn)
);

const partial = earnCorrection("order_1", 80, earned);
check(
  "a lower target reverses only the difference",
  partial?.type === "EARN_REVERSAL" && partial.points === -40
);
check(
  "redemption rows on the order are not counted as earnings",
  earnCorrection("order_1", 120, [...earned, { points: -50, type: "REDEEM" }]) === null
);

let rejectedTarget = false;
try {
  earnCorrection("order_1", 1.5, []);
} catch (error) {
  rejectedTarget = error instanceof LoyaltyError && error.code === "INVALID_ENTRY";
}
check("a fractional target is refused", rejectedTarget);

check(
  "the ledger adds up to its balance",
  ledgerBalance([{ points: 120 }, { points: -120 }, { points: 120 }, { points: -50 }]) === 70
);
check(
  "an unbroken balanceAfter chain is accepted",
  firstBrokenLedgerLink([
    { balanceAfter: 120, points: 120 },
    { balanceAfter: 70, points: -50 }
  ]) === -1
);
check(
  "a broken balanceAfter chain is found at the row that breaks it",
  firstBrokenLedgerLink([
    { balanceAfter: 120, points: 120 },
    { balanceAfter: 80, points: -50 }
  ]) === 1
);

console.log("\n=== Ledger rows ===");

check(
  "the Prisma enums match the module's types",
  JSON.stringify(prismaEnum("LoyaltyTransactionType")) ===
    JSON.stringify([...LOYALTY_TRANSACTION_TYPES]) &&
    JSON.stringify(prismaEnum("LoyaltySourceType")) === JSON.stringify([...LOYALTY_SOURCE_TYPES])
);

const validEntry: LoyaltyLedgerEntryInput = {
  actorUserId: null,
  idempotencyKey: "order:order_1:earn:0",
  memberId: "member_1",
  note: null,
  points: 120,
  sourceId: "order_1",
  sourceType: "ORDER",
  type: "EARN"
};
check("a well-formed earn parses", loyaltyLedgerEntrySchema.safeParse(validEntry).success);

const malformed: Array<[string, Partial<LoyaltyLedgerEntryInput>]> = [
  ["zero points", { points: 0 }],
  ["fractional points", { points: 1.5 }],
  ["NaN points", { points: Number.NaN }],
  ["infinite points", { points: Number.POSITIVE_INFINITY }],
  ["points over the maximum", { points: LOYALTY_POINTS_MAX + 1 }],
  ["an EARN that subtracts", { points: -120 }],
  ["an EARN_REVERSAL that adds", { type: "EARN_REVERSAL" }],
  ["a REDEEM that adds", { type: "REDEEM" }],
  ["a REDEEM_REVERSAL that subtracts", { points: -10, type: "REDEEM_REVERSAL" }],
  ["an EARN from a manual source", { sourceType: "MANUAL" }],
  ["an ADJUSTMENT from an order", { type: "ADJUSTMENT" }],
  ["an order entry without its order", { sourceId: null }],
  ["a key the builder did not make", { idempotencyKey: "anything-goes" }],
  ["a key with spaces", { idempotencyKey: "order:order 1:earn:0" }],
  ["an unknown type", { type: "GIFT" as never }],
  ["a malformed member id", { memberId: "member 1; DROP" }]
];

for (const [label, overrides] of malformed) {
  check(
    `${label} is refused`,
    !loyaltyLedgerEntrySchema.safeParse({ ...validEntry, ...overrides }).success
  );
}

check(
  "a manual adjustment either way parses",
  [25, -25].every(
    (points) =>
      loyaltyLedgerEntrySchema.safeParse({
        ...validEntry,
        idempotencyKey: loyaltyLedgerKey({
          purpose: "adjust",
          sequence: 0,
          sourceId: "req_1",
          sourceType: "MANUAL"
        }),
        points,
        sourceId: null,
        sourceType: "MANUAL",
        type: "ADJUSTMENT"
      }).success
  )
);
check(
  "every key the builder makes matches the accepted pattern",
  (["adjust", "earn", "redeem", "redeem-reversal"] as const).every((purpose) =>
    LOYALTY_LEDGER_KEY_PATTERN.test(
      loyaltyLedgerKey({ purpose, sequence: 7, sourceId: "cm123_abc-X", sourceType: "ORDER" })
    )
  )
);
check(
  "ledgerEntryProblem explains the sign rule",
  ledgerEntryProblem({ points: -1, sourceId: "o", sourceType: "ORDER", type: "EARN" }) ===
    "EARN must add points."
);

check("adding points has no floor", balanceFloorFor({ points: 10, type: "ADJUSTMENT" }) === null);
check(
  "an earn reversal may leave the balance negative",
  balanceFloorFor({ points: -10, type: "EARN_REVERSAL" }) === null
);
check("spending may not go below zero", balanceFloorFor({ points: -10, type: "REDEEM" }) === 0);
check(
  "a manual deduction may not go below zero",
  balanceFloorFor({ points: -10, type: "ADJUSTMENT" }) === 0
);

console.log("\n=== Phone key and membership links ===");

const spellings = [
  "01712345678",
  "+8801712345678",
  "880 1712-345678",
  "1712345678",
  "017 1234 5678"
];
check(
  "every spelling of one Bangladesh mobile is one key",
  spellings.every((phone) => loyaltyPhoneKey(phone) === "01712345678"),
  spellings.map((phone) => String(loyaltyPhoneKey(phone))).join(", ")
);
check(
  "a foreign number keeps its digits behind a +",
  loyaltyPhoneKey("+44 7911 123456") === "+447911123456"
);
check(
  "an unreadable Bangladesh-looking number is kept apart, never folded in",
  loyaltyPhoneKey("01212345678") === "+01212345678"
);
check(
  "too short or empty finds no key",
  loyaltyPhoneKey("12345") === null &&
    loyaltyPhoneKey("") === null &&
    loyaltyPhoneKey(null) === null
);
check(
  "two different numbers never share a key",
  loyaltyPhoneKey("01712345678") !== loyaltyPhoneKey("01712345679")
);

check(
  "a customer with a membership keeps it, whatever number they typed",
  JSON.stringify(
    decideMemberLink({
      byCustomer: { id: "member_1" },
      byPhone: { customerId: "customer_2", id: "member_2" },
      customerId: "customer_1",
      phone: "01799999999"
    })
  ) === JSON.stringify({ action: "existing", memberId: "member_1" })
);
check(
  "a number on another customer's membership is a conflict, not a merge",
  decideMemberLink({
    byCustomer: null,
    byPhone: { customerId: "customer_2", id: "member_2" },
    customerId: "customer_1",
    phone: "+8801712345678"
  }).action === "conflict"
);
check(
  "a new customer on a free number gets a normalised key",
  JSON.stringify(
    decideMemberLink({ byCustomer: null, byPhone: null, customerId: "c", phone: "+8801712345678" })
  ) === JSON.stringify({ action: "create", phoneKey: "01712345678" })
);
check(
  "an unreadable number cannot join",
  decideMemberLink({ byCustomer: null, byPhone: null, customerId: "c", phone: "123" }).action ===
    "ineligible"
);

console.log("\n=== Ledger writer ===");

type FakeMember = {
  customerId: string;
  enrolledAt: Date;
  id: string;
  ledgerSequence: number;
  phoneKey: string;
  pointsBalance: number;
  storeId: string;
  suspendedAt: Date | null;
};
type FakeRow = LoyaltyLedgerEntry & {
  balanceAfter: number;
  createdAt: Date;
  id: string;
  sequence: number;
  storeId: string;
};
type FakeOrder = {
  bundleDiscountAmount: string;
  couponId: string | null;
  createdAt: Date;
  customerId: string | null;
  discountAmount: string;
  id: string;
  loyaltyDiscountAmount: string;
  markedFakeAt: Date | null;
  shippingAmount: string;
  status: string;
  storeId: string;
  subtotalAmount: string;
  updatedAt: Date;
  verificationStatus: string;
};
type FakeCoupon = { discountType: string; id: string; storeId: string };
type FakeReturn = {
  itemsAmount: string;
  orderId: string;
  replacementAmount: string;
  status: string;
  storeId: string;
  type: string;
};
type Where = Record<string, unknown>;
type Select = Record<string, boolean> | undefined;

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

/**
 * Every field the `where` names must match. A `where` that omits the store
 * therefore matches any store, as Postgres would — which is what lets a
 * dropped `storeId` show up as a cross-store write rather than pass unseen.
 */
function matches(row: object, where: Where) {
  return Object.entries(where).every(([key, value]) => (row as Where)[key] === value);
}

function pick<T extends object>(row: T, select: Select) {
  return select
    ? Object.fromEntries(Object.keys(select).map((key) => [key, (row as Where)[key]]))
    : { ...row };
}

/**
 * Committed state plus the locks held on it. A row lock is taken by an update
 * and held to commit or rollback, as Postgres does; an insert that would clash
 * with another transaction's uncommitted insert waits for it, as
 * `ON CONFLICT DO NOTHING` does.
 */
class FakeLedgerDb {
  readonly coupons: FakeCoupon[] = [];
  failNextCreate = false;
  memberUpdates = 0;
  readonly members = new Map<string, FakeMember>();
  readonly orders = new Map<string, FakeOrder>();
  readonly returns: FakeReturn[] = [];
  readonly rows: FakeRow[] = [];
  private readonly locks = new Map<
    string,
    { owner: FakeTransaction; release: () => void; released: Promise<void> }
  >();
  private sequence = 0;

  addMember(
    id: string,
    storeId: string,
    pointsBalance = 0,
    extra: Partial<Pick<FakeMember, "customerId" | "enrolledAt" | "phoneKey" | "suspendedAt">> = {}
  ) {
    this.members.set(id, {
      customerId: extra.customerId ?? `customer_of_${id}`,
      enrolledAt: extra.enrolledAt ?? new Date(0),
      id,
      ledgerSequence: 0,
      phoneKey: extra.phoneKey ?? `+${100000000 + this.members.size}`,
      pointsBalance,
      storeId,
      suspendedAt: extra.suspendedAt ?? null
    });
  }

  addOrder(order: Partial<FakeOrder> & Pick<FakeOrder, "id">) {
    this.orders.set(order.id, {
      bundleDiscountAmount: "0.00",
      couponId: null,
      createdAt: new Date(1_000),
      loyaltyDiscountAmount: "0.00",
      customerId: null,
      discountAmount: "0.00",
      markedFakeAt: null,
      shippingAmount: "70.00",
      status: "PENDING",
      storeId: STORE,
      subtotalAmount: "1250.00",
      updatedAt: new Date(1_000),
      verificationStatus: "NORMAL",
      ...order
    });
  }

  balance(id: string) {
    return this.members.get(id)?.pointsBalance;
  }

  orderRows(orderId: string) {
    return this.rows.filter((row) => row.sourceId === orderId);
  }

  nextId(prefix = "ltx") {
    this.sequence += 1;

    return `${prefix}_${this.sequence}`;
  }

  async acquire(key: string, owner: FakeTransaction) {
    for (;;) {
      const held = this.locks.get(key);

      if (!held) {
        break;
      }

      if (held.owner === owner) {
        return;
      }

      await held.released;
    }

    let release: () => void = () => undefined;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.locks.set(key, { owner, release, released });
  }

  releaseAll(owner: FakeTransaction) {
    for (const [key, held] of this.locks) {
      if (held.owner === owner) {
        this.locks.delete(key);
        held.release();
      }
    }
  }

  async transaction<T>(work: (client: OrderLoyaltyClient) => Promise<T>): Promise<T> {
    const tx = new FakeTransaction(this);

    try {
      const result = await work(tx.client as unknown as OrderLoyaltyClient);

      tx.commit();

      return result;
    } catch (error) {
      tx.rollback();
      throw error;
    }
  }
}

/** One transaction: its own uncommitted writes over the committed state. */
class FakeTransaction {
  private readonly memberWrites = new Map<string, Partial<FakeMember>>();
  private readonly created: FakeRow[] = [];
  private readonly insertedMembers: FakeMember[] = [];
  private readonly orderWrites = new Map<string, Partial<FakeOrder>>();

  constructor(private readonly db: FakeLedgerDb) {}

  private visibleMembers(): FakeMember[] {
    return [...this.db.members.values(), ...this.insertedMembers].map((member) => ({
      ...member,
      ...this.memberWrites.get(member.id)
    }));
  }

  private visibleOrders() {
    return [...this.db.orders.values()].map((order) => ({
      ...order,
      ...this.orderWrites.get(order.id)
    }));
  }

  private visibleRows() {
    return [...this.db.rows, ...this.created];
  }

  private findByKey(storeId: string, idempotencyKey: string) {
    return (
      this.visibleRows().find(
        (row) => row.storeId === storeId && row.idempotencyKey === idempotencyKey
      ) ?? null
    );
  }

  readonly client = {
    coupon: {
      findFirst: async (args: { select?: Select; where: Where }) => {
        await tick();
        const coupon = this.db.coupons.find((row) => matches(row, args.where));

        return coupon ? pick(coupon, args.select) : null;
      }
    },
    loyaltyMember: {
      createMany: async (args: {
        data: Array<Omit<FakeMember, "id" | "pointsBalance">>;
        skipDuplicates?: boolean;
      }) => {
        let count = 0;

        for (const data of args.data) {
          await tick();
          // Waits on another transaction inserting the same keys, then looks
          // again at what it committed.
          await this.db.acquire(`member-customer:${data.customerId}`, this);
          await this.db.acquire(`member-phone:${data.storeId}:${data.phoneKey}`, this);

          const clash = this.visibleMembers().some(
            (member) =>
              member.customerId === data.customerId ||
              (member.storeId === data.storeId && member.phoneKey === data.phoneKey)
          );

          if (clash) {
            if (args.skipDuplicates) {
              continue;
            }

            throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
          }

          this.insertedMembers.push({
            ...data,
            id: this.db.nextId("member"),
            ledgerSequence: 0,
            pointsBalance: 0,
            suspendedAt: null
          });
          count += 1;
        }

        return { count };
      },
      findFirst: async (args: { select?: Select; where: Where }) => {
        await tick();
        const member = this.visibleMembers().find((row) => matches(row, args.where));

        return member ? pick(member, args.select) : null;
      },
      updateMany: async (args: {
        data: Partial<
          Record<"ledgerSequence" | "pointsBalance", { decrement?: number; increment?: number }>
        >;
        where: Where;
      }) => {
        await tick();
        const target = this.visibleMembers().find((row) => matches(row, args.where));

        if (!target) {
          return { count: 0 };
        }

        await this.db.acquire(`member:${target.id}`, this);
        this.db.memberUpdates += 1;

        // Re-read once the lock is ours: whoever held it has committed. Every
        // counter in `data` moves in this one statement, as one UPDATE would.
        const current = this.visibleMembers().find((row) => row.id === target.id) ?? target;
        const write = { ...this.memberWrites.get(target.id) };

        for (const [field, change] of Object.entries(args.data)) {
          const key = field as "ledgerSequence" | "pointsBalance";

          write[key] = current[key] + (change?.increment ?? -(change?.decrement ?? 0));
        }

        this.memberWrites.set(target.id, write);

        return { count: 1 };
      }
    },
    loyaltyTransaction: {
      count: async (args: { where: Where }) => {
        await tick();

        return this.visibleRows().filter((row) => matches(row, args.where)).length;
      },
      create: async (args: { data: Omit<FakeRow, "createdAt" | "id"> }) => {
        await tick();

        if (this.db.failNextCreate) {
          this.db.failNextCreate = false;
          throw new Error("simulated failure after the balance moved");
        }

        if (this.findByKey(args.data.storeId, args.data.idempotencyKey)) {
          throw Object.assign(new Error("Unique constraint failed"), {
            code: "P2002",
            meta: { target: ["storeId", "idempotencyKey"] }
          });
        }

        const row: FakeRow = { ...args.data, createdAt: new Date(), id: this.db.nextId() };

        this.created.push(row);

        return row;
      },
      findMany: async (args: { select?: Select; where: Where }) => {
        await tick();

        return this.visibleRows()
          .filter((row) => matches(row, args.where))
          .map((row) => pick(row, args.select));
      },
      findUnique: async (args: {
        where: { storeId_idempotencyKey: { idempotencyKey: string; storeId: string } };
      }) => {
        await tick();

        return this.findByKey(
          args.where.storeId_idempotencyKey.storeId,
          args.where.storeId_idempotencyKey.idempotencyKey
        );
      }
    },
    order: {
      findFirst: async (args: { select?: Select; where: Where }) => {
        await tick();
        const order = this.visibleOrders().find((row) => matches(row, args.where));

        return order ? pick(order, args.select) : null;
      },
      updateMany: async (args: { data: Partial<FakeOrder>; where: Where }) => {
        await tick();
        const target = this.visibleOrders().find((row) => matches(row, args.where));

        if (!target) {
          return { count: 0 };
        }

        await this.db.acquire(`order:${target.id}`, this);
        this.orderWrites.set(target.id, { ...this.orderWrites.get(target.id), ...args.data });

        return { count: 1 };
      }
    },
    orderReturn: {
      findMany: async (args: { select?: Select; where: Where }) => {
        await tick();

        return this.db.returns
          .filter((row) => matches(row, args.where))
          .map((row) => pick(row, args.select));
      }
    }
  };

  commit() {
    for (const member of this.insertedMembers) {
      this.db.members.set(member.id, { ...member });
    }

    for (const [id, write] of this.memberWrites) {
      const member = this.db.members.get(id);

      if (member) {
        Object.assign(member, write);
      }
    }

    for (const [id, write] of this.orderWrites) {
      const order = this.db.orders.get(id);

      if (order) {
        Object.assign(order, write);
      }
    }

    this.db.rows.push(...this.created);
    this.db.releaseAll(this);
  }

  rollback() {
    this.db.releaseAll(this);
  }
}

const STORE = "store_a";
const OTHER_STORE = "store_b";

function ledgerEntry(overrides: Partial<LoyaltyLedgerEntryInput> = {}): LoyaltyLedgerEntry {
  return loyaltyLedgerEntrySchema.parse({ ...validEntry, ...overrides });
}

function orderEntry(
  orderId: string,
  points: number,
  type: LoyaltyLedgerEntryInput["type"],
  purpose: "earn" | "redeem",
  sequence = 0
) {
  return ledgerEntry({
    idempotencyKey: loyaltyLedgerKey({ purpose, sequence, sourceId: orderId, sourceType: "ORDER" }),
    points,
    sourceId: orderId,
    type
  });
}

async function write(db: FakeLedgerDb, entry: LoyaltyLedgerEntry, storeId = STORE) {
  return db.transaction((client) => appendLoyaltyLedgerEntry(client, storeId, entry));
}

/** Runs one scenario, reporting an unexpected throw as a failure rather than a crash. */
async function scenario(label: string, work: () => Promise<void>) {
  try {
    await work();
  } catch (error) {
    check(
      `${label} ran to completion`,
      false,
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function failureCode(work: Promise<unknown>) {
  try {
    await work;

    return null;
  } catch (error) {
    return error instanceof LoyaltyError ? error.code : `unexpected: ${String(error)}`;
  }
}

await scenario("balance, replays, refusals and rollback", async () => {
  const db = new FakeLedgerDb();
  db.addMember("member_1", STORE);
  db.addMember("member_2", OTHER_STORE, 40);

  const earn = orderEntry("order_1", 120, "EARN", "earn");
  const applied = await write(db, earn);
  check(
    "an entry moves the balance and appends its row together",
    applied.applied &&
      db.balance("member_1") === 120 &&
      db.rows.length === 1 &&
      applied.transaction.balanceAfter === 120
  );

  const replay = await write(db, earn);
  check(
    "replaying it moves nothing and returns the original row",
    !replay.applied &&
      db.balance("member_1") === 120 &&
      db.rows.length === 1 &&
      replay.transaction.id === applied.transaction.id
  );

  check(
    "the same key with a different amount is refused and moves nothing",
    (await failureCode(write(db, { ...earn, points: 50 }))) === "IDEMPOTENCY_CONFLICT" &&
      db.balance("member_1") === 120 &&
      db.rows.length === 1
  );

  check(
    "another store's member cannot be written through this store",
    (await failureCode(
      write(
        db,
        ledgerEntry({
          idempotencyKey: "order:order_x:earn:0",
          memberId: "member_2",
          sourceId: "order_x"
        })
      )
    )) === "MEMBER_NOT_FOUND" &&
      db.balance("member_2") === 40 &&
      db.rows.length === 1
  );

  check(
    "spending more than the balance is refused and rolled back",
    (await failureCode(write(db, orderEntry("order_2", -500, "REDEEM", "redeem")))) ===
      "INSUFFICIENT_POINTS" &&
      db.balance("member_1") === 120 &&
      db.rows.length === 1
  );

  const spend = await write(db, orderEntry("order_2", -100, "REDEEM", "redeem"));
  check(
    "spending within the balance is applied",
    spend.applied && db.balance("member_1") === 20 && spend.transaction.balanceAfter === 20
  );

  const reverse = await write(db, orderEntry("order_1", -120, "EARN_REVERSAL", "earn", 1));
  check(
    "an earn reversal after the points were spent is recorded in full",
    reverse.applied && db.balance("member_1") === -100 && reverse.transaction.balanceAfter === -100
  );

  check(
    "a negative balance cannot redeem",
    (await failureCode(write(db, orderEntry("order_3", -1, "REDEEM", "redeem")))) ===
      "INSUFFICIENT_POINTS" && db.balance("member_1") === -100
  );

  db.failNextCreate = true;
  let failedAfterMove = false;
  try {
    await write(db, orderEntry("order_4", 30, "EARN", "earn"));
  } catch {
    failedAfterMove = true;
  }
  check(
    "a failure after the balance moved rolls the balance back",
    failedAfterMove && db.balance("member_1") === -100 && db.rows.length === 3
  );

  check(
    "the ledger agrees with the balance, row by row",
    ledgerBalance(db.rows) === db.balance("member_1") && firstBrokenLedgerLink(db.rows) === -1
  );
});

await scenario("concurrent copies of one event", async () => {
  const db = new FakeLedgerDb();
  db.addMember("member_1", STORE);

  const earn = orderEntry("order_1", 120, "EARN", "earn");
  const results = await Promise.allSettled([write(db, earn), write(db, earn)]);
  const settled = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : []
  );
  check(
    "two concurrent copies of one event move the balance once, and neither fails",
    settled.length === 2 &&
      settled.filter((result) => result.applied).length === 1 &&
      db.balance("member_1") === 120 &&
      db.rows.length === 1,
    results
      .map((result) =>
        result.status === "fulfilled" ? `applied=${result.value.applied}` : String(result.reason)
      )
      .join(", ")
  );
  // Inc, inc, dec: the second copy passed the replay check, queued on the
  // lock, found the first copy's row and gave its points back.
  check(
    "the second copy was caught behind the lock, not by luck",
    db.memberUpdates === 3,
    `${db.memberUpdates} balance update(s)`
  );
});

await scenario("concurrent distinct earns", async () => {
  const db = new FakeLedgerDb();
  db.addMember("member_1", STORE);

  const entries = Array.from({ length: 20 }, (_, index) =>
    orderEntry(`order_${index + 1}`, index + 1, "EARN", "earn")
  );
  const results = await Promise.all(entries.map((entry) => write(db, entry)));
  check(
    "twenty concurrent distinct earns all land",
    results.every((result) => result.applied) &&
      db.rows.length === 20 &&
      db.balance("member_1") === 210,
    `balance ${db.balance("member_1")}`
  );
  check(
    "their balanceAfter values form one unbroken chain",
    firstBrokenLedgerLink(db.rows) === -1 &&
      new Set(db.rows.map((row) => row.balanceAfter)).size === 20
  );
});

await scenario("concurrent spends", async () => {
  const db = new FakeLedgerDb();
  db.addMember("member_1", STORE, 100);

  const outcomes = await Promise.allSettled([
    write(db, orderEntry("order_a", -80, "REDEEM", "redeem")),
    write(db, orderEntry("order_b", -80, "REDEEM", "redeem"))
  ]);
  const refused = outcomes.filter(
    (outcome) =>
      outcome.status === "rejected" &&
      outcome.reason instanceof LoyaltyError &&
      outcome.reason.code === "INSUFFICIENT_POINTS"
  );
  check(
    "two concurrent spends cannot both take the same points",
    outcomes.filter((outcome) => outcome.status === "fulfilled").length === 1 &&
      refused.length === 1 &&
      db.balance("member_1") === 20 &&
      db.rows.length === 1
  );
});

console.log("\n=== Phase 2: capability and enrolment rules ===");

const live = loyaltyCapability(true, true);
check("switched on and on the plan is live", live.live);
check("switched off is not live", !loyaltyCapability(false, true).live);
check("a plan without loyalty is not live", !loyaltyCapability(true, false).live);
check("a ticked box on a live programme enrols", shouldEnrollAtCheckout(true, live));
check(
  "no tick never enrols",
  !shouldEnrollAtCheckout(false, live) && !shouldEnrollAtCheckout(undefined, live)
);
check(
  "a tick on a switched-off programme does not enrol",
  !shouldEnrollAtCheckout(true, loyaltyCapability(false, true))
);
check(
  "a tick on a plan without loyalty does not enrol",
  !shouldEnrollAtCheckout(true, loyaltyCapability(true, false))
);

const ENROLLED_AT = new Date("2026-10-01T10:00:00.000Z");
const after = (ms: number) => new Date(ENROLLED_AT.getTime() + ms);

check("the order that carried the opt-in counts", orderEarnsForMember(ENROLLED_AT, ENROLLED_AT));
check("a later order counts", orderEarnsForMember(after(1), ENROLLED_AT));
check(
  "an order placed a millisecond before the opt-in does not",
  !orderEarnsForMember(after(-1), ENROLLED_AT)
);

console.log("\n=== Phase 2: earning amount ===");

check(
  "a free-shipping coupon covering the delivery charge is a shipping discount",
  couponCoversShipping({
    couponDiscountType: "FREE_SHIPPING",
    discountAmount: "70.00",
    shippingAmount: "70.00"
  })
);
check(
  "a free-shipping discount larger than the delivery charge is read as goods",
  !couponCoversShipping({
    couponDiscountType: "FREE_SHIPPING",
    discountAmount: "130.00",
    shippingAmount: "70.00"
  })
);
check(
  "a percentage or fixed coupon is a goods discount",
  !couponCoversShipping({
    couponDiscountType: "PERCENTAGE",
    discountAmount: "70.00",
    shippingAmount: "70.00"
  }) &&
    !couponCoversShipping({
      couponDiscountType: "FIXED_CART",
      discountAmount: "70.00",
      shippingAmount: "70.00"
    })
);
check(
  "an order with no coupon has no shipping discount",
  !couponCoversShipping({
    couponDiscountType: null,
    discountAmount: "70.00",
    shippingAmount: "70.00"
  })
);

const settled = (type: string, itemsAmount: string, replacementAmount = "0.00") => ({
  itemsAmount,
  replacementAmount,
  type
});
check(
  "a return gives back its goods",
  returnedGoodsCents([settled("RETURN", "500.00")]) === 50_000
);
check(
  "a refund gives back its goods",
  returnedGoodsCents([settled("REFUND", "250.00")]) === 25_000
);
check(
  "an exchange gives back only what the replacement did not cover",
  returnedGoodsCents([settled("EXCHANGE", "500.00", "300.00")]) === 20_000
);
check(
  "a pricier replacement earns nothing extra",
  returnedGoodsCents([settled("EXCHANGE", "500.00", "800.00")]) === 0
);
check(
  "several settlements add up",
  returnedGoodsCents([settled("RETURN", "100.00"), settled("REFUND", "50.50")]) === 15_050
);
check(
  "an unreadable settlement amount is reported, not guessed",
  returnedGoodsCents([settled("RETURN", "abc")]) === null
);
check(
  "returned goods come off the base",
  loyaltyEarningBaseCents(amounts({ returnedGoodsCents: 50_000, subtotalAmount: "1250.00" })) ===
    75_000
);
check(
  "returns larger than the base leave nothing, not a negative",
  loyaltyEarningBaseCents(amounts({ returnedGoodsCents: 200_000 })) === 0
);

console.log("\n=== Phase 2: order reconciliation plan ===");

const LIVE: OrderLoyaltyContext = { amountPerPoint: "100.00", live: true };
const NOT_LIVE: OrderLoyaltyContext = { ...LIVE, live: false };
const MEMBER = { enrolledAt: ENROLLED_AT, id: "member_1", suspendedAt: null };

type Line = OrderLoyaltyFacts["lines"][number];

const earnLine = (points: number, type: Line["type"] = "EARN", memberId = "member_1"): Line => ({
  amountPerPoint: "100.00",
  memberId,
  points,
  type
});

function facts(
  overrides: Partial<Omit<OrderLoyaltyFacts, "order">> & {
    order?: Partial<OrderLoyaltyFacts["order"]>;
  } = {}
): OrderLoyaltyFacts {
  return {
    coupon: overrides.coupon ?? null,
    lines: overrides.lines ?? [],
    member: overrides.member === undefined ? MEMBER : overrides.member,
    order: {
      bundleDiscountAmount: "0.00",
      createdAt: after(60_000),
      discountAmount: "0.00",
      id: "order_1",
      markedFakeAt: null,
      shippingAmount: "70.00",
      status: "COMPLETED",
      subtotalAmount: "1250.00",
      verificationStatus: "NORMAL",
      ...overrides.order
    },
    returns: overrides.returns ?? []
  };
}

function describePlan(input: OrderLoyaltyFacts, context = LIVE) {
  const plan = planOrderLoyalty(input, context);

  return plan.action === "write"
    ? `${plan.correction.type} ${plan.correction.points} ${plan.correction.idempotencyKey}`
    : `none:${plan.reason}`;
}

const planCases: Array<[string, OrderLoyaltyFacts, string, OrderLoyaltyContext?]> = [
  ["a customer who never joined earns nothing", facts({ member: null }), "none:no-member"],
  [
    "an order placed before the opt-in earns nothing, even completed after it",
    facts({ order: { createdAt: after(-60_000) } }),
    "none:no-member"
  ],
  ["a completed 1,250 order earns 12", facts(), "EARN 12 order:order_1:earn:0"],
  [
    "a pending order earns nothing yet",
    facts({ order: { status: "PENDING" } }),
    "none:already-reconciled"
  ],
  [
    "199.99 in goods earns 1",
    facts({ order: { subtotalAmount: "199.99" } }),
    "EARN 1 order:order_1:earn:0"
  ],
  [
    "99.99 in goods earns nothing",
    facts({ order: { subtotalAmount: "99.99" } }),
    "none:already-reconciled"
  ],
  [
    "a goods coupon comes off the base",
    facts({ coupon: { discountType: "PERCENTAGE" }, order: { discountAmount: "100.00" } }),
    "EARN 11 order:order_1:earn:0"
  ],
  [
    "a free-shipping coupon does not reduce the goods",
    facts({ coupon: { discountType: "FREE_SHIPPING" }, order: { discountAmount: "70.00" } }),
    "EARN 12 order:order_1:earn:0"
  ],
  [
    "a free-shipping discount edited past the delivery charge counts against goods",
    facts({ coupon: { discountType: "FREE_SHIPPING" }, order: { discountAmount: "130.00" } }),
    "EARN 11 order:order_1:earn:0"
  ],
  [
    "a bundle saving comes off the base",
    facts({ order: { bundleDiscountAmount: "300.00" } }),
    "EARN 9 order:order_1:earn:0"
  ],
  [
    "the same event again writes nothing",
    facts({ lines: [earnLine(12)] }),
    "none:already-reconciled"
  ],
  [
    "cancelling reverses what was earned",
    facts({ lines: [earnLine(12)], order: { status: "CANCELLED" } }),
    "EARN_REVERSAL -12 order:order_1:earn:1"
  ],
  [
    "moving back to processing reverses it too",
    facts({ lines: [earnLine(12)], order: { status: "PROCESSING" } }),
    "EARN_REVERSAL -12 order:order_1:earn:1"
  ],
  [
    "completing again earns again under a fresh key",
    facts({ lines: [earnLine(12), earnLine(-12, "EARN_REVERSAL")] }),
    "EARN 12 order:order_1:earn:2"
  ],
  [
    "an order marked fake gives its points back",
    facts({ lines: [earnLine(12)], order: { verificationStatus: "FAKE" } }),
    "EARN_REVERSAL -12 order:order_1:earn:1"
  ],
  [
    "an order with a customer blocked gives its points back",
    facts({
      lines: [earnLine(12)],
      order: { markedFakeAt: new Date(), verificationStatus: "BLOCKED" }
    }),
    "EARN_REVERSAL -12 order:order_1:earn:1"
  ],
  [
    "a partial return reverses the returned goods' share",
    facts({ lines: [earnLine(12)], returns: [settled("RETURN", "500.00")] }),
    "EARN_REVERSAL -5 order:order_1:earn:1"
  ],
  [
    "a cheaper exchange reverses only the difference",
    facts({ lines: [earnLine(12)], returns: [settled("EXCHANGE", "500.00", "300.00")] }),
    "EARN_REVERSAL -2 order:order_1:earn:1"
  ],
  [
    "a pricier exchange changes nothing",
    facts({ lines: [earnLine(12)], returns: [settled("EXCHANGE", "500.00", "800.00")] }),
    "none:already-reconciled"
  ],
  [
    "a full refund reverses everything",
    facts({ lines: [earnLine(12)], returns: [settled("REFUND", "1250.00")] }),
    "EARN_REVERSAL -12 order:order_1:earn:1"
  ],
  [
    "an unreadable settlement reverses everything rather than guess",
    facts({ lines: [earnLine(12)], returns: [settled("RETURN", "abc")] }),
    "EARN_REVERSAL -12 order:order_1:earn:1"
  ],
  ["a programme that is not live earns nothing", facts(), "none:not-live", NOT_LIVE],
  [
    "a programme that is not live still reverses a cancelled order",
    facts({ lines: [earnLine(12)], order: { status: "CANCELLED" } }),
    "EARN_REVERSAL -12 order:order_1:earn:1",
    NOT_LIVE
  ],
  [
    "a programme that is not live does not re-earn a re-completed order",
    facts({ lines: [earnLine(12), earnLine(-12, "EARN_REVERSAL")] }),
    "none:not-live",
    NOT_LIVE
  ],
  [
    "an order that earned keeps its rate when the setting changes",
    facts({ lines: [earnLine(12)] }),
    "none:already-reconciled",
    { amountPerPoint: "50.00", live: true }
  ],
  [
    "a new order is priced at the current rate",
    facts(),
    "EARN 25 order:order_1:earn:0",
    { amountPerPoint: "50.00", live: true }
  ]
];

for (const [label, input, expected, context] of planCases) {
  const actual = describePlan(input, context);

  check(label, actual === expected, `expected ${expected}, got ${actual}`);
}

const recorded = planOrderLoyalty(
  facts({
    lines: [earnLine(12, "EARN", "member_9")],
    member: null,
    order: { status: "CANCELLED" }
  }),
  LIVE
);
check(
  "a correction goes to the member the order earned for, whoever the customer is now",
  recorded.action === "write" && recorded.memberId === "member_9"
);
check(
  "a write carries the rate it was priced at",
  (() => {
    const plan = planOrderLoyalty(facts(), LIVE);

    return plan.action === "write" && plan.amountPerPoint === "100.00";
  })()
);

console.log("\n=== Phase 2: enrolment against the model ===");

await scenario("enrolment decisions", async () => {
  const db = new FakeLedgerDb();
  const enrol = (customerId: string, phone: string, storeId = STORE) =>
    db.transaction((client) =>
      enrollLoyaltyMember(client, { customerId, enrolledAt: ENROLLED_AT, phone, storeId })
    );

  const first = await enrol("customer_1", "017-1234 5678");
  const member = first.action === "enrolled" ? db.members.get(first.memberId) : undefined;
  check(
    "a new customer on a free number is enrolled under the normalised key",
    first.action === "enrolled" &&
      member?.phoneKey === "01712345678" &&
      member.customerId === "customer_1" &&
      member.pointsBalance === 0,
    JSON.stringify(first)
  );
  check(
    "they are enrolled as of the order that carried the opt-in",
    member?.enrolledAt.getTime() === ENROLLED_AT.getTime()
  );

  const again = await enrol("customer_1", "01712345678");
  check(
    "opting in again changes nothing",
    again.action === "existing" &&
      first.action === "enrolled" &&
      again.memberId === first.memberId &&
      db.members.size === 1
  );

  const clash = await enrol("customer_2", "+8801712345678");
  check(
    "a second customer record on the same number is a conflict, not a merge",
    clash.action === "conflict" &&
      first.action === "enrolled" &&
      clash.memberId === first.memberId &&
      db.members.size === 1 &&
      db.members.get(first.memberId)?.customerId === "customer_1",
    JSON.stringify(clash)
  );

  check(
    "an unreadable number is not enrolled",
    (await enrol("customer_3", "12345")).action === "ineligible" && db.members.size === 1
  );
  check(
    "the same number is free in another store",
    (await enrol("customer_4", "+8801712345678", OTHER_STORE)).action === "enrolled" &&
      db.members.size === 2
  );
});

await scenario("concurrent enrolments", async () => {
  const db = new FakeLedgerDb();
  const enrol = (customerId: string, phone: string) =>
    db.transaction((client) =>
      enrollLoyaltyMember(client, { customerId, enrolledAt: ENROLLED_AT, phone, storeId: STORE })
    );

  const racing = await Promise.allSettled([
    enrol("customer_a", "01811111111"),
    enrol("customer_b", "+8801811111111")
  ]);
  const outcomes = racing.map((result) =>
    result.status === "fulfilled" ? result.value.action : `threw: ${String(result.reason)}`
  );
  check(
    "two customer records racing for one number: one enrolled, one conflict, nobody's order fails",
    outcomes.includes("enrolled") && outcomes.includes("conflict") && db.members.size === 1,
    outcomes.join(", ")
  );

  const twice = await Promise.all([
    enrol("customer_c", "01922222222"),
    enrol("customer_c", "01922222222")
  ]);
  const ids = twice.map((result) => ("memberId" in result ? result.memberId : null));
  check(
    "one customer's double submit enrols them once",
    db.members.size === 2 && ids[0] !== null && ids[0] === ids[1],
    JSON.stringify(twice)
  );
});

console.log("\n=== Phase 2: order lifecycle against the model ===");

function lifecycleDb() {
  const db = new FakeLedgerDb();

  db.addMember("member_1", STORE, 0, {
    customerId: "customer_1",
    enrolledAt: ENROLLED_AT,
    phoneKey: "01712345678"
  });
  db.addOrder({ createdAt: after(60_000), customerId: "customer_1", id: "order_1" });

  return db;
}

/** A status (or verification) change and its reconciliation, as the hooks run them. */
function changeOrder(
  db: FakeLedgerDb,
  orderId: string,
  data: Record<string, unknown>,
  context = LIVE,
  storeId = STORE
) {
  return db.transaction(async (client) => {
    await client.order.updateMany({ data, where: { id: orderId, storeId } });

    return reconcileOrderLoyalty(client, storeId, orderId, context);
  });
}

function reconcileOnly(db: FakeLedgerDb, orderId: string, context = LIVE) {
  return db.transaction((client) => reconcileOrderLoyalty(client, STORE, orderId, context));
}

function keysAreUnique(db: FakeLedgerDb) {
  return new Set(db.rows.map((row) => row.idempotencyKey)).size === db.rows.length;
}

await scenario("one order's whole life", async () => {
  const db = lifecycleDb();

  await reconcileOnly(db, "order_1");
  check("a pending order writes nothing", db.rows.length === 0);

  await changeOrder(db, "order_1", { status: "COMPLETED" });
  check(
    "completing it earns 12, priced at the current rate",
    db.balance("member_1") === 12 &&
      db.rows.length === 1 &&
      String(db.rows[0]?.amountPerPoint) === "100.00"
  );

  await changeOrder(db, "order_1", { status: "COMPLETED" });
  check(
    "completing it again earns nothing more",
    db.balance("member_1") === 12 && db.rows.length === 1
  );

  await changeOrder(db, "order_1", { status: "CANCELLED" });
  check("cancelling reverses it", db.balance("member_1") === 0 && db.rows.length === 2);

  await changeOrder(db, "order_1", { status: "CANCELLED" });
  check("cancelling twice reverses once", db.balance("member_1") === 0 && db.rows.length === 2);

  await changeOrder(db, "order_1", { status: "COMPLETED" });
  check("re-completing earns again", db.balance("member_1") === 12 && db.rows.length === 3);

  await changeOrder(db, "order_1", { markedFakeAt: new Date(), verificationStatus: "FAKE" });
  check("marking it fake reverses it", db.balance("member_1") === 0);

  await changeOrder(db, "order_1", { markedFakeAt: null, verificationStatus: "NORMAL" });
  check("returning it to normal restores it", db.balance("member_1") === 12);

  db.returns.push({
    itemsAmount: "500.00",
    orderId: "order_1",
    replacementAmount: "0.00",
    status: "COMPLETED",
    storeId: STORE,
    type: "RETURN"
  });
  await reconcileOnly(db, "order_1");
  check("a completed partial return reverses its share", db.balance("member_1") === 7);

  await reconcileOnly(db, "order_1", { amountPerPoint: "50.00", live: true });
  check("a later rate change does not re-price it", db.balance("member_1") === 7);

  await changeOrder(db, "order_1", { status: "CANCELLED" }, NOT_LIVE);
  check("with the programme off, a cancellation still reverses", db.balance("member_1") === 0);

  await changeOrder(db, "order_1", { status: "COMPLETED" }, NOT_LIVE);
  check("with the programme off, re-completing earns nothing", db.balance("member_1") === 0);

  check(
    "every key is distinct and the ledger agrees with the balance",
    keysAreUnique(db) &&
      ledgerBalance(db.rows) === db.balance("member_1") &&
      firstBrokenLedgerLink(db.rows) === -1
  );
});

await scenario("who earns", async () => {
  const db = lifecycleDb();

  db.addOrder({ createdAt: after(-60_000), customerId: "customer_1", id: "order_early" });
  await changeOrder(db, "order_early", { status: "COMPLETED" });
  check("an order placed before the opt-in never earns", db.orderRows("order_early").length === 0);

  db.addOrder({ customerId: "customer_2", id: "order_guest" });
  await changeOrder(db, "order_guest", { status: "COMPLETED" });
  check("a customer who never opted in earns nothing", db.orderRows("order_guest").length === 0);

  db.coupons.push({ discountType: "FREE_SHIPPING", id: "coupon_fs", storeId: STORE });
  db.addOrder({
    couponId: "coupon_fs",
    createdAt: after(120_000),
    customerId: "customer_1",
    discountAmount: "70.00",
    id: "order_fs",
    subtotalAmount: "1000.00"
  });
  await changeOrder(db, "order_fs", { status: "COMPLETED" });
  check(
    "a free-shipping order earns on its full goods",
    db.orderRows("order_fs")[0]?.points === 10,
    String(db.orderRows("order_fs")[0]?.points)
  );
});

await scenario("store isolation and rollback", async () => {
  const db = lifecycleDb();

  const foreign = await changeOrder(db, "order_1", { status: "COMPLETED" }, LIVE, OTHER_STORE);
  check(
    "another store cannot complete or reconcile this order",
    foreign.plan.action === "none" &&
      db.orders.get("order_1")?.status === "PENDING" &&
      db.rows.length === 0
  );

  let failed = false;
  try {
    await db.transaction(async (client) => {
      await client.order.updateMany({
        data: { status: "COMPLETED" },
        where: { id: "order_1", storeId: STORE }
      });
      await reconcileOrderLoyalty(client, STORE, "order_1", LIVE);
      throw new Error("a later step in the same transaction failed");
    });
  } catch {
    failed = true;
  }
  check(
    "a failure after the points were written rolls back the status and the points",
    failed &&
      db.orders.get("order_1")?.status === "PENDING" &&
      db.rows.length === 0 &&
      db.balance("member_1") === 0
  );
});

await scenario("concurrent status changes", async () => {
  const db = lifecycleDb();

  await Promise.all([
    changeOrder(db, "order_1", { status: "COMPLETED" }),
    changeOrder(db, "order_1", { status: "COMPLETED" })
  ]);
  check(
    "two simultaneous completions earn once",
    db.balance("member_1") === 12 && db.rows.length === 1
  );

  for (const statuses of [
    ["CANCELLED", "COMPLETED", "PROCESSING", "COMPLETED", "CANCELLED", "COMPLETED"],
    ["COMPLETED", "CANCELLED", "COMPLETED", "CANCELLED", "PROCESSING", "CANCELLED"]
  ]) {
    await Promise.all(statuses.map((status) => changeOrder(db, "order_1", { status })));

    const final = db.orders.get("order_1")?.status;
    const expected = final === "COMPLETED" ? 12 : 0;

    check(
      `after ${statuses.length} racing changes ending ${final}, the points match the final status`,
      db.balance("member_1") === expected &&
        ledgerBalance(db.orderRows("order_1")) === expected &&
        keysAreUnique(db),
      `balance ${db.balance("member_1")}`
    );
  }

  // A return settling while the seller cancels: the settlement does not write
  // the order row itself, so only reconciliation's own lock keeps the two from
  // building the same key for two different corrections.
  await changeOrder(db, "order_1", { status: "COMPLETED" });
  db.returns.push({
    itemsAmount: "500.00",
    orderId: "order_1",
    replacementAmount: "0.00",
    status: "COMPLETED",
    storeId: STORE,
    type: "RETURN"
  });
  const racing = await Promise.allSettled([
    changeOrder(db, "order_1", { status: "CANCELLED" }),
    reconcileOnly(db, "order_1")
  ]);
  check(
    "a return settling during a cancellation: both succeed and the points end at zero",
    racing.every((result) => result.status === "fulfilled") &&
      ledgerBalance(db.orderRows("order_1")) === 0 &&
      keysAreUnique(db),
    racing
      .map((result) => (result.status === "fulfilled" ? "ok" : String(result.reason)))
      .join(", ")
  );
  db.returns.length = 0;

  db.addOrder({ createdAt: after(90_000), customerId: "customer_1", id: "order_2" });
  const before = db.balance("member_1") ?? 0;
  await Promise.all([
    changeOrder(db, "order_2", { status: "COMPLETED" }),
    reconcileOnly(db, "order_1")
  ]);
  check(
    "two orders of one member settle side by side",
    db.balance("member_1") === before + 12 && firstBrokenLedgerLink(db.rows) === -1
  );
});

console.log("\n=== Phase 2: lifecycle wiring ===");

const orderServiceCode = code(source.orderService);
const checkoutCode = code(source.checkoutService);
const ordersCode = code(source.orders);
const fakeCode = code(source.fakeOrderService);
const returnCode = code(source.returnService);
const manualCode = code(source.manualOrder);
const loyaltyServiceCode = code(source.service);

check(
  "a status change and its points are one transaction",
  /runWithOrderLoyalty\(storeId, orderId, \(tx\) =>\s*updateOrderStatusForStore\(storeId, orderId, status, tx\)/.test(
    orderServiceCode
  )
);
check(
  "the wrapper prepares outside the transaction and reconciles inside it",
  /const context = await prepareOrderLoyalty\(storeId\);\s*return prisma\.\$transaction\(async \(tx\) => \{\s*const result = await write\(tx\);\s*await reconcileOrderLoyalty\(tx, storeId, orderId, context\);/.test(
    loyaltyServiceCode
  )
);
check(
  "preparing creates the returns tables before any transaction",
  /export async function prepareOrderLoyalty[\s\S]*?ensureOrderReturnSchema\(\)/.test(
    loyaltyServiceCode
  )
);
check(
  "an order edit reconciles inside its own transaction",
  /const loyalty = await prepareOrderLoyalty\(storeId\);\s*const order = await prisma\.\$transaction/.test(
    orderServiceCode
  ) && orderServiceCode.includes("await reconcileOrderLoyalty(tx, storeId, orderId, loyalty)")
);
check(
  "a manual order created completed reconciles in its creating transaction",
  /data\.status === "COMPLETED" \? await prepareOrderLoyalty\(store\.id\) : null;\s*const order = await prisma\.\$transaction/.test(
    manualCode
  ) && manualCode.includes("await reconcileOrderLoyalty(tx, store.id, created.id, loyalty)")
);
check(
  "settling a return reconciles after the settlement, in the same transaction",
  /next === "COMPLETED" \? await prepareOrderLoyalty\(store\.id\) : null;\s*return prisma\.\$transaction/.test(
    returnCode
  ) &&
    returnCode.indexOf("await reconcileOrderLoyalty(tx, store.id, request.orderId, loyalty)") >
      returnCode.indexOf("await projectSettlementOntoOrder(tx, store.id, request.orderId)")
);
check(
  "fake-order decisions run their DDL before the transaction that reconciles",
  /await ensureFakeOrderRiskSchema\(\);\s*return runWithOrderLoyalty\(storeId, orderId, \(tx\) =>\s*updateOrderVerificationStatus\(storeId, orderId, status, tx\)/.test(
    fakeCode
  )
);
check(
  "all four verification decisions go through it",
  (fakeCode.match(/decideVerification\(storeId, orderId, "/g) ?? []).length === 4 &&
    (fakeCode.match(/updateOrderVerificationStatus\(/g) ?? []).length === 1
);

const statusWriters = readdirSync(MODULES, { recursive: true })
  .map(String)
  .filter((name) => /\.tsx?$/.test(name) && !name.endsWith("order.repository.ts"))
  .filter((name) => code(read(join(MODULES, name))).includes("updateOrderStatusForStore("));
check(
  "nothing but updateOrderStatus writes an order's status after placement",
  statusWriters.length === 1 && /order\.service\.ts$/.test(statusWriters[0] ?? ""),
  statusWriters.join(", ")
);
check(
  "the order row is locked before its ledger rows are read",
  ordersCode.indexOf("client.order.updateMany(") > -1 &&
    ordersCode.indexOf("client.order.updateMany(") <
      ordersCode.indexOf("client.loyaltyTransaction.findMany(")
);
check(
  "reconciliation never opens a transaction or reaches a self-healing DDL",
  !/\$transaction|ensure\w*Schema/.test(ordersCode)
);
check(
  "enrolment never raises a duplicate inside the checkout transaction",
  ordersCode.includes("skipDuplicates: true") && !ordersCode.includes("loyaltyMember.create(")
);
check(
  "checkout decides enrolment before its transaction, from the shopper's tick and the live programme",
  checkoutCode.indexOf("shouldEnrollAtCheckout(") > -1 &&
    checkoutCode.indexOf("shouldEnrollAtCheckout(") <
      checkoutCode.indexOf("const { enrollment, order } = await prisma.$transaction")
);
check(
  "checkout enrols only on the shopper's own tick",
  /data\.loyaltyOptIn === true &&\s*shouldEnrollAtCheckout\(data\.loyaltyOptIn, await getLoyaltyCapability\(store\.id\)\)/.test(
    checkoutCode
  )
);
check(
  "checkout enrols as of the order it is placing",
  checkoutCode.includes("enrolledAt: created.createdAt")
);
check(
  "a conflict is reported after the order has committed",
  checkoutCode.indexOf("reportLoyaltyEnrollmentConflict(") >
    checkoutCode.indexOf("return { enrollment: enrolled, order: created };")
);
check(
  "the opt-in is an optional boolean, posted only by the box itself",
  source.checkoutSchema.includes("loyaltyOptIn: z.boolean().optional()") &&
    source.checkoutRoute.includes('loyaltyOptIn: getValue(formData, "loyaltyOptIn") === "on"')
);
check(
  "the box starts unticked and is drawn only for a running programme",
  source.checkoutForm.includes('<input name="loyaltyOptIn" type="checkbox" value="on" />') &&
    source.checkoutForm.includes("{loyaltyOffer ? <CheckoutLoyaltyOptIn") &&
    source.checkoutPage.includes("getCheckoutLoyaltyOffer(store.id)")
);
check("the AI Shopping Agent never opts anyone in", !source.shoppingAgent.includes("loyaltyOptIn"));

console.log("\n=== Phase 3: adjustment, paging and access rules ===");

const adjustment = {
  memberId: "member_1",
  points: "50",
  reason: "Points for an order placed under another number",
  requestId: "6f1c2a9e-0b8d-4d6e-9a51-2f6a3c1b7e44"
};

const parsedAdjustment = loyaltyAdjustmentSchema.safeParse(adjustment);
check(
  "a well-formed adjustment parses to a whole number",
  parsedAdjustment.success && parsedAdjustment.data.points === 50
);
check(
  "a deduction parses",
  loyaltyAdjustmentSchema.safeParse({ ...adjustment, points: "-20" }).success
);
check(
  `the largest adjustment, ${LOYALTY_ADJUSTMENT_MAX}, is accepted either way`,
  loyaltyAdjustmentSchema.safeParse({ ...adjustment, points: String(LOYALTY_ADJUSTMENT_MAX) })
    .success &&
    loyaltyAdjustmentSchema.safeParse({ ...adjustment, points: String(-LOYALTY_ADJUSTMENT_MAX) })
      .success
);

const badAdjustments: Array<[string, Partial<typeof adjustment>]> = [
  ["zero points", { points: "0" }],
  ["fractional points", { points: "1.5" }],
  ["words for points", { points: "fifty" }],
  ["an empty amount", { points: "" }],
  ["one point past the maximum", { points: String(LOYALTY_ADJUSTMENT_MAX + 1) }],
  ["one point past the maximum, negative", { points: String(-LOYALTY_ADJUSTMENT_MAX - 1) }],
  ["exponent notation", { points: "1e3" }],
  ["an empty reason", { reason: "" }],
  ["a whitespace reason", { reason: " \n\t " }],
  ["a two-letter reason", { reason: "ok" }],
  ["a reason past the limit", { reason: "x".repeat(LOYALTY_NOTE_MAX + 1) }],
  ["a malformed member id", { memberId: "member 1; DROP" }],
  ["a malformed request id", { requestId: "not a key!" }]
];

for (const [label, overrides] of badAdjustments) {
  check(
    `an adjustment with ${label} is refused`,
    !loyaltyAdjustmentSchema.safeParse({ ...adjustment, ...overrides }).success
  );
}

const cleanedReason = loyaltyAdjustmentSchema.safeParse({
  ...adjustment,
  reason: "  Goodwill \n credit\u0007 "
});
check(
  "a reason is kept to one trimmed line",
  cleanedReason.success && cleanedReason.data.reason === "Goodwill credit",
  cleanedReason.success ? JSON.stringify(cleanedReason.data.reason) : "refused"
);

const adjustmentEntry = parsedAdjustment.success
  ? adjustmentLedgerEntry(parsedAdjustment.data, "user_owner")
  : null;
check(
  "an adjustment becomes an ADJUSTMENT from a MANUAL source, naming who and why",
  adjustmentEntry?.type === "ADJUSTMENT" &&
    adjustmentEntry.sourceType === "MANUAL" &&
    adjustmentEntry.actorUserId === "user_owner" &&
    adjustmentEntry.note === adjustment.reason &&
    adjustmentEntry.idempotencyKey === `manual:${adjustment.requestId}:adjust:0` &&
    loyaltyLedgerEntrySchema.safeParse(adjustmentEntry).success
);

check(
  "adding points and resuming need the plan; deducting, suspending and resolving do not",
  memberActionNeedsPlan("add-points") &&
    memberActionNeedsPlan("resume") &&
    !memberActionNeedsPlan("deduct-points") &&
    !memberActionNeedsPlan("suspend") &&
    !memberActionNeedsPlan("resolve-conflict")
);
check(
  "status reads off suspendedAt",
  loyaltyMembershipStatus({ suspendedAt: null }) === "ACTIVE" &&
    loyaltyMembershipStatus({ suspendedAt: new Date() }) === "SUSPENDED"
);

const searchCases: Array<[string, string | null]> = [
  ["+8801712", "1712"],
  ["01712345678", "1712345678"],
  ["1712", "1712"],
  ["017-12", "1712"],
  ["12", null],
  ["Rahim", null],
  ["", null]
];

for (const [query, expected] of searchCases) {
  check(
    `searching ${JSON.stringify(query)} matches phone digits ${String(expected)}`,
    loyaltyPhoneSearchDigits(query) === expected,
    String(loyaltyPhoneSearchDigits(query))
  );
}
check(
  "a folded search fragment is found inside the stored key",
  "01712345678".includes(loyaltyPhoneSearchDigits("+880 1712-34") ?? "missing")
);

check("an empty page has no next page", !splitLookaheadPage([], 3).hasMore);
check(
  "exactly a page has no next page",
  (() => {
    const result = splitLookaheadPage(["a", "b", "c"], 3);

    return !result.hasMore && result.page.length === 3;
  })()
);
check(
  "one row past a page means a next page, and the extra row is not shown",
  (() => {
    const result = splitLookaheadPage(["a", "b", "c", "d"], 3);

    return result.hasMore && JSON.stringify(result.page) === '["a","b","c"]';
  })()
);

const SUSPENDED_MEMBER = { ...MEMBER, suspendedAt: new Date() };
const suspendedCases: Array<[string, OrderLoyaltyFacts, string]> = [
  [
    "a suspended member's completed order earns nothing",
    facts({ member: SUSPENDED_MEMBER }),
    "none:suspended"
  ],
  [
    "a suspended member's cancelled order still gives its points back",
    facts({ lines: [earnLine(12)], member: SUSPENDED_MEMBER, order: { status: "CANCELLED" } }),
    "EARN_REVERSAL -12 order:order_1:earn:1"
  ],
  [
    "a suspended member does not re-earn a re-completed order",
    facts({ lines: [earnLine(12), earnLine(-12, "EARN_REVERSAL")], member: SUSPENDED_MEMBER }),
    "none:suspended"
  ],
  [
    "resumed, the same order earns again",
    facts({ lines: [earnLine(12), earnLine(-12, "EARN_REVERSAL")] }),
    "EARN 12 order:order_1:earn:2"
  ]
];

for (const [label, input, expected] of suspendedCases) {
  const actual = describePlan(input);

  check(label, actual === expected, `expected ${expected}, got ${actual}`);
}

console.log("\n=== Phase 3: ledger order and manual adjustments against the model ===");

await scenario("ledger sequence", async () => {
  const db = new FakeLedgerDb();
  db.addMember("member_1", STORE);

  for (const index of [1, 2, 3]) {
    await write(db, orderEntry(`order_s${index}`, index * 10, "EARN", "earn"));
  }
  check(
    "sequential entries are numbered 1, 2, 3",
    JSON.stringify(db.rows.map((row) => row.sequence)) === "[1,2,3]" &&
      db.members.get("member_1")?.ledgerSequence === 3
  );

  const duplicate = orderEntry("order_dup", 5, "EARN", "earn");
  await Promise.all([write(db, duplicate), write(db, duplicate)]);
  check(
    "a replay caught behind the lock gives its number back",
    db.rows.length === 4 &&
      db.members.get("member_1")?.ledgerSequence === 4 &&
      db.rows.at(-1)?.sequence === 4
  );

  await Promise.all(
    Array.from({ length: 12 }, (_, index) =>
      write(db, orderEntry(`order_c${index}`, index + 1, "EARN", "earn"))
    )
  );
  const bySequence = [...db.rows].sort((a, b) => a.sequence - b.sequence);
  check(
    "concurrent entries get distinct, gapless numbers",
    JSON.stringify(bySequence.map((row) => row.sequence)) ===
      JSON.stringify(Array.from({ length: 16 }, (_, index) => index + 1)) &&
      db.members.get("member_1")?.ledgerSequence === 16
  );
  check(
    "read in sequence order, every balance-after follows from the one before",
    firstBrokenLedgerLink(bySequence) === -1 && ledgerBalance(db.rows) === db.balance("member_1")
  );
});

await scenario("manual adjustments", async () => {
  const db = new FakeLedgerDb();
  db.addMember("member_1", STORE, 30);
  db.addMember("member_2", OTHER_STORE, 30);

  const entry = (points: number, requestId: string, memberId = "member_1") =>
    ledgerEntry(
      adjustmentLedgerEntry(
        { memberId, points, reason: "Goodwill credit", requestId },
        "user_owner"
      )
    );

  const added = await write(db, entry(20, "req-1"));
  check(
    "an adjustment lands with who made it and why",
    added.applied &&
      db.balance("member_1") === 50 &&
      added.transaction.actorUserId === "user_owner" &&
      added.transaction.note === "Goodwill credit" &&
      added.transaction.type === "ADJUSTMENT"
  );

  const again = await write(db, entry(20, "req-1"));
  check(
    "the same form submitted twice is one adjustment",
    !again.applied && db.balance("member_1") === 50 && db.rows.length === 1
  );

  const twice = await Promise.all([write(db, entry(5, "req-2")), write(db, entry(5, "req-2"))]);
  check(
    "a double click is one adjustment",
    twice.filter((result) => result.applied).length === 1 && db.balance("member_1") === 55
  );

  check(
    "reusing a spent request id for a different amount is refused",
    (await failureCode(write(db, entry(999, "req-1")))) === "IDEMPOTENCY_CONFLICT" &&
      db.balance("member_1") === 55
  );
  check(
    "a deduction cannot take the balance below zero",
    (await failureCode(write(db, entry(-56, "req-3")))) === "INSUFFICIENT_POINTS" &&
      db.balance("member_1") === 55
  );

  const toZero = await write(db, entry(-55, "req-4"));
  check("a deduction to exactly zero is allowed", toZero.applied && db.balance("member_1") === 0);

  check(
    "another store's member cannot be adjusted through this store",
    (await failureCode(write(db, entry(10, "req-5", "member_2")))) === "MEMBER_NOT_FOUND" &&
      db.balance("member_2") === 30
  );
});

await scenario("negative balances and manual adjustments", async () => {
  const db = new FakeLedgerDb();
  db.addMember("member_1", STORE, 10);

  await write(db, orderEntry("order_n", -40, "EARN_REVERSAL", "earn", 1));
  check("an earn reversal may leave the balance negative", db.balance("member_1") === -30);

  const deduct = ledgerEntry(
    adjustmentLedgerEntry(
      { memberId: "member_1", points: -1, reason: "Test", requestId: "req-n1" },
      "user_owner"
    )
  );
  check(
    "a manual deduction from a negative balance is refused",
    (await failureCode(write(db, deduct))) === "INSUFFICIENT_POINTS" &&
      db.balance("member_1") === -30
  );

  const credit = ledgerEntry(
    adjustmentLedgerEntry(
      { memberId: "member_1", points: 30, reason: "Write off the debt", requestId: "req-n2" },
      "user_owner"
    )
  );
  check(
    "a manual credit can bring a negative balance back",
    (await write(db, credit)).applied && db.balance("member_1") === 0
  );
});

await scenario("suspension and earning", async () => {
  const db = lifecycleDb();
  const member = db.members.get("member_1");

  if (member) member.suspendedAt = new Date();
  await changeOrder(db, "order_1", { status: "COMPLETED" });
  check("a suspended member's completed order earns nothing", db.rows.length === 0);

  if (member) member.suspendedAt = null;
  await changeOrder(db, "order_1", { status: "COMPLETED" });
  check("resumed, the next change to the order earns it", db.balance("member_1") === 12);

  if (member) member.suspendedAt = new Date();
  await changeOrder(db, "order_1", { status: "CANCELLED" });
  check(
    "suspended, a cancellation still reverses — and the history is kept",
    db.balance("member_1") === 0 && db.rows.length === 2
  );
});

console.log("\n=== Phase 3: members pages, conflicts and customers ===");

const repositoryCode = code(source.repository);
const ledgerCode = code(source.ledger);
const phase3ServiceCode = code(source.service);
const phase3ActionCode = code(source.actions);

check(
  "the members list walks by cursor, newest first, with id as the tiebreak",
  /listLoyaltyMembersPage[\s\S]*?orderBy: \[\{ enrolledAt: "desc" \}, \{ id: "desc" \}\][\s\S]*?cursor: \{ id: query\.cursor \}, skip: 1/.test(
    repositoryCode
  )
);
check(
  "a page reads one row of look-ahead, never the whole membership",
  phase3ServiceCode.includes("take: MEMBER_PAGE_SIZE + 1") &&
    phase3ServiceCode.includes("take: LEDGER_PAGE_SIZE + 1")
);
check(
  "a cursor naming another store's member is dropped, not followed",
  /input\.cursor &&[\s\S]*?\(await findLoyaltyMemberInStore\(storeId, input\.cursor\)\)/.test(
    phase3ServiceCode
  )
);
check(
  "history is ordered by sequence and never by createdAt",
  /orderBy: \{\s*sequence: "desc"\s*\}/.test(
    functionBody(repositoryCode, "listLoyaltyLedgerPage")
  ) && !/orderBy: \{\s*createdAt/.test(functionBody(repositoryCode, "listLoyaltyLedgerPage"))
);
check(
  "the sequence moves in the same statement as the balance, and is what the row records",
  /ledgerSequence: \{\s*increment: 1\s*\},\s*pointsBalance: \{\s*increment: entry\.points/.test(
    ledgerCode
  ) && ledgerCode.includes("sequence: member.ledgerSequence")
);
check(
  "a replay gives the sequence back with the points",
  /ledgerSequence: \{\s*decrement: 1\s*\},\s*pointsBalance: \{\s*decrement: entry\.points/.test(
    ledgerCode
  )
);
check(
  "nothing in the actions or pages can edit or delete a ledger row",
  !/loyaltyTransaction/.test(phase3ActionCode + code(source.memberPage) + code(source.membersPage))
);
check(
  "an adjustment's author is the session's user, never the form's",
  phase3ActionCode.includes("{ storeId: access.store.id, userId: access.userId }") &&
    phase3ActionCode.includes("adjustLoyaltyPoints(context.storeId, context.userId,")
);
check(
  "adding points is gated on the plan and deducting is not",
  /memberActionNeedsPlan\(adjustment\.points > 0 \? "add-points" : "deduct-points"\)\) \{\s*await requirePlanFeature\(storeId, "loyalty"\)/.test(
    phase3ServiceCode
  )
);
check(
  "resuming is gated on the plan and suspending is not",
  /memberActionNeedsPlan\(suspended \? "suspend" : "resume"\)\) \{\s*await requirePlanFeature\(storeId, "loyalty"\)/.test(
    phase3ServiceCode
  )
);
check(
  "the adjustment form gets a server-minted request id, renewed only after a result",
  source.memberPage.includes("requestId={randomUUID()}") &&
    !/nextRequestId: randomUUID\(\)[\s\S]{0,40}INSUFFICIENT_POINTS/.test(phase3ActionCode) &&
    phase3ActionCode.includes("nextRequestId: randomUUID()")
);
check(
  "suspending and resuming only ever move from the opposite state, and touch no balance",
  functionBody(repositoryCode, "setLoyaltyMemberSuspended").includes(
    "suspendedAt: suspended ? null : { not: null }"
  ) && !functionBody(repositoryCode, "setLoyaltyMemberSuspended").includes("pointsBalance")
);
check(
  "suspend, resume and resolve leave an audit line naming who",
  ["setLoyaltyMembershipSuspended", "resolveLoyaltyConflict"].every(
    (name) =>
      (functionBody(phase3ServiceCode, name).match(/await logLoyaltyAudit\(\{/g) ?? []).length === 1
  ) && /userId: input\.userId/.test(functionBody(phase3ServiceCode, "logLoyaltyAudit"))
);
check(
  "conflict reads refuse anyone who cannot manage, in the service itself",
  functionBody(phase3ServiceCode, "getUnresolvedLoyaltyConflicts").includes(
    "assertCanManage(viewer)"
  ) &&
    functionBody(phase3ServiceCode, "getUnresolvedLoyaltyConflictCount").includes(
      "assertCanManage(viewer)"
    )
);
check(
  "the conflicts page fetches nothing for a member",
  source.conflictsPage.indexOf("if (!access.canManage)") > -1 &&
    source.conflictsPage.indexOf("if (!access.canManage)") <
      source.conflictsPage.indexOf("getUnresolvedLoyaltyConflicts(")
);
check(
  "the members page counts conflicts only for owners and admins",
  /access\.canManage\s*\?\s*getUnresolvedLoyaltyConflictCount\(access, access\.store\.id\)/.test(
    source.membersPage
  )
);
check(
  "a conflict shows names and phone numbers only — no email, address or order contents",
  (() => {
    const select =
      /export function listUnresolvedLoyaltyConflicts[\s\S]*?\n\}/.exec(repositoryCode)?.[0] ?? "";

    return select.length > 0 && !/email|address|items|total/i.test(select);
  })()
);
check(
  "an enrolment conflict is filed in its table, reopening a resolved one",
  functionBody(phase3ServiceCode, "reportLoyaltyEnrollmentConflict").includes(
    "upsertLoyaltyConflict(conflict)"
  ) &&
    /occurrences: \{\s*increment: 1\s*\}/.test(
      functionBody(repositoryCode, "upsertLoyaltyConflict")
    ) &&
    functionBody(repositoryCode, "upsertLoyaltyConflict").includes("resolvedAt: null") &&
    functionBody(repositoryCode, "upsertLoyaltyConflict").includes("resolvedByUserId: null")
);
check(
  "resolving is recorded once and only from unresolved",
  /resolvedByUserId: userId[\s\S]*?resolvedAt: null,\s*storeId/.test(
    functionBody(repositoryCode, "resolveLoyaltyConflictRecord")
  )
);
check(
  "a member's own page is a 404 for another store's id, and its controls are owner-only",
  source.memberPage.includes("getLoyaltyMemberDetail(access.store.id, memberId)") &&
    source.memberPage.includes("notFound()") &&
    /access\.canManage \? \(\s*<LoyaltyMemberActions/.test(source.memberPage)
);
check(
  "the customer list joins the membership in its one query",
  /getCustomerRecordsForStore[\s\S]*?loyaltyMember: \{\s*select: \{\s*pointsBalance: true,\s*storeId: true,\s*suspendedAt: true/.test(
    code(source.customerRepository)
  )
);
check(
  "a customer with no membership, or another store's, shows no points",
  /customer\.loyaltyMember && customer\.loyaltyMember\.storeId === storeId[\s\S]*?: null/.test(
    code(source.customerService)
  ) && source.customerDashboard.includes(': "—"}')
);
check(
  "the sidebar links the members page, badged and open to members",
  source.nav.includes('href: "/dashboard/marketing/loyalty/members"') &&
    source.nav.includes('"/dashboard/marketing/loyalty/members": "loyalty"') &&
    managerOnlyHrefs() !== undefined &&
    !managerOnlyHrefs()?.includes("/dashboard/marketing/loyalty")
);
check(
  "every loyalty write is still manager-only",
  /\brequireStoreManager\(/.test(phase3ActionCode) &&
    !/\brequireStore\(/.test(phase3ActionCode) &&
    source.staffPermissions.includes('"loyalty/loyalty.actions.ts": "manager"')
);

/** One function of a module, from its signature to its closing brace at the margin. */
function functionBody(text: string, name: string) {
  // The closing brace alone on its line: a multi-line parameter type also
  // closes at the margin, but as `}) {`, which must not end the match.
  return (
    new RegExp(`(?:export )?(?:async )?function ${name}\\b[\\s\\S]*?\\n\\}(?=\\r?\\n|$)`).exec(
      text
    )?.[0] ?? ""
  );
}

function managerOnlyHrefs() {
  return /MANAGER_ONLY_HREFS[^=]*= new Set\(\[([\s\S]*?)\]\)/.exec(source.nav)?.[1];
}

console.log("\n=== Phase 4: redemption rules ===");

check(
  "redemption is off by default, at 1 point = 1, a 100-point minimum and a 50% cap",
  LOYALTY_SETTINGS_DEFAULTS.redemptionEnabled === false &&
    LOYALTY_SETTINGS_DEFAULTS.pointValue === "1.00" &&
    LOYALTY_SETTINGS_DEFAULTS.minRedeemPoints === 100 &&
    LOYALTY_SETTINGS_DEFAULTS.maxRedeemPercent === 50
);

const redeemSettings = loyaltySettingsSchema.safeParse({ ...settingsInput, pointValue: "1" });
check(
  "a point value is stored to two places",
  redeemSettings.success && redeemSettings.data.pointValue === "1.00"
);

for (const [label, overrides] of [
  ["a zero point value", { pointValue: "0" }],
  ["a point value with three places", { pointValue: "0.125" }],
  ["a zero minimum", { minRedeemPoints: "0" }],
  ["a fractional minimum", { minRedeemPoints: "10.5" }],
  ["a zero cap", { maxRedeemPercent: "0" }],
  ["a cap over 100%", { maxRedeemPercent: "101" }],
  ["a fractional cap", { maxRedeemPercent: "12.5" }]
] as const) {
  check(
    `settings with ${label} are refused`,
    !loyaltySettingsSchema.safeParse({ ...settingsInput, ...overrides }).success
  );
}

check(
  "redemption is live only with the programme, the plan and its own switch",
  loyaltyRedemptionLive(loyaltyCapability(true, true), true) &&
    !loyaltyRedemptionLive(loyaltyCapability(true, true), false) &&
    !loyaltyRedemptionLive(loyaltyCapability(false, true), true) &&
    !loyaltyRedemptionLive(loyaltyCapability(true, false), true)
);

const POLICY: RedemptionPolicy = { maxRedeemPercent: 50, minRedeemPoints: 100, pointValue: "1.00" };
const limitCases: Array<[string, number, number, RedemptionPolicy, number, boolean]> = [
  // label, balance, eligible cents, policy, expected max points, available
  ["the balance limits a big order", 500, 125_000, POLICY, 500, true],
  ["the 50% cap limits a big balance", 1_000, 125_000, POLICY, 625, true],
  ["half of 199.99 is 99.99, so 99 points — under the minimum", 1_000, 19_999, POLICY, 99, false],
  [
    "a 0.30 point rounds down: 50.00 takes 166, not 167",
    1_000,
    10_000,
    { ...POLICY, minRedeemPoints: 1, pointValue: "0.30" },
    166,
    true
  ],
  [
    "a 33% cap of 100.01 is 33.00, not 33.0033",
    10_000,
    10_001,
    { ...POLICY, maxRedeemPercent: 33, minRedeemPoints: 1 },
    3_300 / 100,
    true
  ],
  [
    "a 100% cap can cover all the goods",
    2_000,
    100_000,
    { ...POLICY, maxRedeemPercent: 100 },
    1_000,
    true
  ],
  ["a balance below the minimum cannot redeem", 99, 125_000, POLICY, 99, false],
  ["a negative balance cannot redeem", -30, 125_000, POLICY, 0, false],
  ["an order with no goods cannot redeem", 1_000, 0, POLICY, 0, false],
  ["a zero point value cannot redeem", 1_000, 125_000, { ...POLICY, pointValue: "0" }, 0, false]
];

for (const [label, balance, eligibleGoodsCents, policy, maxPoints, available] of limitCases) {
  const limits = redemptionLimits({ balance, eligibleGoodsCents, policy });

  check(
    label,
    limits.maxPoints === maxPoints && limits.available === available,
    `max ${limits.maxPoints}, available ${limits.available}`
  );
}

const fiveHundred = redemptionLimits({ balance: 500, eligibleGoodsCents: 125_000, policy: POLICY });
const exact = checkRedemption(300, fiveHundred);
check(
  "300 points at 1.00 take exactly 300.00 off",
  exact.ok && exact.discountCents === 30_000 && exact.points === 300
);
check("below the minimum is refused", !checkRedemption(99, fiveHundred).ok);
check("above the most this order allows is refused", !checkRedemption(501, fiveHundred).ok);
check(
  "a fractional, zero or negative count is refused",
  !checkRedemption(150.5, fiveHundred).ok &&
    !checkRedemption(0, fiveHundred).ok &&
    !checkRedemption(-5, fiveHundred).ok
);
check(
  "the minimum and the maximum themselves are allowed",
  checkRedemption(100, fiveHundred).ok && checkRedemption(500, fiveHundred).ok
);

check(
  "points are capped on goods after a goods coupon",
  loyaltyEarningBaseCents(amounts({ discountAmount: "200.00", subtotalAmount: "1000.00" })) ===
    80_000
);
check(
  "a free-shipping coupon does not shrink what points may cover",
  loyaltyEarningBaseCents(
    amounts({ couponCoversShipping: true, discountAmount: "70.00", subtotalAmount: "1000.00" })
  ) === 100_000
);
check(
  "a points-paid order earns on its goods less the points",
  describePlan(facts({ order: { loyaltyDiscountAmount: "200.00" } })) ===
    "EARN 10 order:order_1:earn:0"
);

const redeemLine = (points: number, type: Line["type"] = "REDEEM"): Line => ({
  amountPerPoint: null,
  memberId: "member_1",
  points,
  type
});
const redemptionCases: Array<[string, Pick<OrderLoyaltyFacts, "lines" | "order">, string]> = [
  ["an order that spent nothing has nothing to reconcile", facts(), "none:no-redemption"],
  [
    "a standing order keeps its points spent",
    facts({ lines: [redeemLine(-200)], order: { status: "PENDING" } }),
    "none:already-reconciled"
  ],
  [
    "cancelling gives the points back once",
    facts({ lines: [redeemLine(-200)], order: { status: "CANCELLED" } }),
    "REDEEM_REVERSAL 200 order:order_1:redeem:1"
  ],
  [
    "cancelling twice gives them back once",
    facts({
      lines: [redeemLine(-200), redeemLine(200, "REDEEM_REVERSAL")],
      order: { status: "CANCELLED" }
    }),
    "none:already-reconciled"
  ],
  [
    "completing it again spends them again, under a new key",
    facts({ lines: [redeemLine(-200), redeemLine(200, "REDEEM_REVERSAL")] }),
    "REDEEM -200 order:order_1:redeem:2"
  ],
  [
    "a return does not give points back",
    facts({ lines: [redeemLine(-200)], returns: [settled("RETURN", "500.00")] }),
    "none:already-reconciled"
  ],
  [
    "a full refund does not give points back",
    facts({ lines: [redeemLine(-200)], returns: [settled("REFUND", "1250.00")] }),
    "none:already-reconciled"
  ],
  [
    "earning rows on the same order are not counted as spending",
    facts({ lines: [earnLine(12), redeemLine(-200)], order: { status: "CANCELLED" } }),
    "REDEEM_REVERSAL 200 order:order_1:redeem:1"
  ]
];

for (const [label, input, expected] of redemptionCases) {
  const plan = planOrderRedemption(input);
  const actual =
    plan.action === "write"
      ? `${plan.correction.type} ${plan.correction.points} ${plan.correction.idempotencyKey}`
      : `none:${plan.reason}`;

  check(label, actual === expected, `expected ${expected}, got ${actual}`);
}
check(
  "an order's checkout debit has one key, ever",
  checkoutRedemptionKey("order_1") === "order:order_1:redeem:0"
);

const SECRET = "verify-secret";
const NOW = 1_800_000_000_000;
const token = signRedemptionToken(
  { memberId: "member_1", phoneKey: "01712345678", storeId: STORE, submissionId: "sub_A" },
  NOW,
  SECRET
);
const claim = readRedemptionToken(token, NOW + 60_000, SECRET);
check(
  "a token reads back the member, number and store it was issued for",
  claim?.memberId === "member_1" &&
    claim.phoneKey === "01712345678" &&
    claim.storeId === STORE &&
    claim.submissionId === "sub_A"
);
check(
  "a token expires after half an hour",
  readRedemptionToken(token, NOW + 30 * 60_000 + 1, SECRET) === null
);
check(
  "a token signed with another secret is refused",
  readRedemptionToken(token, NOW, "another-secret") === null
);
check(
  "a token whose payload was edited is refused",
  (() => {
    const [payload, signature] = token.split(".");
    const edited = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(payload ?? "", "base64url").toString()),
        m: "member_2"
      })
    ).toString("base64url");

    return readRedemptionToken(`${edited}.${signature}`, NOW, SECRET) === null;
  })()
);
check(
  "a signature made without the loyalty domain — a cart cookie's, say — is refused",
  (() => {
    const [payload] = token.split(".");
    const cartStyle = createHmac("sha256", SECRET)
      .update(payload ?? "")
      .digest("base64url");

    return readRedemptionToken(`${payload}.${cartStyle}`, NOW, SECRET) === null;
  })()
);
check(
  "garbage, an empty string and extra segments are refused",
  readRedemptionToken("garbage", NOW, SECRET) === null &&
    readRedemptionToken("", NOW, SECRET) === null &&
    readRedemptionToken(`${token}.extra`, NOW, SECRET) === null
);

console.log("\n=== Phase 4: redemption against the model ===");

function redemptionDb(balance: number, extra: { suspendedAt?: Date | null } = {}) {
  const db = new FakeLedgerDb();

  db.addMember("member_1", STORE, balance, {
    customerId: "customer_1",
    enrolledAt: ENROLLED_AT,
    phoneKey: "01712345678",
    ...(extra.suspendedAt === undefined ? {} : { suspendedAt: extra.suspendedAt })
  });
  db.addMember("member_x", OTHER_STORE, 9_999, { customerId: "customer_x" });

  return db;
}

/** One checkout's points, as `createCheckoutOrder` runs them: price, place, debit. */
function checkoutWithPoints(
  db: FakeLedgerDb,
  input: {
    customerId?: string;
    failAfterDebit?: boolean;
    memberId?: string;
    orderId: string;
    points: number;
  }
) {
  return db.transaction(async (client) => {
    const priced = await priceCheckoutRedemption(client, {
      customerId: input.customerId ?? "customer_1",
      eligibleGoodsCents: 125_000,
      memberId: input.memberId ?? "member_1",
      points: input.points,
      policy: POLICY,
      storeId: STORE
    });

    await debitCheckoutRedemption(client, STORE, {
      memberId: priced.memberId,
      orderId: input.orderId,
      points: priced.points
    });

    if (input.failAfterDebit) {
      throw new Error("the order insert failed after the points were spent");
    }

    return priced;
  });
}

await scenario("pricing and spending at checkout", async () => {
  const db = redemptionDb(500);

  const priced = await checkoutWithPoints(db, { orderId: "order_r1", points: 300 });
  check(
    "a valid redemption is priced from the points and spent once",
    priced.discountCents === 30_000 &&
      db.balance("member_1") === 200 &&
      db.rows.length === 1 &&
      db.rows[0]?.type === "REDEEM"
  );

  const replay = await db.transaction((client) =>
    debitCheckoutRedemption(client, STORE, {
      memberId: "member_1",
      orderId: "order_r1",
      points: 300
    })
  );
  check(
    "the same order can never be debited twice",
    !replay.applied && db.balance("member_1") === 200
  );

  check(
    "spending more than the balance is refused before anything is written",
    (await failureCode(checkoutWithPoints(db, { orderId: "order_r2", points: 250 }))) ===
      "INSUFFICIENT_POINTS" &&
      db.balance("member_1") === 200 &&
      db.rows.length === 1
  );
  check(
    "a different customer record on the same membership is refused, not merged",
    (await failureCode(
      checkoutWithPoints(db, { customerId: "customer_2", orderId: "order_r3", points: 100 })
    )) === "FORBIDDEN" && db.balance("member_1") === 200
  );
  check(
    "another store's member cannot be spent through this store",
    (await failureCode(
      checkoutWithPoints(db, {
        customerId: "customer_x",
        memberId: "member_x",
        orderId: "order_r4",
        points: 100
      })
    )) === "MEMBER_NOT_FOUND" && db.balance("member_x") === 9_999
  );

  check(
    "a failure after the debit rolls the points back with the order",
    (
      await failureCode(
        checkoutWithPoints(db, { failAfterDebit: true, orderId: "order_r5", points: 100 })
      )
    ).startsWith("unexpected") &&
      db.balance("member_1") === 200 &&
      db.rows.length === 1
  );
});

await scenario("a suspended member", async () => {
  const db = redemptionDb(500, { suspendedAt: new Date() });

  check(
    "a suspended member cannot spend",
    (await failureCode(checkoutWithPoints(db, { orderId: "order_s1", points: 100 }))) ===
      "FORBIDDEN" && db.balance("member_1") === 500
  );
});

await scenario("concurrent checkouts on one balance", async () => {
  const db = redemptionDb(300);

  const outcomes = await Promise.allSettled([
    checkoutWithPoints(db, { orderId: "order_c1", points: 200 }),
    checkoutWithPoints(db, { orderId: "order_c2", points: 200 })
  ]);
  check(
    "two checkouts spending the same points: one lands, one is refused, no overdraft",
    outcomes.filter((outcome) => outcome.status === "fulfilled").length === 1 &&
      db.balance("member_1") === 100 &&
      db.rows.length === 1,
    `balance ${db.balance("member_1")}`
  );
});

await scenario("a points-paid order's life", async () => {
  const db = lifecycleDb();
  const member = db.members.get("member_1");

  if (member) member.pointsBalance = 500;
  db.orders.get("order_1")!.loyaltyDiscountAmount = "200.00";
  await db.transaction((client) =>
    debitCheckoutRedemption(client, STORE, {
      memberId: "member_1",
      orderId: "order_1",
      points: 200
    })
  );

  await changeOrder(db, "order_1", { status: "COMPLETED" });
  check(
    "completing earns on the goods less the points (1,050 → 10)",
    db.balance("member_1") === 310,
    String(db.balance("member_1"))
  );

  db.returns.push({
    itemsAmount: "500.00",
    orderId: "order_1",
    replacementAmount: "0.00",
    status: "COMPLETED",
    storeId: STORE,
    type: "RETURN"
  });
  await reconcileOnly(db, "order_1");
  check(
    "a partial return reverses earned points and leaves the spend alone",
    db.balance("member_1") === 305 &&
      db.orderRows("order_1").filter((row) => row.type === "REDEEM_REVERSAL").length === 0,
    String(db.balance("member_1"))
  );
  db.returns.length = 0;

  await changeOrder(db, "order_1", { status: "CANCELLED" }, NOT_LIVE);
  check(
    "cancelling — even with the programme off — returns the spend and reverses the earning",
    db.balance("member_1") === 500,
    String(db.balance("member_1"))
  );

  await changeOrder(db, "order_1", { status: "CANCELLED" });
  check("cancelling again changes nothing", db.balance("member_1") === 500);

  if (member) member.pointsBalance = 50;
  check(
    "re-completing when the balance no longer covers the spend is refused, and the status stays",
    (await failureCode(changeOrder(db, "order_1", { status: "COMPLETED" }))) ===
      "INSUFFICIENT_POINTS" &&
      db.orders.get("order_1")?.status === "CANCELLED" &&
      db.balance("member_1") === 50
  );

  if (member) member.pointsBalance = 500;
  await changeOrder(db, "order_1", { status: "COMPLETED" });
  check(
    "re-completing with enough points spends them again and earns again",
    db.balance("member_1") === 310 && keysAreUnique(db),
    String(db.balance("member_1"))
  );
});

console.log("\n=== Phase 4: checkout wiring ===");

const p4Checkout = code(source.checkoutService);
const p4Service = code(source.service);
const transactionAt = p4Checkout.indexOf("const { enrollment, order } = await prisma.$transaction");

check(
  "the token and the switch are read before the order's transaction",
  p4Checkout.indexOf("readCheckoutRedemption(store.id,") > -1 &&
    p4Checkout.indexOf("readCheckoutRedemption(store.id,") < transactionAt
);
check(
  "points are priced after the coupon is claimed and before the order exists",
  p4Checkout.indexOf("priceCheckoutRedemption(tx,") >
    p4Checkout.indexOf("claimCheckoutCoupon(tx,") &&
    p4Checkout.indexOf("priceCheckoutRedemption(tx,") <
      p4Checkout.indexOf("const created = await tx.order.create(")
);
check(
  "the debit follows the order, in the same transaction",
  p4Checkout.indexOf("debitCheckoutRedemption(tx, store.id,") >
    p4Checkout.indexOf("const created = await tx.order.create(") &&
    p4Checkout.indexOf("debitCheckoutRedemption(tx, store.id,") <
      p4Checkout.indexOf("return { enrollment: enrolled, order: created };")
);
check(
  "the points discount is measured on goods after the coupon, and taken off the total and stored",
  /eligibleGoodsCents: checkoutRedemptionBaseCents\(\{\s*bundleDiscountAmount,\s*coupon: discount,\s*goodsSubtotal: subtotalAmount\s*\}\)/.test(
    p4Checkout
  ) &&
    /Number\(bundleDiscountAmount\) -\s*Number\(loyaltyDiscountAmount\)/.test(p4Checkout) &&
    /couponCode: discount\.couponCode,\s*loyaltyDiscountAmount,/.test(p4Checkout)
);
check(
  "a client can post a count of points and a token, never a discount",
  source.checkoutSchema.includes("loyaltyPoints: z.number().int().positive()") &&
    !/loyaltyDiscount/.test(source.checkoutSchema) &&
    !/loyaltyDiscount/.test(source.checkoutRoute)
);
check(
  "every loyalty refusal at checkout becomes a checkout error, so no order is placed",
  /throw new CheckoutError\("LOYALTY_POINTS", error\.message\)/.test(p4Checkout) &&
    (p4Checkout.match(/await asCheckoutLoyaltyError\(/g) ?? []).length === 2 &&
    /catch \(error\) \{\s*if \(error instanceof LoyaltyError\) \{\s*throw new CheckoutError\(\s*"LOYALTY_POINTS"/.test(
      p4Checkout
    )
);
check(
  "redemption is not tied to the cart scope, so Direct Checkout gets it too",
  !/scope[^\n]*loyaltyPoints|loyaltyPoints[^\n]*scope/.test(p4Checkout)
);
check(
  "the AI Shopping Agent never posts points",
  !/loyaltyPoints|loyaltyToken/.test(source.shoppingAgent)
);
check(
  "the code request opens the same challenge for every number, and sends only a member's",
  (() => {
    const body = functionBody(p4Service, "requestLoyaltyRedemptionCode");
    const opened = body.indexOf("await requestDeferredOtpChallenge({");

    return (
      opened > -1 &&
      (body.match(/requestDeferredOtpChallenge\(/g) ?? []).length === 1 &&
      /purpose: "LOYALTY",\s*storeId\s*\}\);/.test(body) &&
      /if \(redeemable\) \{\s*context\.schedule\(deliver\);\s*\}/.test(body) &&
      (body.match(/context\.schedule\(/g) ?? []).length === 1 &&
      opened < body.indexOf("if (redeemable)") &&
      !/suppressDelivery|requestOtpChallenge\(/.test(body)
    );
  })()
);
check(
  "no code is sent once the SMS allowance is spent",
  /allowance\.remaining !== null && allowance\.remaining <= 0/.test(
    functionBody(p4Service, "requestLoyaltyRedemptionCode")
  )
);
check(
  "the balance is only read after the code checks out",
  (() => {
    const body = functionBody(p4Service, "verifyLoyaltyRedemptionCode");

    return (
      body.indexOf("verifyOtpChallenge(") > -1 &&
      body.indexOf("verifyOtpChallenge(") < body.indexOf("findLoyaltyMemberByPhoneKey(")
    );
  })()
);
check(
  "a token is accepted only for this store and this order's number",
  /claim\.storeId !== storeId/.test(p4Service) &&
    /claim\.phoneKey !== loyaltyPhoneKey\(input\.phone\)/.test(p4Service)
);
check(
  "the code routes check a blocked address before sending",
  source.loyaltyCodeRoute.includes("isIpBlocked(store.id, ipAddress)") &&
    source.loyaltyCodeRoute.indexOf("isIpBlocked(") <
      source.loyaltyCodeRoute.indexOf("requestLoyaltyRedemptionCode(")
);
check(
  "the points panel posts nothing while the choice is invalid",
  source.pointsPanel.includes('value={posting ? String(appliedPoints) : ""}') &&
    !/name="verificationCode"/.test(source.pointsPanel)
);
check(
  "an order edit keeps the bundle saving and the points discount, and refuses a negative total",
  /Number\(discountAmount\) -\s*Number\(fixed\.bundleDiscountAmount\) -\s*Number\(fixed\.loyaltyDiscountAmount\)/.test(
    code(source.orderService)
  ) &&
    code(source.orderService).includes("The discounts are larger than the order total") &&
    source.orderEditForm.includes("fixedDiscounts.bundle -") &&
    source.orderEditForm.includes("fixedDiscounts.points;")
);
check(
  "the order page, the edit form and the guest receipt all show the points discount",
  source.orderDetailPage.includes("pointsDiscount={") &&
    source.orderDetailPage.includes("bundleDiscount={") &&
    source.orderEditForm.includes("Points discount (kept as placed)") &&
    source.guestRender.includes("pointsDiscount: points > 0")
);
check(
  "an un-cancel the balance cannot cover is reported, not an error page",
  source.orderService.length > 0 &&
    read(join(MODULES, "orders", "order.actions.ts")).includes("?pointsError=1")
);

console.log("\n=== QA 1: OTP and token hardening ===");

check(
  "a token without a checkout submission is refused",
  (() => {
    const legacy = Buffer.from(
      JSON.stringify({ e: NOW + 60_000, m: "member_1", p: "01712345678", s: STORE })
    ).toString("base64url");
    const signature = createHmac("sha256", SECRET)
      .update(`storeim-loyalty-redemption:v1.${legacy}`)
      .digest("base64url");

    return readRedemptionToken(`${legacy}.${signature}`, NOW, SECRET) === null;
  })()
);

const qaService = code(source.service);
const claimReader = functionBody(qaService, "readRedemptionClaim");
check(
  "a token is accepted only for its store, its number and its own checkout page load",
  claimReader.includes("claim.storeId !== storeId") &&
    claimReader.includes("claim.phoneKey !== loyaltyPhoneKey(input.phone)") &&
    claimReader.includes("claim.submissionId !== readSubmissionId(input.submissionId)")
);
check(
  "the quote and the order read the token through the same function",
  functionBody(qaService, "quoteCheckoutRedemption").includes(
    "readRedemptionClaim(storeId, input)"
  ) &&
    functionBody(qaService, "readCheckoutRedemption").includes(
      "readRedemptionClaim(storeId, input)"
    ) &&
    code(source.checkoutService).includes("submissionId: data.submissionId,")
);
check(
  "verification needs the page's submission before the code is spent",
  (() => {
    const body = functionBody(qaService, "verifyLoyaltyRedemptionCode");
    const guard =
      /const submissionId = readSubmissionId\(input\.submissionId\);[\s\S]*?if \(!submissionId\) \{\s*throw new OtpError\(/.exec(
        body
      );

    return guard !== null && guard.index + guard[0].length < body.indexOf("verifyOtpChallenge(");
  })()
);
check(
  "every code request answers in one public shape, written before any message is sent",
  (() => {
    const body = functionBody(qaService, "requestLoyaltyRedemptionCode");

    return (
      (body.match(/\breturn\b/g) ?? []).length === 1 &&
      body.includes(
        "return toCodeReceipt(ticket.identifier, ticket.resendAvailableAt, ticket.devCode);"
      ) &&
      !/await deliver|deliver\(\)|catch \(/.test(body)
    );
  })()
);
check(
  "the code route hands the member's send to Next's after(), so the reply never waits on the gateway",
  /import \{ after, NextResponse, type NextRequest \} from "next\/server";/.test(
    source.loyaltyCodeRoute
  ) && /\{ ipAddress, schedule: after \}/.test(source.loyaltyCodeRoute)
);
check(
  "a loyalty code is checked only against this store's challenge",
  /verifyOtpChallenge\(\{\s*code: input\.code,\s*identifier: \{ channel: "SMS", phone \},\s*purpose: "LOYALTY",\s*storeId\s*\}\)/.test(
    functionBody(qaService, "verifyLoyaltyRedemptionCode")
  )
);
check(
  "the code route sends back only the receipt's own fields",
  /identifier: ticket\.identifier,\s*resendAvailableAt: ticket\.resendAvailableAt\.toISOString\(\)/.test(
    source.loyaltyCodeRoute
  ) &&
    !/balance|member|suspend/i.test(
      code(source.loyaltyCodeRoute).replace(/requestLoyaltyRedemptionCode/g, "")
    )
);
check(
  "a masked recipient keeps only its last three characters",
  maskRecipient("01712345678") === "********678" &&
    maskRecipient("shopper@example.com") === "****************com" &&
    maskRecipient("678") === "***" &&
    maskRecipient("") === "***"
);
check(
  "a failed send's server log names no full number",
  /to \$\{maskRecipient\(input\.recipient\)\} failed/.test(source.notificationsService) &&
    !/to \$\{input\.recipient\} failed/.test(source.notificationsService)
);
check(
  "no loyalty module writes a code or a phone to the console",
  readdirSync(MODULE_DIR, { recursive: true })
    .map(String)
    .filter((name) => /\.tsx?$/.test(name))
    .every((name) => !/console\.\w+\([^)]*(code|phone)/i.test(code(read(join(MODULE_DIR, name)))))
);

console.log("\n=== QA 2: one calculation for coupons, bundles and points ===");

check(
  "the coupon is measured on the cart less its bundle saving",
  checkoutCouponBase("1000.00", "100.00") === "900.00" &&
    checkoutCouponBase("50.00", "80.00") === "0.00"
);
check(
  "the goods include the accepted add-on at its offer price, and only then",
  checkoutGoodsSubtotal("1000.00", "150.00") === "1150.00" &&
    checkoutGoodsSubtotal("1000.00", null) === "1000.00"
);

// The reported mismatch, worked through. A 1,000 cart, a 100 bundle saving,
// a 10% coupon. The order claims 10% of 900 = 90; the page used to quote 10%
// of 1,000 = 100 and measure the points cap on that.
const quotedOnWholeCart = 100;
const claimedOnCouponBase = (Number(checkoutCouponBase("1000.00", "100.00")) * 10) / 100;
const oldPageBase = checkoutRedemptionBaseCents({
  bundleDiscountAmount: "100.00",
  coupon: { discountAmount: quotedOnWholeCart.toFixed(2), freeShipping: false },
  goodsSubtotal: "1000.00"
});
const orderBase = checkoutRedemptionBaseCents({
  bundleDiscountAmount: "100.00",
  coupon: { discountAmount: claimedOnCouponBase.toFixed(2), freeShipping: false },
  goodsSubtotal: "1000.00"
});
check(
  "reproduced: quoting the coupon on the whole cart measured points on 800, the order on 810",
  oldPageBase === 80_000 && orderBase === 81_000,
  `page ${oldPageBase}, order ${orderBase}`
);
check(
  "on 810 at 50% and 1.00 a point the order allows 405 points; the old page offered 400",
  redemptionLimits({ balance: 10_000, eligibleGoodsCents: orderBase, policy: POLICY }).maxPoints ===
    405 &&
    redemptionLimits({ balance: 10_000, eligibleGoodsCents: oldPageBase, policy: POLICY })
      .maxPoints === 400
);
check(
  "a free-shipping coupon does not shrink the points base, with or without a bundle",
  checkoutRedemptionBaseCents({
    bundleDiscountAmount: "100.00",
    coupon: { discountAmount: "70.00", freeShipping: true },
    goodsSubtotal: "1000.00"
  }) === 90_000
);
check(
  "an odd-cent base and cap round down to whole points: 33% of 810.01 at 0.75 is 356",
  redemptionLimits({
    balance: 10_000,
    eligibleGoodsCents: checkoutRedemptionBaseCents({
      bundleDiscountAmount: "100.00",
      coupon: { discountAmount: "89.99", freeShipping: false },
      goodsSubtotal: "1000.00"
    }),
    policy: { maxRedeemPercent: 33, minRedeemPoints: 1, pointValue: "0.75" }
  }).maxPoints === 356
);
check(
  "a balance of exactly the cap uses all of it; one more point is refused",
  (() => {
    const limits = redemptionLimits({
      balance: 405,
      eligibleGoodsCents: orderBase,
      policy: POLICY
    });

    return checkRedemption(405, limits).ok && !checkRedemption(406, limits).ok;
  })()
);

const quoteCode = code(source.checkoutQuote);
check(
  "the quote prices the coupon on the coupon base and points on the goods after both",
  quoteCode.includes("checkoutCouponBase(input.cart.totals.subtotal, bundles.discountAmount)") &&
    quoteCode.includes("subtotal: couponBase") &&
    quoteCode.includes("checkoutRedemptionBaseCents({")
);
check(
  "the order uses the same three definitions",
  /checkoutGoodsSubtotal\(cart\.totals\.subtotal, bump \? bump\.offerPrice : null\)/.test(
    code(source.checkoutService)
  ) &&
    code(source.checkoutService).includes(
      "checkoutCouponBase(cart.totals.subtotal, bundleDiscountAmount)"
    ) &&
    code(source.checkoutService).includes("checkoutRedemptionBaseCents({")
);
check(
  "the coupon quote and the points quote both go through the shared quote",
  code(source.couponRoute).includes("quoteCheckoutDiscounts(store.id,") &&
    !code(source.couponRoute).includes("subtotal: cart.totals.subtotal") &&
    code(source.loyaltyQuoteRoute).includes("quoteCheckoutDiscounts(store.id,") &&
    code(source.loyaltyQuoteRoute).includes("eligibleGoodsCents: discounts.redemptionBaseCents")
);
check(
  "the checkout page no longer works the cap out itself",
  !/redemptionLimits\(|loyaltyEarningBaseCents\(/.test(code(source.checkoutExperience)) &&
    code(source.checkoutExperience).includes('fetch("/api/checkout/loyalty-quote"')
);

console.log("\n=== QA 3: phone normalisation ===");

const bangladeshSpellings = [
  "01712345678",
  "+8801712345678",
  "8801712345678",
  "1712345678",
  "+880 1712-345678",
  "(+880) 1712 345 678",
  " 017-1234-5678 "
];
check(
  "every supported spelling gives one code number and one membership key, and they agree",
  bangladeshSpellings.every(
    (phone) => loyaltyOtpPhone(phone) === "01712345678" && loyaltyPhoneKey(phone) === "01712345678"
  ),
  bangladeshSpellings.map((phone) => `${phone}→${loyaltyOtpPhone(phone)}`).join(", ")
);

const unsupported = [
  "0171234567",
  "01212345678",
  "00880 1712 345678",
  "+44 7911 123456",
  "12345",
  "",
  "phone"
];
check(
  "anything else gets no code, so it cannot redeem",
  unsupported.every((phone) => loyaltyOtpPhone(phone) === null),
  unsupported.map((phone) => `${phone}→${loyaltyOtpPhone(phone)}`).join(", ")
);
check(
  "an unsupported number never shares a key with a supported one",
  unsupported.every((phone) => loyaltyPhoneKey(phone) !== "01712345678")
);
check(
  "whenever a code can be sent, it is sent to the membership's own key",
  [...bangladeshSpellings, ...unsupported, "01812345678", "+8801912345678"].every((phone) => {
    const otp = loyaltyOtpPhone(phone);

    return otp === null || otp === loyaltyPhoneKey(phone);
  })
);
check(
  "the code, the verification and the token all use the one phone helper",
  functionBody(qaService, "requestLoyaltyRedemptionCode").includes(
    "loyaltyOtpPhone(input.phone)"
  ) &&
    functionBody(qaService, "verifyLoyaltyRedemptionCode").includes(
      "loyaltyOtpPhone(input.phone)"
    ) &&
    !/normalizeBangladeshPhone/.test(qaService)
);

console.log("\n=== QA 4: refund and cancellation clarity ===");

check(
  "an order that spent points says so, and that only cancelling returns them",
  describeOrderPoints([redeemLine(-200)]) ===
    "Paid with 200 points. Cancelling the order gives them back; returns and refunds are settled in cash and do not."
);
check(
  "a cancelled one says they were given back",
  describeOrderPoints([redeemLine(-200), redeemLine(200, "REDEEM_REVERSAL")]) ===
    "200 points were given back when the order was cancelled."
);
check(
  "re-completed after a cancellation, it is spent again",
  describeOrderPoints([
    redeemLine(-200),
    redeemLine(200, "REDEEM_REVERSAL"),
    redeemLine(-200)
  ])?.startsWith("Paid with 200 points.") === true
);
check("an order that spent nothing says nothing", describeOrderPoints([earnLine(12)]) === null);
check(
  "the order page puts that sentence under the points discount",
  source.orderDetailPage.includes("pointsNote={pointsNote}") &&
    source.orderDetailPage.includes("getOrderPointsNote(store.id, order.id)")
);
check(
  "the returns panel says refunds are cash and points do not come back",
  source.returnsPanel.includes("paid with loyalty points. Refunds here are paid in cash") &&
    source.orderDetailPage.includes("pointsPaid={pointsPaid ?")
);
check(
  "the guest receipt calls it payment, not a discount",
  source.guestHistory.includes("<dt>Paid with points</dt>")
);
check(
  "a settled return can never be settled twice, so it cannot refund twice",
  /COMPLETED: \[\],/.test(source.returnService) && /CANCELLED: \[\],/.test(source.returnService)
);

console.log("\n=== QA 5: AI API un-cancel ===");

const aiCode = code(source.aiActions);
check(
  "an un-cancel the balance cannot cover is a 409 with its own code",
  /error instanceof LoyaltyError && error\.code === "INSUFFICIENT_POINTS"\) \{\s*throw new AiApiRouteError\(\s*409,\s*"loyalty_points_insufficient"/.test(
    aiCode
  )
);
check(
  "the message names no balance, member or ledger figure",
  (() => {
    const message = /"loyalty_points_insufficient",\s*"([^"]+)"/.exec(aiCode)?.[1] ?? "";

    return message.length > 0 && !/\d/.test(message) && !/balance of|member_|ledger/i.test(message);
  })()
);
check(
  "anything else still falls through to the opaque 500",
  /throw new AiApiRouteError\([\s\S]*?\);\s*\}\s*throw error;/.test(aiCode)
);
check(
  "the API's error table lists the new code",
  source.aiDoc.includes("`loyalty_points_insufficient`")
);

console.log("\n=== Schema ===");

const member = prismaModel("LoyaltyMember");
const ledger = prismaModel("LoyaltyTransaction");
const setting = prismaModel("StoreLoyaltySetting");

check("a customer has at most one membership", /customerId\s+String\s+@unique/.test(member));
check(
  "one membership per normalised phone in a store",
  member.includes("@@unique([storeId, phoneKey])")
);
check(
  "a ledger key is unique within its store",
  ledger.includes("@@unique([storeId, idempotencyKey])")
);
check("ledger rows have no updatedAt, because they are never updated", !/updatedAt/.test(ledger));
check(
  "a ledger row can record the rate it was priced at",
  /amountPerPoint\s+Decimal\?\s+@db\.Decimal\(12, 2\)/.test(ledger)
);
check(
  "a member's ledger sequence is unique per member",
  ledger.includes("@@unique([memberId, sequence])") &&
    /ledgerSequence\s+Int\s+@default\(0\)/.test(member)
);
check(
  "suspension lives on the membership and is nullable",
  /suspendedAt\s+DateTime\?/.test(member) && /suspendedByUserId\s+String\?/.test(member)
);

check(
  "an order stores its points discount, defaulting to none",
  /loyaltyDiscountAmount\s+Decimal\s+@default\(0\) @db\.Decimal\(12, 2\)/.test(prismaModel("Order"))
);
check(
  "redemption settings default off, 1.00, 100 and 50",
  /redemptionEnabled\s+Boolean\s+@default\(false\)/.test(setting) &&
    /pointValue\s+Decimal\s+@default\(1\) @db\.Decimal\(12, 2\)/.test(setting) &&
    /minRedeemPoints\s+Int\s+@default\(100\)/.test(setting) &&
    /maxRedeemPercent\s+Int\s+@default\(50\)/.test(setting)
);
check("loyalty codes have their own OTP purpose", prismaEnum("OtpPurpose").includes("LOYALTY"));

const conflictModel = prismaModel("LoyaltyEnrollmentConflict");
check(
  "a conflict is one row per store, customer and member, with who resolved it",
  conflictModel.includes("@@unique([storeId, customerId, memberId])") &&
    /resolvedAt\s+DateTime\?/.test(conflictModel) &&
    /resolvedByUserId\s+String\?/.test(conflictModel)
);
check(
  "a customer cannot be deleted out from under their ledger",
  /customer\s+Customer\s+@relation\([^)]*onDelete: NoAction\)/.test(member)
);
check(
  "store deletion still clears memberships and settings",
  /store\s+Store\s+@relation\([^)]*onDelete: Cascade\)/.test(member) &&
    /store\s+Store\s+@relation\([^)]*onDelete: Cascade\)/.test(setting)
);
check(
  "the stored programme is off by default",
  /enabled\s+Boolean\s+@default\(false\)/.test(setting)
);
check(
  "money per point is a decimal, never a float",
  /amountPerPoint\s+Decimal[^\n]*@db\.Decimal\(12, 2\)/.test(setting)
);

console.log("\n=== Structure ===");

const moduleCode = readdirSync(MODULE_DIR, { recursive: true })
  .map(String)
  .filter((name) => /\.tsx?$/.test(name))
  .map((name) => code(read(join(MODULE_DIR, name))))
  .join("\n");

check(
  "no code updates or deletes a ledger row",
  !/loyaltyTransaction\.(update|updateMany|upsert|delete|deleteMany)\(/.test(moduleCode)
);
check(
  "only the ledger appends rows or moves a balance",
  (moduleCode.match(/loyaltyTransaction\.create\(/g) ?? []).length === 1 &&
    code(source.ledger).includes("loyaltyTransaction.create(") &&
    !/pointsBalance:\s*\{/.test(
      code(source.repository) + code(source.service) + code(source.orders)
    )
);

const unscoped: string[] = [];

for (const [file, text] of Object.entries({
  ledger: code(source.ledger),
  orders: code(source.orders),
  repository: code(source.repository)
})) {
  for (const match of text.matchAll(
    /\.(loyaltyMember|loyaltyTransaction|storeLoyaltySetting|order|coupon|orderReturn)\.(\w+)\(/g
  )) {
    const end = text.indexOf(";", match.index);
    const statement = text.slice(match.index, end === -1 ? undefined : end);

    if (!statement.includes("storeId")) {
      unscoped.push(`${file}: ${match[1]}.${match[2]}`);
    }
  }
}

check("every loyalty statement is scoped by store", unscoped.length === 0, unscoped.join(", "));
check(
  "the ledger never imports the Prisma client as a value",
  !/import \{[^}]*\bprisma\b[^}]*\} from "@dash\/db"/.test(source.ledger)
);
check(
  "the rules are pure",
  [...source.rules.matchAll(/from "([^"]+)"/g)].every(([, path]) =>
    ["../courier/courier-phone", "./loyalty.schema"].includes(path ?? "")
  ) && /import type \{[^}]*\} from "\.\/loyalty\.schema"/.test(source.rules)
);

const actionCode = code(source.actions);
const postedFields = [...actionCode.matchAll(/formData\.get\("(\w+)"\)/g)].map((match) => match[1]);

check("the action module is a server module", source.actions.startsWith('"use server";'));
check(
  "the action is manager-only",
  /\brequireStoreManager\(/.test(actionCode) && !/\brequireStore\(/.test(actionCode)
);
check(
  "the actions read only their own fields from a form — never a store, user or balance",
  JSON.stringify([...new Set(postedFields)].sort()) ===
    JSON.stringify([
      "amountPerPoint",
      "conflictId",
      "enabled",
      "intent",
      "maxRedeemPercent",
      "memberId",
      "minRedeemPoints",
      "pointValue",
      "points",
      "programName",
      "reason",
      "redemptionEnabled",
      "requestId"
    ]) && !/formData\.get\("(storeId|userId|actorUserId|balance|pointsBalance)"\)/.test(actionCode),
  postedFields.join(", ")
);
check(
  "the action takes the store from the session",
  /storeId = \(await requireStoreManager\(\)\)\.store\.id/.test(actionCode)
);
check(
  "a plan refusal reaches the form as lockedFeature",
  actionCode.includes("lockedFeature: error.featureKey")
);

const serviceCode = code(source.service);
check(
  "switching either switch on is gated on the loyalty plan feature, in the write",
  /if \(settings\.enabled \|\| settings\.redemptionEnabled\) \{\s*await requirePlanFeature\(storeId, "loyalty"\);\s*\}/.test(
    serviceCode
  )
);
check(
  "switching off is not gated",
  (
    /export async function saveLoyaltySettings[\s\S]*?\n\}/
      .exec(serviceCode)?.[0]
      .match(/requirePlanFeature\(/g) ?? []
  ).length === 1
);
check(
  "whether the programme runs is read from the plan, not the stored switch",
  serviceCode.includes('hasPlanFeature(storeId, "loyalty")') &&
    serviceCode.includes("loyaltyCapability(settings.enabled, entitled)")
);
check(
  "the service re-parses every ledger entry before writing it",
  serviceCode.includes("loyaltyLedgerEntrySchema.parse(input)")
);
check(
  "a lost race on the key is answered as a replay",
  serviceCode.includes('isUniqueConstraintError(error, "idempotencyKey")')
);

console.log("\n=== Plan and navigation ===");

check("loyalty is a registered feature key", PLAN_FEATURE_KEYS.includes("loyalty"));
check(
  "loyalty unlocks at Starter",
  minPlanForFeature("loyalty") === "Starter",
  String(minPlanForFeature("loyalty"))
);
check("loyalty is paid", isPaidFeature("loyalty"));
check(
  "Growth and Pro inherit it",
  ["growth", "pro"].every((slug) =>
    PLAN_CATALOG.find((entry) => entry.slug === slug)?.features.includes("loyalty")
  )
);
check(
  "it is listed as shipping, now that members can earn",
  PLAN_FEATURE_REGISTRY.loyalty.status === "available"
);
check(
  "the sidebar links the page and badges it with the loyalty key",
  source.nav.includes('href: "/dashboard/marketing/loyalty"') &&
    source.nav.includes('"/dashboard/marketing/loyalty": "loyalty"')
);

const managerOnly = /MANAGER_ONLY_HREFS[^=]*= new Set\(\[([\s\S]*?)\]\)/.exec(source.nav)?.[1];
check(
  "members can open the page to read it",
  managerOnly !== undefined && !managerOnly.includes('"/dashboard/marketing/loyalty"')
);
check(
  "the page reads access, not just the store",
  source.page.includes("getStoreAccess()") && source.page.includes('feature="loyalty"')
);
check(
  "verify:staff-permissions classifies the action as manager-only",
  source.staffPermissions.includes('"loyalty/loyalty.actions.ts": "manager"')
);

console.log("\n=== Dashboard: finding the programme ===");

const mainLinksBlock = /const mainLinks: NavItem\[\] = \[([\s\S]*?)\];/.exec(source.nav)?.[1] ?? "";
const mainHrefs = [...mainLinksBlock.matchAll(/href: "([^"]+)"/g)].map((match) => match[1]);
// The nav's own visibility rule, read from the file: a link is hidden from a
// member only if it is in MANAGER_ONLY_HREFS or under a manager-only prefix.
const managerOnlyPrefixes = [
  ...(/function isManagerOnlyHref[\s\S]*?\n\}/.exec(source.nav)?.[0] ?? "").matchAll(
    /href\.startsWith\("([^"]+)"\)/g
  )
].map((match) => match[1] ?? "");
const hiddenFromMembers = (href: string) =>
  (managerOnlyHrefs() ?? "").includes(`"${href}"`) ||
  managerOnlyPrefixes.some((prefix) => href.startsWith(prefix));
check(
  "Loyalty is a top-level sidebar entry right after Customers, not only inside the collapsed Marketing group",
  mainHrefs.indexOf("/dashboard/marketing/loyalty") ===
    mainHrefs.indexOf("/dashboard/customers") + 1 &&
    mainHrefs.indexOf("/dashboard/customers") > -1 &&
    /\{ href: "\/dashboard\/marketing\/loyalty", icon: Award, label: "Loyalty" \}/.test(
      mainLinksBlock
    ),
  mainHrefs.join(", ")
);
check(
  "it is drawn for owners and members alike, and badged Paid by the loyalty key for a plan without it",
  !hiddenFromMembers("/dashboard/marketing/loyalty") &&
    !hiddenFromMembers("/dashboard/marketing/loyalty/members") &&
    managerOnlyPrefixes.length >= 2 &&
    source.nav.includes('"/dashboard/marketing/loyalty": "loyalty"')
);
check(
  "Starter, Growth and Pro open it; Free sees the upgrade badge",
  ["starter", "growth", "pro"].every((slug) =>
    PLAN_CATALOG.find((entry) => entry.slug === slug)?.features.includes("loyalty")
  ) && PLAN_CATALOG.find((entry) => entry.slug === "free")?.features.includes("loyalty") === false
);
check(
  "on a loyalty page only the Loyalty entry lights up, not the whole Marketing group too",
  /\(pathname\.startsWith\("\/dashboard\/marketing"\) &&\s*!pathname\.startsWith\("\/dashboard\/marketing\/loyalty"\)\)/.test(
    source.nav
  )
);
check(
  "the Marketing entries and the overview card are still there, so nothing reachable moved",
  /const marketingLinks[\s\S]*?href: "\/dashboard\/marketing\/loyalty", label: "Loyalty" \}[\s\S]*?href: "\/dashboard\/marketing\/loyalty\/members"/.test(
    source.nav
  ) &&
    read(join(WEB, "app", "dashboard", "marketing", "page.tsx")).includes(
      'href="/dashboard/marketing/loyalty"'
    )
);
check(
  "settings, members and a member's page stay open to every member; conflicts stays the manager's",
  [
    source.page,
    read(join(WEB, "app", "dashboard", "marketing", "loyalty", "members", "page.tsx")),
    read(join(WEB, "app", "dashboard", "marketing", "loyalty", "members", "[memberId]", "page.tsx"))
  ].every((page) => page.includes("await getStoreAccess()") && !/redirect\(/.test(page)) &&
    /if \(!access\.canManage\) \{/.test(
      read(join(WEB, "app", "dashboard", "marketing", "loyalty", "conflicts", "page.tsx"))
    )
);

console.log("\n=== Offline sales: linking a member ===");

const SALE_STORE = "store_sale";
const saleCustomers = [
  toSaleCustomerOption(SALE_STORE, {
    email: "walkin@example.com",
    id: "c_none",
    loyaltyMember: null,
    name: "Nadia Walk-in",
    phone: "01811112222"
  }),
  toSaleCustomerOption(SALE_STORE, {
    email: null,
    id: "c_suspended",
    loyaltyMember: { pointsBalance: 80, storeId: SALE_STORE, suspendedAt: new Date(NOW) },
    name: "Karim Suspended",
    phone: "01933334444"
  }),
  toSaleCustomerOption(SALE_STORE, {
    email: "rahim@example.com",
    id: "c_member",
    loyaltyMember: { pointsBalance: 420, storeId: SALE_STORE, suspendedAt: null },
    name: "Rahim Member",
    phone: "01712345678"
  }),
  toSaleCustomerOption(SALE_STORE, {
    email: null,
    id: "c_elsewhere",
    loyaltyMember: { pointsBalance: 9_999, storeId: "store_other", suspendedAt: null },
    name: "Other Shop Member",
    phone: "01655556666"
  })
];
const [noneOption, suspendedOption, memberOption, elsewhereOption] = saleCustomers;
check(
  "a member shows their status and balance; a suspended one says so; a customer without one shows none",
  memberOption?.membership?.status === "active" &&
    memberOption.membership.points === 420 &&
    suspendedOption?.membership?.status === "suspended" &&
    noneOption?.membership === null
);
check(
  "another store's membership is never shown, whatever the join returned",
  elsewhereOption?.membership === null
);
check(
  "the number is shown masked",
  memberOption?.phoneMasked.endsWith("5678") === true &&
    !memberOption.phoneMasked.includes("0171234") &&
    memberOption.phoneMasked.length === "01712345678".length
);
const ids = (query: string) => searchSaleCustomers(saleCustomers, query).map((option) => option.id);
check(
  "staff find a customer by name, email, or the number however it is typed",
  ids("rahim").join() === "c_member" &&
    ids("RAHIM@EXAMPLE").join() === "c_member" &&
    ids("01712345678").join() === "c_member" &&
    ids("+880 1712-345678").join() === "c_member" &&
    ids("1712").join() === "c_member" &&
    ids("zzz").length === 0,
  `${ids("+880 1712-345678")} / ${ids("1712")}`
);
check(
  "members are listed first, then suspended members, then everyone else",
  ids("").join() === "c_member,c_suspended,c_none,c_elsewhere" &&
    searchSaleCustomers(saleCustomers, "", 2).length === 2
);
check(
  "the notes say points can't be spent offline, a paused programme or suspension earns nothing, and joining is never implied",
  (memberOption ? saleMembershipNote(memberOption, true) : "")?.includes(
    "Points can't be spent on offline sales"
  ) === true &&
    (memberOption ? saleMembershipNote(memberOption, false) : "")?.includes("won't earn points") ===
      true &&
    (suspendedOption ? saleMembershipNote(suspendedOption, true) : "")?.includes(
      "won't earn points"
    ) === true &&
    (noneOption ? saleMembershipNote(noneOption, true) : "")?.includes("doesn't enrol them") ===
      true &&
    (noneOption ? saleMembershipNote(noneOption, false) : "x") === null
);
check(
  "the opt-in box is offered only for an active member of this store while the programme runs",
  canOfferSaleOptIn(memberOption ?? null, true) &&
    !canOfferSaleOptIn(memberOption ?? null, false) &&
    !canOfferSaleOptIn(suspendedOption ?? null, true) &&
    !canOfferSaleOptIn(noneOption ?? null, true) &&
    !canOfferSaleOptIn(elsewhereOption ?? null, true) &&
    !canOfferSaleOptIn(null, true)
);

const salesSource = {
  editPage: read(join(WEB, "app", "dashboard", "sales", "[saleId]", "edit", "page.tsx")),
  form: read(join(MODULES, "sales", "components", "sale-form.tsx")),
  newPage: read(join(WEB, "app", "dashboard", "sales", "new", "page.tsx")),
  picker: read(join(MODULES, "sales", "components", "sale-customer-picker.tsx")),
  service: read(join(MODULES, "sales", "sale.service.ts"))
};
check(
  "the picker posts the customer's id and the opt-in box — never a member id, a balance or points",
  JSON.stringify([...salesSource.picker.matchAll(/\bname="([^"]+)"/g)].map((match) => match[1])) ===
    JSON.stringify(["customerId", "loyaltyOptInShown", "loyaltyOptIn"]) &&
    /<input name="customerId" type="hidden" value=\{selected\?\.id \?\? ""\} \/>/.test(
      salesSource.picker
    ) &&
    /\{canOfferSaleOptIn\(selected, programmeLive\) \? \(/.test(salesSource.picker) &&
    !/name="(memberId|points|balance|pointsToUse|redeem\w*)"/i.test(
      salesSource.form + salesSource.picker
    ) &&
    salesSource.form.includes("<SaleCustomerPicker") &&
    !/<select[^>]*name="customerId"/.test(salesSource.form)
);
check(
  "choosing a different customer starts the box unticked — consent is one customer's",
  /setOptedIn\(id !== "" && id === defaultCustomerId && defaultOptedIn === true\);/.test(
    salesSource.picker
  )
);
check(
  "creating and editing a sale both refuse a customer from another store before writing",
  (() => {
    const create = functionBody(code(salesSource.service), "createSale");
    const update = functionBody(code(salesSource.service), "updateSale");

    return [create, update].every(
      (body) =>
        /if \(data\.customerId\) \{\s*await assertCustomerBelongsToStore\(tx, context\.storeId, data\.customerId\);/.test(
          body
        ) &&
        body.indexOf("assertCustomerBelongsToStore(") <
          body.indexOf("customerId: data.customerId ?? null")
    );
  })()
);
check(
  "both sale pages build the options on the server from this store's rows, with the programme's live state",
  [salesSource.newPage, salesSource.editPage].every(
    (page) =>
      page.includes("customers.map((customer) => toSaleCustomerOption(store.id, customer))") &&
      page.includes("getLoyaltyCapability(store.id)") &&
      page.includes("loyaltyLive={loyalty.live}")
  ) && salesSource.form.includes("defaultCustomerId={sale?.customerId ?? null}")
);
const salesModuleFiles = readdirSync(join(MODULES, "sales"), { recursive: true })
  .map(String)
  .filter((name) => /\.tsx?$/.test(name))
  .map((name) => ({
    name: name.replace(/\\/g, "/"),
    text: code(read(join(MODULES, "sales", name)))
  }));
check(
  "an offline sale never spends points: the sales module reaches the ledger only through reconciliation",
  salesModuleFiles.every(
    ({ text }) =>
      !/loyalty\.(ledger|orders|repository)|appendLoyaltyLedgerEntry|reconcileOrderLoyalty|Redemption/i.test(
        text
      )
  )
);
check(
  "saving a sale never enrols anyone: the only enrolment in the sales module is the counter's own button, through the loyalty service",
  (() => {
    const calls = salesModuleFiles
      .flatMap(({ name, text }) =>
        [...text.matchAll(/\b(enrol\w*)\(/gi)].map((match) => `${name}:${match[1]}`)
      )
      .sort();
    const actions = code(read(join(MODULES, "sales", "sale.actions.ts")));

    return (
      JSON.stringify([...new Set(calls)]) ===
        JSON.stringify([
          "components/sale-membership-join.tsx:enroll",
          "components/sale-membership-join.tsx:enrollSaleCustomerAction",
          "sale.actions.ts:enrollCustomerAtCounter",
          "sale.actions.ts:enrollSaleCustomerAction"
        ]) &&
      (actions.match(/enrollCustomerAtCounter\(/g) ?? []).length === 1 &&
      functionBody(actions, "enrollSaleCustomerAction").includes("enrollCustomerAtCounter(") &&
      !/enrol|createCounterCustomer|customer\.create/i.test(code(salesSource.service))
    );
  })(),
  JSON.stringify(
    salesModuleFiles.flatMap(({ name, text }) =>
      [...text.matchAll(/\b(enrol\w*)\(/gi)].map((match) => `${name}:${match[1]}`)
    )
  )
);

console.log("\n=== Offline sales: earning ===");

const SALE_ENROLLED_AT = new Date(2026, 9, 10, 15, 0);
const SALE_MEMBER_A = {
  customerId: "cust_a",
  enrolledAt: SALE_ENROLLED_AT,
  id: "member_a",
  suspendedAt: null as Date | null
};
const SALE_MEMBER_B = { ...SALE_MEMBER_A, customerId: "cust_b", id: "member_b" };
type SaleLine = SaleLoyaltyFacts["lines"][number];

function saleFacts(
  overrides: Partial<Omit<SaleLoyaltyFacts, "sale">> & {
    sale?: Partial<SaleLoyaltyFacts["sale"]>;
  } = {}
): SaleLoyaltyFacts {
  return {
    lines: overrides.lines ?? [],
    member: "member" in overrides ? (overrides.member ?? null) : SALE_MEMBER_A,
    optIn: "optIn" in overrides ? (overrides.optIn ?? null) : { customerId: "cust_a" },
    sale: {
      createdAt: new Date(2026, 9, 12, 10, 0),
      customerId: "cust_a",
      discount: "50.00",
      id: "sale_1",
      paymentStatus: "PAID",
      saleDate: new Date(2026, 9, 12),
      status: "COMPLETED",
      subtotal: "1250.00",
      ...overrides.sale
    }
  };
}
const saleLine = (points: number, memberId = "member_a", amountPerPoint = "100.00"): SaleLine => ({
  amountPerPoint,
  memberId,
  points,
  type: points > 0 ? "EARN" : "EARN_REVERSAL"
});
const writesOf = (plan: SaleLoyaltyPlan) =>
  plan.writes
    .map(
      (entry) => `${entry.memberId}:${entry.correction.points}@${entry.correction.idempotencyKey}`
    )
    .join(" ");
const salePlan = (overrides: Parameters<typeof saleFacts>[0] = {}, context = LIVE) =>
  writesOf(planSaleLoyalty(saleFacts(overrides), context));

check(
  "a completed, fully paid, opted-in sale earns on goods less its discount, rounded down",
  salePlan() === "member_a:12@sale:sale_1:earn:0" &&
    salePlan({ sale: { discount: "51.00" } }) === "member_a:11@sale:sale_1:earn:0",
  salePlan()
);
check(
  "a partly paid or unpaid sale earns nothing until it is paid in full",
  salePlan({ sale: { paymentStatus: "PARTIAL" } }) === "" &&
    salePlan({ sale: { paymentStatus: "UNPAID" } }) === "" &&
    salePlan({ sale: { paymentStatus: "PAID" } }) === "member_a:12@sale:sale_1:earn:0"
);
check(
  "a draft, cancelled or returned sale earns nothing, paid or not",
  ["DRAFT", "CANCELLED", "RETURNED"].every((status) => salePlan({ sale: { status } }) === "")
);
check(
  "without the customer's own opt-in nothing is earned, and staff cannot opt in for someone else",
  salePlan({ optIn: null }) === "" && salePlan({ optIn: { customerId: "cust_b" } }) === ""
);
check(
  "nothing from before the member joined: neither a sale recorded earlier nor one dated earlier",
  salePlan({ sale: { createdAt: new Date(2026, 9, 10, 14, 59) } }) === "" &&
    salePlan({ sale: { saleDate: new Date(2026, 9, 9) } }) === "" &&
    salePlan({ sale: { saleDate: new Date(2026, 9, 10) } }) === "member_a:12@sale:sale_1:earn:0"
);
check("saving the same sale again writes nothing", salePlan({ lines: [saleLine(12)] }) === "");
check(
  "two copies of one completion read the same history and produce the same key — the ledger lets one land",
  salePlan() === salePlan() &&
    planSaleLoyalty(saleFacts(), LIVE).writes[0]?.correction.idempotencyKey ===
      "sale:sale_1:earn:0" &&
    code(source.ledger).includes("findLoyaltyLedgerEntryByKey(")
);
check(
  "payment falling back to partial or unpaid takes the points back",
  salePlan({ lines: [saleLine(12)], sale: { paymentStatus: "PARTIAL" } }) ===
    "member_a:-12@sale:sale_1:earn:1" &&
    salePlan({ lines: [saleLine(12)], sale: { paymentStatus: "UNPAID" } }) ===
      "member_a:-12@sale:sale_1:earn:1"
);
check(
  "cancelling, voiding or returning gives the points back once; completing again earns them again",
  salePlan({ lines: [saleLine(12)], sale: { status: "CANCELLED" } }) ===
    "member_a:-12@sale:sale_1:earn:1" &&
    salePlan({ lines: [saleLine(12)], sale: { status: "RETURNED" } }) ===
      "member_a:-12@sale:sale_1:earn:1" &&
    salePlan({ lines: [saleLine(12), saleLine(-12)], sale: { status: "CANCELLED" } }) === "" &&
    salePlan({ lines: [saleLine(12), saleLine(-12)] }) === "member_a:12@sale:sale_1:earn:2"
);
check(
  "editing the goods or the discount corrects by the difference",
  salePlan({ lines: [saleLine(12)], sale: { subtotal: "1550.00" } }) ===
    "member_a:3@sale:sale_1:earn:1" &&
    salePlan({ lines: [saleLine(12)], sale: { discount: "300.00" } }) ===
      "member_a:-3@sale:sale_1:earn:1"
);
check(
  "the rate is the one the sale first earned at, not today's setting",
  writesOf(
    planSaleLoyalty(saleFacts({ lines: [saleLine(12)], sale: { subtotal: "1450.00" } }), {
      ...LIVE,
      amountPerPoint: "50.00"
    })
  ) === "member_a:2@sale:sale_1:earn:1"
);
check(
  "withdrawing the opt-in takes the points back",
  salePlan({ lines: [saleLine(12)], optIn: null }) === "member_a:-12@sale:sale_1:earn:1"
);
check(
  "changing the customer reverses the old member first, then the new member earns on their own opt-in",
  salePlan({
    lines: [saleLine(12)],
    member: SALE_MEMBER_B,
    optIn: { customerId: "cust_b" },
    sale: { customerId: "cust_b" }
  }) === "member_a:-12@sale:sale_1:earn:1 member_b:12@sale:sale_1:earn:2"
);
check(
  "the previous customer's consent never transfers, and a non-member customer just reverses",
  salePlan({
    lines: [saleLine(12)],
    member: SALE_MEMBER_B,
    optIn: { customerId: "cust_a" },
    sale: { customerId: "cust_b" }
  }) === "member_a:-12@sale:sale_1:earn:1" &&
    salePlan({
      lines: [saleLine(12)],
      member: null,
      optIn: null,
      sale: { customerId: "cust_c" }
    }) === "member_a:-12@sale:sale_1:earn:1" &&
    salePlan({ lines: [saleLine(12)], member: null, optIn: null, sale: { customerId: null } }) ===
      "member_a:-12@sale:sale_1:earn:1"
);
check(
  "with the programme off or the plan lapsed nothing new is earned, but a cancellation still reverses",
  planSaleLoyalty(saleFacts(), NOT_LIVE).held === "not-live" &&
    salePlan({}, NOT_LIVE) === "" &&
    salePlan({ lines: [saleLine(12)], sale: { status: "CANCELLED" } }, NOT_LIVE) ===
      "member_a:-12@sale:sale_1:earn:1"
);
check(
  "a suspended member earns nothing new, keeps what was earned, and a cancellation still reverses",
  (() => {
    const suspended = { ...SALE_MEMBER_A, suspendedAt: new Date(2026, 9, 11) };

    return (
      planSaleLoyalty(saleFacts({ member: suspended }), LIVE).held === "suspended" &&
      salePlan({ member: suspended }) === "" &&
      salePlan({ lines: [saleLine(12)], member: suspended }) === "" &&
      salePlan({ lines: [saleLine(12)], member: suspended, sale: { status: "CANCELLED" } }) ===
        "member_a:-12@sale:sale_1:earn:1"
    );
  })()
);
check(
  "an amount that does not parse earns nothing",
  salePlan({ sale: { subtotal: "abc" } }) === "" && salePlan({ sale: { discount: "x" } }) === ""
);
check(
  "a reversal never credits someone the sale no longer earns for",
  salePlan({ lines: [saleLine(-5, "member_x")] }) === "member_a:12@sale:sale_1:earn:1"
);
check(
  "every write is a valid ledger entry, priced at the sale's rate",
  [
    planSaleLoyalty(saleFacts(), LIVE),
    planSaleLoyalty(
      saleFacts({
        lines: [saleLine(12)],
        member: SALE_MEMBER_B,
        optIn: { customerId: "cust_b" },
        sale: { customerId: "cust_b" }
      }),
      LIVE
    )
  ]
    .flatMap((plan) => plan.writes)
    .every((entry) => {
      const parsed = loyaltyLedgerEntrySchema.safeParse({
        actorUserId: null,
        amountPerPoint: entry.amountPerPoint,
        idempotencyKey: entry.correction.idempotencyKey,
        memberId: entry.memberId,
        note: null,
        points: entry.correction.points,
        sourceId: entry.correction.sourceId,
        sourceType: entry.correction.sourceType,
        type: entry.correction.type
      });

      return parsed.success && entry.amountPerPoint === "100.00";
    })
);
check(
  "a sale may earn and reverse, never spend or adjust, and must name itself",
  ledgerEntryProblem({ points: 5, sourceId: "s", sourceType: "SALE", type: "EARN" }) === null &&
    ledgerEntryProblem({ points: -5, sourceId: "s", sourceType: "SALE", type: "EARN_REVERSAL" }) ===
      null &&
    ledgerEntryProblem({ points: -5, sourceId: "s", sourceType: "SALE", type: "REDEEM" }) !==
      null &&
    ledgerEntryProblem({
      points: 5,
      sourceId: "s",
      sourceType: "SALE",
      type: "REDEEM_REVERSAL"
    }) !== null &&
    ledgerEntryProblem({ points: 5, sourceId: "s", sourceType: "SALE", type: "ADJUSTMENT" }) !==
      null &&
    ledgerEntryProblem({ points: 5, sourceId: null, sourceType: "SALE", type: "EARN" }) ===
      "A sale entry must name its sale." &&
    LOYALTY_LEDGER_KEY_PATTERN.test("sale:sale_1:earn:3") &&
    !LOYALTY_LEDGER_KEY_PATTERN.test("sales:sale_1:earn:3")
);

console.log("\n=== Offline sales: opt-in and lifecycle ===");

check(
  "the opt-in follows the box, and an unshown box keeps it — unless the customer changed",
  resolveSaleOptIn({ choice: "in", customerId: "cust_a", existing: null }) === "record" &&
    resolveSaleOptIn({
      choice: "out",
      customerId: "cust_a",
      existing: { customerId: "cust_a" }
    }) === "remove" &&
    resolveSaleOptIn({ choice: "out", customerId: "cust_a", existing: null }) === "unchanged" &&
    resolveSaleOptIn({
      choice: "keep",
      customerId: "cust_a",
      existing: { customerId: "cust_a" }
    }) === "unchanged" &&
    resolveSaleOptIn({
      choice: "keep",
      customerId: "cust_b",
      existing: { customerId: "cust_a" }
    }) === "remove" &&
    resolveSaleOptIn({ choice: "keep", customerId: null, existing: { customerId: "cust_a" } }) ===
      "remove" &&
    resolveSaleOptIn({ choice: "keep", customerId: "cust_a", existing: null }) === "unchanged"
);

const saleLoyaltySource = code(read(join(MODULE_DIR, "loyalty.sales.ts")));
const applyOptIn = functionBody(saleLoyaltySource, "applySaleLoyaltyOptIn");
check(
  "recording an opt-in is checked on the server: plan, programme, membership in this store, not suspended",
  (() => {
    const order = [
      'if (action === "remove")',
      'throw new PlanFeatureError("loyalty")',
      "if (!context.live)",
      "client.loyaltyMember.findFirst(",
      "member.suspendedAt !== null",
      "client.saleLoyaltyOptIn.upsert("
    ].map((marker) => applyOptIn.indexOf(marker));

    return (
      order.every(
        (index, position) => index > -1 && (position === 0 || index > (order[position - 1] ?? 0))
      ) &&
      /where: \{\s*customerId: input\.customerId,\s*storeId\s*\}/.test(applyOptIn) &&
      /where: \{\s*saleId: input\.saleId,\s*storeId\s*\}/.test(applyOptIn)
    );
  })()
);
check(
  "withdrawing an opt-in is never refused, whatever the plan",
  applyOptIn.indexOf("deleteMany(") > -1 &&
    applyOptIn.indexOf("deleteMany(") < applyOptIn.indexOf("PlanFeatureError")
);
const reconcileSale = functionBody(saleLoyaltySource, "reconcileSaleLoyalty");
check(
  "the sale row is locked before its ledger rows are read, and only this store's SALE rows are read",
  reconcileSale.indexOf("client.sale.updateMany(") > -1 &&
    reconcileSale.indexOf("client.sale.updateMany(") <
      reconcileSale.indexOf("client.loyaltyTransaction.findMany(") &&
    (reconcileSale.match(/sourceType: "SALE",\s*storeId/g) ?? []).length === 2 &&
    /if \(!context\.live\) \{[\s\S]*?loyaltyTransaction\.count\([\s\S]*?if \(recorded === 0\)/.test(
      reconcileSale
    )
);
check(
  "every planned row goes through the ledger's own writer and schema",
  /for \(const entry of plan\.writes\) \{[\s\S]*?appendLoyaltyLedgerEntry\([\s\S]*?loyaltyLedgerEntrySchema\.parse\(/.test(
    reconcileSale
  ) && !/loyaltyTransaction\.create\(/.test(saleLoyaltySource)
);
check(
  "creating and editing a sale record the opt-in and reconcile in the sale's own transaction, after the write",
  ["createSale", "updateSale"].every((name) => {
    const body = functionBody(code(salesSource.service), name);
    const write = name === "createSale" ? "tx.sale.create(" : "tx.sale.update(";

    return (
      body.indexOf("const loyalty = await prepareSaleLoyalty(context.storeId);") > -1 &&
      body.indexOf("prepareSaleLoyalty(") < body.indexOf("prisma.$transaction(") &&
      body.indexOf(write) < body.indexOf("applySaleLoyaltyOptIn(tx,") &&
      body.indexOf("applySaleLoyaltyOptIn(tx,") < body.indexOf("reconcileSaleLoyalty(tx,")
    );
  })
);
check(
  "voiding a sale reconciles after the cancellation, so its points come back",
  (() => {
    const body = functionBody(code(salesSource.service), "voidSale");

    return (
      body.indexOf("prepareSaleLoyalty(") < body.indexOf("prisma.$transaction(") &&
      body.indexOf('status: "CANCELLED"') <
        body.indexOf("reconcileSaleLoyalty(tx, context.storeId, saleId, loyalty)")
    );
  })()
);
check(
  "every write to a sale is one of those three, so no path changes a sale without reconciling",
  readdirSync(MODULES, { recursive: true })
    .map(String)
    .filter((name) => /\.tsx?$/.test(name))
    .filter((name) =>
      /\btx\.sale\.(create|update|updateMany|delete)\(|prisma\.sale\.(create|update|updateMany|delete|deleteMany)\(/.test(
        code(read(join(MODULES, name)))
      )
    )
    .map((name) => name.replace(/\\/g, "/"))
    .join(",") === "sales/sale.service.ts"
);
check(
  "the box is read as kept unless the form says it showed it, and the actor comes from the session",
  (() => {
    const actions = read(join(MODULES, "sales", "sale.actions.ts"));

    return (
      /if \(formData\.get\("loyaltyOptInShown"\) !== "1"\) \{\s*return "keep";\s*\}/.test(
        actions
      ) &&
      actions.includes('return formData.get("loyaltyOptIn") === "on" ? "in" : "out";') &&
      actions.includes("userId: (await getCurrentUser())?.id ?? null") &&
      !/formData\.get\("(userId|memberId|points)"\)/.test(actions)
    );
  })()
);
check(
  "the edit form only shows a ticked box for consent the sale's current customer gave",
  /return optIn !== null && sale\.customerId !== null && optIn\.customerId === sale\.customerId;/.test(
    code(source.service)
  ) && salesSource.editPage.includes("const loyaltyOptedIn = await isSaleOptedIn(store.id, sale);")
);
check(
  "online orders are untouched: they still reconcile only ORDER rows",
  (code(read(join(MODULE_DIR, "loyalty.orders.ts"))).match(/sourceType: "ORDER",\s*storeId/g) ?? [])
    .length === 2
);
check(
  "the schema adds the SALE source and an opt-in table, and no column to sales",
  (() => {
    const schema = read(join(ROOT, "packages", "db", "prisma", "schema.prisma"));
    const optIn = /model SaleLoyaltyOptIn \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? "";
    const sale = /model Sale \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? "";

    return (
      /enum LoyaltySourceType \{\s*ORDER\s*MANUAL\s*SALE\s*\}/.test(schema) &&
      /saleId\s+String\s+@id @map\("sale_id"\)/.test(optIn) &&
      /customerId\s+String\s+@map\("customer_id"\)/.test(optIn) &&
      /sale\s+Sale\s+@relation\(fields: \[saleId\], references: \[id\], onDelete: Cascade\)/.test(
        optIn
      ) &&
      /@@map\("sale_loyalty_opt_ins"\)/.test(optIn) &&
      /loyaltyOptIn\s+SaleLoyaltyOptIn\?/.test(sale) &&
      !/loyalty\w*\s+(Boolean|DateTime|String|Int)/.test(sale)
    );
  })()
);
check(
  "the member's history links a sale's rows to the sale",
  read(join(MODULE_DIR, "components", "loyalty-ledger-table.tsx")).includes(
    'entry.sourceType === "SALE" && entry.sourceId ? ('
  )
);

console.log("\n=== Offline sales: the counter (new customers and joining) ===");

const counterSource = {
  actions: code(read(join(MODULES, "sales", "sale.actions.ts"))),
  create: read(join(MODULES, "sales", "components", "sale-customer-create.tsx")),
  customerService: code(read(join(MODULES, "customers", "customer.service.ts"))),
  join: read(join(MODULES, "sales", "components", "sale-membership-join.tsx")),
  loyaltyService: code(source.service),
  picker: salesSource.picker
};

check(
  "a walk-in sale needs no customer: the form posts an empty id and the schema leaves it out",
  /<input name="customerId" type="hidden" value=\{selected\?\.id \?\? ""\} \/>/.test(
    counterSource.picker
  ) &&
    /customerId: z\s*\.string\(\)\s*\.trim\(\)\s*\.optional\(\)/.test(
      read(join(MODULES, "sales", "sale.schema.ts"))
    )
);
check(
  "a customer saved at the counter needs a name and a number in a phone's shape, the rules checkout applies",
  !counterCustomerSchema.safeParse({ name: "", phone: "" }).success &&
    !counterCustomerSchema.safeParse({ name: "R", phone: "01712345678" }).success &&
    !counterCustomerSchema.safeParse({ name: "Rahim", phone: "abc12345" }).success &&
    !counterCustomerSchema.safeParse({ name: "Rahim", phone: "0171" }).success &&
    JSON.stringify(
      counterCustomerSchema.safeParse({ name: "  Rahim  ", phone: " +880 1712-345678 " }).data
    ) === JSON.stringify({ name: "Rahim", phone: "+880 1712-345678" })
);
check(
  "a Bangladesh number is stored in one spelling, so the unique index settles two saves of it; anything else as typed",
  customerPhoneForStorage("+880 1712-345678") === "01712345678" &&
    customerPhoneForStorage("1712345678") === "01712345678" &&
    customerPhoneForStorage(" +44 20 7946 0958 ") === "+44 20 7946 0958"
);
check(
  "an existing customer is found on the whole number in any spelling, never on part of it",
  customerPhoneMatchKey("+8801712345678") === customerPhoneMatchKey("017-1234 5678") &&
    findSaleCustomersByPhone(saleCustomers, "+880 1712-345678")
      .map((option) => option.id)
      .join() === "c_member" &&
    findSaleCustomersByPhone(saleCustomers, "01811112222")
      .map((option) => option.id)
      .join() === "c_none" &&
    findSaleCustomersByPhone(saleCustomers, "1712").length === 0 &&
    findSaleCustomersByPhone(saleCustomers, "01700000000").length === 0
);
check(
  "a search with no match pre-fills a number as the phone and anything else as the name",
  JSON.stringify(newCustomerDraft(" 01712 345678 ")) ===
    JSON.stringify({ name: "", phone: "01712 345678" }) &&
    JSON.stringify(newCustomerDraft("+880 1712-345678")) ===
      JSON.stringify({ name: "", phone: "+880 1712-345678" }) &&
    JSON.stringify(newCustomerDraft("Rahim")) === JSON.stringify({ name: "Rahim", phone: "" }) &&
    JSON.stringify(newCustomerDraft("Rahim 2")) === JSON.stringify({ name: "Rahim 2", phone: "" })
);
(() => {
  const saved = toSaleCustomerOption(SALE_STORE, {
    email: null,
    id: "c_new",
    loyaltyMember: null,
    name: "New Walk-in",
    phone: "01799998888"
  });
  const joined = toSaleCustomerOption(SALE_STORE, {
    email: "walkin@example.com",
    id: "c_none",
    loyaltyMember: { pointsBalance: 0, storeId: SALE_STORE, suspendedAt: null },
    name: "Nadia Walk-in",
    phone: "01811112222"
  });
  const merged = mergeSaleCustomerOptions(saleCustomers, [joined, saved]);

  check(
    "what the counter learns is laid over the page's list: a saved customer first, a new membership replacing the old copy, nobody twice",
    merged[0]?.id === "c_new" &&
      merged.length === saleCustomers.length + 1 &&
      new Set(merged.map((option) => option.id)).size === merged.length &&
      merged.find((option) => option.id === "c_none")?.membership?.status === "active" &&
      mergeSaleCustomerOptions(saleCustomers, []).length === saleCustomers.length
  );
})();
check(
  "joining is asked only of a non-member while the programme runs — never of a member or a suspended one",
  canOfferMembershipJoin(noneOption ?? null, true) &&
    !canOfferMembershipJoin(noneOption ?? null, false) &&
    !canOfferMembershipJoin(memberOption ?? null, true) &&
    !canOfferMembershipJoin(suspendedOption ?? null, true) &&
    !canOfferMembershipJoin(null, true)
);
check(
  "the question starts at no, and nothing is sent until yes is ticked and the button pressed",
  counterSource.join.includes("const [wantsToJoin, setWantsToJoin] = useState(false);") &&
    /\{wantsToJoin \? \(/.test(counterSource.join) &&
    counterSource.join.indexOf("{wantsToJoin ? (") <
      counterSource.join.indexOf("onClick={enroll}") &&
    (counterSource.join.match(/enrollSaleCustomerAction\(/g) ?? []).length === 1 &&
    functionBody(counterSource.join, "SaleMembershipJoin").includes("onClick={enroll}")
);
check(
  "the counter's inputs post nothing with the sale, Enter never submits it, and a save in flight cannot be sent twice",
  [counterSource.create, counterSource.join].every(
    (text) =>
      !/\bname="/.test(text) &&
      /if \(inFlight\.current\b/.test(text) &&
      /disabled=\{isPending/.test(text)
  ) &&
    (counterSource.create.match(/onKeyDown=\{saveOnEnter\}/g) ?? []).length === 2 &&
    /if \(event\.key === "Enter"\) \{\s*event\.preventDefault\(\);/.test(counterSource.create) &&
    /onKeyDown=\{pickFirstOnEnter\}/.test(counterSource.picker) &&
    /if \(event\.key === "Enter"\) \{\s*event\.preventDefault\(\);/.test(counterSource.picker)
);
check(
  "joining does not opt the sale in: the earn box starts unticked for the member just added",
  /function memberJoined\([\s\S]*?\n {2}\}/
    .exec(counterSource.picker)?.[0]
    .includes("setOptedIn") === false &&
    /setOptedIn\(id !== "" && id === defaultCustomerId && defaultOptedIn === true\);/.test(
      counterSource.picker
    )
);
check(
  "saving a customer: the sales plan, this store from the session, a name and a number from the browser and nothing else",
  (() => {
    const body = functionBody(counterSource.actions, "createSaleCustomerAction");

    return (
      /createSaleCustomerAction\(input: \{\s*name: string;\s*phone: string;\s*\}\)/.test(body) &&
      body.indexOf("const store = await requireStore();") > -1 &&
      body.indexOf('requirePlanFeature(store.id, "sales")') > -1 &&
      body.indexOf('requirePlanFeature(store.id, "sales")') <
        body.indexOf("createCounterCustomer(store.id, input)")
    );
  })()
);
check(
  "a number already here returns the existing customers instead of a second record, before and after the insert",
  (() => {
    const body = functionBody(counterSource.customerService, "createCounterCustomer");

    return (
      body.indexOf("counterCustomerSchema.parse(input)") > -1 &&
      body.indexOf("findCustomersByPhone(storeId, data.phone)") <
        body.indexOf("createCustomerRecord(") &&
      /if \(existing\.length > 0\) \{\s*return \{ matches: existing, status: "duplicate" \};/.test(
        body
      ) &&
      /isUniqueConstraintError\(error, "phone"\)/.test(body) &&
      body.includes("phone: customerPhoneForStorage(data.phone)") &&
      !/\.update\(|upsert\(/.test(body)
    );
  })()
);
check(
  "every customer read and write on the counter path is scoped to the store",
  (() => {
    const repository = code(read(join(MODULES, "customers", "customer.repository.ts")));

    return (
      functionBody(repository, "findCustomerPickRecords").includes(
        "where: { id: { in: customerIds }, storeId }"
      ) &&
      functionBody(repository, "listCustomerPhonesForStore").includes("where: { storeId }") &&
      /createCustomerRecord\(data: \{ name: string; phone: string; storeId: string \}\)/.test(
        repository
      )
    );
  })()
);
check(
  "joining at the counter: this store from the session, the actor from the session, only a customer id from the browser",
  (() => {
    const body = functionBody(counterSource.actions, "enrollSaleCustomerAction");

    return (
      /enrollSaleCustomerAction\(customerId: string\)/.test(body) &&
      body.includes("const store = await requireStore();") &&
      body.includes("const userId = (await getCurrentUser())?.id;") &&
      /enrollCustomerAtCounter\(store\.id, \{\s*customerId: String\(customerId \?\? ""\),\s*userId\s*\}\)/.test(
        body
      )
    );
  })()
);
check(
  "the counter enrolment re-reads plan, switch and customer, uses the customer row's own number, and goes through the one enrolment",
  (() => {
    const body = functionBody(counterSource.loyaltyService, "enrollCustomerAtCounter");
    const transaction = body.indexOf("prisma.$transaction(");

    return (
      body.indexOf('await requirePlanFeature(storeId, "loyalty");') > -1 &&
      body.indexOf('await requirePlanFeature(storeId, "loyalty");') < transaction &&
      body.indexOf("(await getLoyaltySettings(storeId)).enabled") > -1 &&
      body.indexOf("(await getLoyaltySettings(storeId)).enabled") < transaction &&
      /where: \{\s*id: customerId,\s*storeId\s*\}/.test(body) &&
      body.includes("phone: customer.phone,") &&
      body.includes("return enrollLoyaltyMember(tx, {") &&
      !/loyaltyMember\.(create|update|upsert)|createMany|appendLoyaltyLedgerEntry|saleLoyaltyOptIn/.test(
        body
      )
    );
  })()
);
check(
  "a conflict is reported to the employee and logged — no fake order is filed and nothing is merged",
  (() => {
    const body = functionBody(counterSource.loyaltyService, "enrollCustomerAtCounter");

    return (
      !body.includes("upsertLoyaltyConflict") &&
      (body.match(/await logLoyaltyAudit\(\{/g) ?? []).length === 2 &&
      /holderCustomerId:\s*\(await findLoyaltyMemberById\(storeId, enrollment\.memberId\)\)/.test(
        body
      ) &&
      counterSource.join.includes("onClick={() => result.holder && onUseHolder(result.holder)}")
    );
  })()
);
check(
  "a refused join or save comes back as a message, never a crash, so the sale can still be saved",
  ["createSaleCustomerAction", "enrollSaleCustomerAction"].every((name) =>
    /\} catch \(error\) \{\s*return counterErrorState\(\s*error,/.test(
      functionBody(counterSource.actions, name)
    )
  ) &&
    functionBody(counterSource.actions, "counterErrorState").includes("return { message: fallback")
);

await scenario("a member who joins at the counter earns only on a sale they opt into", async () => {
  const db = new FakeLedgerDb();
  const joinedAt = new Date(2026, 9, 22, 11, 0);
  const enrolment = await db.transaction((client) =>
    enrollLoyaltyMember(client, {
      customerId: "cust_counter",
      enrolledAt: joinedAt,
      phone: "01755554444",
      storeId: STORE
    })
  );
  const again = await db.transaction((client) =>
    enrollLoyaltyMember(client, {
      customerId: "cust_counter",
      enrolledAt: new Date(joinedAt.getTime() + 5_000),
      phone: "01755554444",
      storeId: STORE
    })
  );
  const member = enrolment.action === "enrolled" ? db.members.get(enrolment.memberId) : undefined;

  check(
    "the counter enrols once: pressing it again finds the same membership",
    enrolment.action === "enrolled" &&
      again.action === "existing" &&
      again.memberId === enrolment.memberId &&
      db.members.size === 1 &&
      member?.pointsBalance === 0
  );

  const counterSale = (
    sale: Partial<SaleLoyaltyFacts["sale"]>,
    optIn: { customerId: string } | null = { customerId: "cust_counter" }
  ) =>
    writesOf(
      planSaleLoyalty(
        {
          lines: [],
          member: member
            ? {
                customerId: member.customerId,
                enrolledAt: member.enrolledAt,
                id: member.id,
                suspendedAt: member.suspendedAt
              }
            : null,
          optIn,
          sale: {
            createdAt: new Date(joinedAt.getTime() + 60_000),
            customerId: "cust_counter",
            discount: "0.00",
            id: "sale_counter",
            paymentStatus: "PAID",
            saleDate: new Date(2026, 9, 22),
            status: "COMPLETED",
            subtotal: "1000.00",
            ...sale
          }
        },
        LIVE
      )
    );

  check(
    "the sale saved right after joining earns when completed, paid and opted in",
    counterSale({}) === `${member?.id}:10@sale:sale_counter:earn:0`,
    counterSale({})
  );
  check("joining alone earns nothing: no opt-in, no points", counterSale({}, null) === "");
  check(
    "unpaid, partly paid, draft or cancelled counter sales earn nothing",
    counterSale({ paymentStatus: "UNPAID" }) === "" &&
      counterSale({ paymentStatus: "PARTIAL" }) === "" &&
      counterSale({ status: "DRAFT" }) === "" &&
      counterSale({ status: "CANCELLED" }) === ""
  );
  check(
    "a sale recorded before they joined never earns, even if it is edited afterwards",
    counterSale({ createdAt: new Date(joinedAt.getTime() - 60_000) }) === "" &&
      counterSale({ saleDate: new Date(2026, 9, 21) }) === ""
  );
  check(
    "with the programme off, joining still leaves a sale that saves and earns nothing",
    writesOf(
      planSaleLoyalty(
        {
          lines: [],
          member: member
            ? {
                customerId: member.customerId,
                enrolledAt: member.enrolledAt,
                id: member.id,
                suspendedAt: null
              }
            : null,
          optIn: { customerId: "cust_counter" },
          sale: {
            createdAt: new Date(joinedAt.getTime() + 60_000),
            customerId: "cust_counter",
            discount: "0.00",
            id: "sale_counter",
            paymentStatus: "PAID",
            saleDate: new Date(2026, 9, 22),
            status: "COMPLETED",
            subtotal: "1000.00"
          }
        },
        { ...LIVE, live: false }
      )
    ) === ""
  );

  const clash = await db.transaction((client) =>
    enrollLoyaltyMember(client, {
      customerId: "cust_other_spelling",
      enrolledAt: new Date(joinedAt.getTime() + 120_000),
      phone: "+880 1755-554444",
      storeId: STORE
    })
  );
  check(
    "another customer record on the same number is a conflict at the counter too: no second membership, nothing merged",
    clash.action === "conflict" &&
      clash.memberId === enrolment.memberId &&
      db.members.size === 1 &&
      db.members.get(clash.memberId)?.customerId === "cust_counter"
  );
});

console.log(
  failures === 0
    ? "\nLoyalty: all checks passed."
    : `\nLoyalty: ${failures} check${failures === 1 ? "" : "s"} failed.`
);

process.exit(failures === 0 ? 0 : 1);
