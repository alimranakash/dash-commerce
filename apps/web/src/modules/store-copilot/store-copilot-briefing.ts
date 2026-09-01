import { classifyStoreCopilotQuestion } from "./store-copilot-intent";
import { storeCopilotToolRunners } from "./store-copilot-tools";
import type { StoreCopilotTool } from "./store-copilot.schema";

/**
 * The answer a store gets with no provider key — and the answer every store
 * gets when its provider is down.
 *
 * This is not a placeholder. It reads the same tools the model reads and states
 * the same figures; what it cannot do is understand a question it has no
 * keyword for, or hold a conversation across turns. That trade is deliberate:
 * a merchant who has not added a Gemini or OpenAI key still gets today's
 * revenue, their pending orders and their low stock in one sentence each,
 * rather than a page telling them to go and configure something.
 *
 * It is labelled `offline` all the way to the browser, and the chat says in
 * plain words that no AI wrote it. The one thing worse than a template answer
 * is a template answer a merchant believes came from a model.
 */

export type StoreCopilotBriefing = {
  answer: string;
  followUps: string[];
  used: StoreCopilotTool[];
};

export async function composeStoreCopilotBriefing(
  storeId: string,
  question: string
): Promise<StoreCopilotBriefing> {
  const intent = classifyStoreCopilotQuestion(question);
  const overview = await storeCopilotToolRunners.store_overview(storeId);
  const currency = overview.currency;
  const used: StoreCopilotTool[] = ["store_overview"];

  if (intent === "inventory") {
    const inventory = await storeCopilotToolRunners.list_inventory(storeId, {
      filter: "low",
      limit: 10
    });

    used.push("list_inventory");

    const lines = inventory.data.map(
      (item) =>
        `${item.title} — ${item.stockQuantity} left${
          item.state === "out_of_stock" ? " (out of stock)" : ""
        }`
    );

    // The catalogue-wide count is deliberately only quoted when the list is
    // empty. `summary.lowStockProducts` counts products under their own
    // threshold, while this list is the "low" *filter*, which also includes
    // everything already at zero — so printing both next to each other reads as
    // a contradiction ("1 product needs attention … 0 products are low").
    return {
      answer: paragraphs([
        lines.length
          ? `${lines.length} ${plural(lines.length, "product is", "products are")} low or out of stock:`
          : `Nothing is low or out of stock across all ${overview.summary.totalProducts} ${plural(overview.summary.totalProducts, "product", "products")}.`,
        ...lines
      ]),
      followUps: ["Which products are out of stock?", "How many orders are pending?"],
      used
    };
  }

  if (intent === "customers") {
    const customers = await storeCopilotToolRunners.list_customers(storeId, { limit: 5 });

    used.push("list_customers");

    const ranked = [...customers.data].sort(
      (left, right) => Number(right.totalSpent) - Number(left.totalSpent)
    );

    return {
      answer: paragraphs([
        ranked.length ? "Your customers by lifetime spend:" : "No customers have ordered yet.",
        ...ranked.map(
          (customer) =>
            `${customer.name} — ${money(customer.totalSpent, customer.currency || currency)} across ${customer.orderCount} ${plural(customer.orderCount, "order", "orders")}`
        )
      ]),
      followUps: ["Who ordered most recently?", "How much did we sell this month?"],
      used
    };
  }

  if (intent === "products") {
    const top = overview.topProducts.slice(0, 5);

    return {
      answer: paragraphs([
        top.length ? "Your best sellers:" : "Nothing has sold yet, so there is no ranking.",
        ...top.map(
          (product) =>
            `${product.title} — ${product.quantitySold} sold, ${money(product.revenue, currency)}`
        ),
        `You have ${overview.summary.totalProducts} ${plural(overview.summary.totalProducts, "product", "products")} in the catalogue.`
      ]),
      followUps: ["Which products are low on stock?", "How much did we sell today?"],
      used
    };
  }

  if (intent === "orders") {
    const recent = overview.recentOrders.slice(0, 5);

    return {
      answer: paragraphs([
        `${overview.summary.totalOrders} ${plural(overview.summary.totalOrders, "order", "orders")} in total, ${overview.summary.pendingOrders} still pending.`,
        ...(recent.length ? ["Most recent:"] : []),
        ...recent.map(
          (order) =>
            `${order.orderNumber} — ${money(order.totalAmount, order.currency || currency)}, ${order.status.toLowerCase()}, ${order.customerName}`
        )
      ]),
      followUps: ["How many orders are pending?", "How much did we sell this month?"],
      used
    };
  }

  if (intent === "revenue") {
    return {
      answer: paragraphs([
        `Today: ${money(overview.summary.todayRevenue, currency)}. This month: ${money(overview.summary.thisMonthRevenue, currency)}.`,
        `You have taken ${overview.summary.totalOrders} ${plural(overview.summary.totalOrders, "order", "orders")} all time, and ${overview.summary.pendingOrders} ${plural(overview.summary.pendingOrders, "is", "are")} pending right now.`
      ]),
      followUps: ["What are my best sellers?", "Which products are low on stock?"],
      used
    };
  }

  return {
    answer: paragraphs([
      `${overview.store?.name ?? "Your store"} today: ${money(overview.summary.todayRevenue, currency)} in sales, ${overview.summary.pendingOrders} pending ${plural(overview.summary.pendingOrders, "order", "orders")}.`,
      `This month: ${money(overview.summary.thisMonthRevenue, currency)}.`,
      `All time you have taken ${overview.summary.totalOrders} ${plural(overview.summary.totalOrders, "order", "orders")}. You are selling ${overview.summary.totalProducts} ${plural(overview.summary.totalProducts, "product", "products")}, ${overview.summary.lowStockProducts} of them under their low-stock threshold.`
    ]),
    followUps: [
      "How much did we sell this month?",
      "Which products are low on stock?",
      "What are my best sellers?"
    ],
    used
  };
}

function paragraphs(lines: string[]) {
  return lines.filter(Boolean).join("\n");
}

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many;
}

/**
 * Money as the rest of the app states it: a string, never a float.
 *
 * The services hand over `"1240.00"` for exactly that reason, so this formats
 * rather than computes — a briefing that rounded would disagree with the
 * dashboard by a taka and there would be no way to tell which was right.
 */
function money(amount: string, currency: string) {
  return `${currency} ${amount}`;
}
