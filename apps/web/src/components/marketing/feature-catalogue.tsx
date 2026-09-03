import {
  Award,
  Ban,
  BarChart3,
  Bell,
  BellRing,
  Blocks,
  Bot,
  Box,
  Boxes,
  Braces,
  Building2,
  CalendarClock,
  ChartNoAxesCombined,
  CircleDollarSign,
  ClipboardList,
  Coins,
  Compass,
  CreditCard,
  Crosshair,
  Eye,
  FileText,
  Filter,
  Gift,
  Globe,
  Handshake,
  Heart,
  Image,
  KeyRound,
  Layers,
  LayoutTemplate,
  LineChart,
  Link2,
  Locate,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Moon,
  MousePointerClick,
  PackagePlus,
  PackageSearch,
  Palette,
  PieChart,
  Plug,
  Radar,
  Rocket,
  RotateCcw,
  Route,
  Search,
  Send,
  Share2,
  ShieldAlert,
  ShoppingBag,
  ShoppingCart,
  Signal,
  Smartphone,
  Sparkles,
  Store,
  Tags,
  Target,
  Ticket,
  Timer,
  Truck,
  Undo2,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  Wand2,
  Warehouse,
  Zap
} from "lucide-react";
import type { ComponentType } from "react";
import styles from "./landing-page.module.css";
import { PLAN_CATALOG } from "../../modules/admin/plan-catalog";
import type { PlanFeatureKey } from "../../modules/billing/plan-features";
import { PLAN_FEATURE_KEYS, PLAN_FEATURE_REGISTRY } from "../../modules/billing/plan-features";

/**
 * The full capability index, sitting under the feature bento.
 *
 * The bento above sells nine headline modules. This is the list a seller
 * comparing platforms actually wants: every capability the product has, grouped
 * the way the dashboard is, with the plan each one unlocks on.
 *
 * Nothing here is written twice. Labels, blurbs and the "Soon" tag come from
 * `PLAN_FEATURE_REGISTRY`, and the tier badge is the lowest-priced plan in
 * `PLAN_CATALOG` whose feature list contains the key — the same rule the pricing
 * cards and the comparison table follow, for the same reason: the marketing page
 * must not be able to advertise an entitlement the product does not grant.
 *
 * `featureGroups` and `featureIcons` are `Record<PlanFeatureKey, ...>` rather
 * than arrays on purpose. Adding a key to the registry without placing it in a
 * group is then a type error at `npm run typecheck`, so a capability cannot ship
 * and quietly go unlisted here.
 *
 * `ungatedFeatures` holds the other half: capabilities every plan has, so there
 * is no feature key to read them from. Only surfaces that actually ship are
 * listed — a dashboard panel with no data source behind it is not a feature.
 */

type FeatureGroupId =
  | "ai"
  | "analytics"
  | "automation"
  | "checkout"
  | "conversion"
  | "marketing"
  | "operations"
  | "orders"
  | "risk"
  | "storefront";

type FeatureIcon = ComponentType<{ className?: string }>;

type CatalogueEntry = {
  description: string;
  icon: FeatureIcon;
  planned: boolean;
  /** The plan this unlocks on, or `null` when every plan already includes it. */
  tier: string | null;
  title: string;
};

const groupOrder: { id: FeatureGroupId; text: string; title: string }[] = [
  {
    id: "storefront",
    text: "The shop your customers see, and everything it puts in front of them.",
    title: "Storefront & catalog"
  },
  {
    id: "checkout",
    text: "How an order actually gets placed and paid for in Bangladesh.",
    title: "Cart, checkout & payments"
  },
  {
    id: "conversion",
    text: "The offers, nudges and recovery that turn a visit into a sale.",
    title: "Selling & conversion"
  },
  {
    id: "orders",
    text: "From confirmed to delivered, and back again when it has to come back.",
    title: "Orders & delivery"
  },
  {
    id: "risk",
    text: "Fewer fake orders, fewer refused parcels, fewer deliveries you pay for twice.",
    title: "Order risk & trust"
  },
  {
    id: "marketing",
    text: "Reach the customers you already have, on the channels they actually use.",
    title: "Marketing"
  },
  {
    id: "automation",
    text: "Journeys that keep running after you close the dashboard.",
    title: "Automation"
  },
  {
    id: "analytics",
    text: "Know what is working before you spend more money on it.",
    title: "Analytics & tracking"
  },
  {
    id: "ai",
    text: "Three assistants: one for you, one for your catalogue, one for your shoppers.",
    title: "StoreIM AI"
  },
  {
    id: "operations",
    text: "The back office behind the shopfront.",
    title: "Operations & team"
  }
];

/** Where every gated capability appears. Exhaustive by type — see the note above. */
const featureGroups: Record<PlanFeatureKey, FeatureGroupId> = {
  abandoned_cart: "conversion",
  advanced_analytics: "analytics",
  advanced_attribution: "analytics",
  affiliate_tracking: "marketing",
  ai_copilot: "ai",
  ai_product_content: "ai",
  ai_shopping_agent: "ai",
  api_access: "operations",
  audiences: "marketing",
  blocked_ips: "risk",
  bundles: "conversion",
  campaigns: "marketing",
  courier_api: "orders",
  coupons: "conversion",
  custom_domain: "storefront",
  custom_tracking: "analytics",
  email_automation: "automation",
  exchanges: "orders",
  expenses: "operations",
  facebook_automation: "automation",
  fake_orders: "risk",
  footer_branding: "storefront",
  fraud_check: "risk",
  google_ads_tracking: "analytics",
  google_analytics: "analytics",
  gtm_tracking: "analytics",
  incomplete_orders: "conversion",
  inventory: "storefront",
  marketing_analytics: "marketing",
  marketing_automation: "automation",
  marketing_templates: "marketing",
  meta_pixel: "analytics",
  notification_bar: "conversion",
  order_bump: "conversion",
  order_tracking: "orders",
  order_verification: "risk",
  preorders: "storefront",
  purchases: "operations",
  refunds: "orders",
  returns: "orders",
  sales: "operations",
  sales_notifications: "conversion",
  search_discovery: "storefront",
  server_side_tracking: "analytics",
  sms_automation: "automation",
  sms_notifications: "marketing",
  suppliers: "operations",
  team: "operations",
  tiktok_tracking: "analytics",
  upsell_cross_sell: "conversion",
  whatsapp_automation: "automation"
};

const featureIcons: Record<PlanFeatureKey, FeatureIcon> = {
  abandoned_cart: Timer,
  advanced_analytics: ChartNoAxesCombined,
  advanced_attribution: Route,
  affiliate_tracking: Handshake,
  ai_copilot: Bot,
  ai_product_content: Wand2,
  ai_shopping_agent: Sparkles,
  api_access: Plug,
  audiences: Filter,
  blocked_ips: Ban,
  bundles: Boxes,
  campaigns: Megaphone,
  courier_api: Truck,
  coupons: Ticket,
  custom_domain: Link2,
  custom_tracking: Braces,
  email_automation: Mail,
  exchanges: RotateCcw,
  expenses: Wallet,
  facebook_automation: Share2,
  fake_orders: ShieldAlert,
  footer_branding: Award,
  fraud_check: Radar,
  google_ads_tracking: Target,
  google_analytics: LineChart,
  gtm_tracking: Tags,
  incomplete_orders: ClipboardList,
  inventory: Warehouse,
  marketing_analytics: PieChart,
  marketing_automation: Rocket,
  marketing_templates: FileText,
  meta_pixel: Crosshair,
  notification_bar: BellRing,
  order_bump: PackagePlus,
  order_tracking: Locate,
  order_verification: UserCheck,
  preorders: CalendarClock,
  purchases: ShoppingBag,
  refunds: Undo2,
  returns: PackageSearch,
  sales: Store,
  sales_notifications: Bell,
  search_discovery: Search,
  server_side_tracking: Signal,
  sms_automation: Send,
  sms_notifications: MessageSquare,
  suppliers: Building2,
  team: UserPlus,
  tiktok_tracking: MousePointerClick,
  upsell_cross_sell: Layers,
  whatsapp_automation: MessageCircle
};

const orderedPlans = [...PLAN_CATALOG].sort((a, b) => a.sortOrder - b.sortOrder);

/**
 * Cheapest plan that grants the key. Entitlements are hierarchical by
 * construction, so the badge also means "and every plan above it".
 */
function unlockTier(key: PlanFeatureKey): string | null {
  const plan = orderedPlans.find((entry) => entry.features.includes(key));

  return plan ? plan.name : null;
}

const posPlan = orderedPlans.find((plan) => plan.posEnabled);

/**
 * Capabilities with no feature key, because no plan withholds them. Each one is
 * a surface that ships today; anything still a placeholder stays off this list.
 */
const ungatedFeatures: Record<FeatureGroupId, CatalogueEntry[]> = {
  ai: [
    {
      description:
        "Bring your own Gemini or OpenAI key. It is encrypted, decrypted in one place, and never reaches a browser.",
      icon: KeyRound,
      planned: false,
      tier: null,
      title: "Your own AI provider"
    }
  ],
  analytics: [
    {
      description: "Revenue, orders, products, customers and stock, composed into one daily view.",
      icon: BarChart3,
      planned: false,
      tier: null,
      title: "Reports & dashboard"
    },
    {
      description:
        "A per-hostname XML sitemap, robots.txt, and a canonical URL on every storefront page.",
      icon: Globe,
      planned: false,
      tier: null,
      title: "SEO foundations"
    }
  ],
  automation: [],
  checkout: [
    {
      description: "A cart and a one-page checkout built around how Bangladeshi shoppers buy.",
      icon: ShoppingCart,
      planned: false,
      tier: null,
      title: "Cart & checkout"
    },
    {
      description: "Cash on delivery, tracked and verified like every other order.",
      icon: CircleDollarSign,
      planned: false,
      tier: null,
      title: "Cash on delivery"
    },
    {
      description: "bKash, Nagad and Rocket as manual payments, recorded against the order.",
      icon: Smartphone,
      planned: false,
      tier: null,
      title: "Mobile payments"
    },
    {
      description:
        "A second buy button that checks one product out on its own, leaving the cart untouched.",
      icon: Zap,
      planned: false,
      tier: null,
      title: "Direct Checkout"
    },
    {
      description:
        "A subtotal threshold or a flagged product waives delivery, and checkout charges exactly what the bar promised.",
      icon: Gift,
      planned: false,
      tier: null,
      title: "Free shipping rules"
    },
    {
      description: "Inside and Outside Dhaka rates seeded on day one, editable per zone.",
      icon: MapPin,
      planned: false,
      tier: null,
      title: "Shipping zones & rates"
    }
  ],
  conversion: [],
  marketing: [],
  operations: [
    {
      description: "Every order becomes a customer record with history, contact detail and value.",
      icon: Users,
      planned: false,
      tier: null,
      title: "Customers"
    },
    {
      description: "Money in and money out, recorded against the order that moved it.",
      icon: Coins,
      planned: false,
      tier: null,
      title: "Transactions"
    },
    {
      description: "Counter sales recorded against the same catalog and the same stock.",
      icon: CreditCard,
      planned: false,
      tier: posPlan ? posPlan.name : null,
      title: "Point of sale"
    }
  ],
  orders: [
    {
      description:
        "Pending to delivered, with customer context, payment state, fulfilment detail and a timeline.",
      icon: ClipboardList,
      planned: false,
      tier: null,
      title: "Order workflow"
    }
  ],
  risk: [],
  storefront: [
    {
      description:
        "Four business-type storefronts — beauty, electronics, fashion and general — each with its own homepage and product layout.",
      icon: LayoutTemplate,
      planned: false,
      tier: null,
      title: "Storefront templates"
    },
    {
      description: "Colours, typography, header, homepage sections, and the order they appear in.",
      icon: Palette,
      planned: false,
      tier: null,
      title: "Theme customization"
    },
    {
      description: "Catalog with options, variants, SKUs, pricing and per-product media.",
      icon: Box,
      planned: false,
      tier: null,
      title: "Products & variants"
    },
    {
      description: "A category tree with images, plus brands, tags and product attributes.",
      icon: Blocks,
      planned: false,
      tier: null,
      title: "Categories & brands"
    },
    {
      description: "Upload once, then reuse across products, categories and the homepage.",
      icon: Image,
      planned: false,
      tier: null,
      title: "Media library"
    },
    {
      description: "Storefront search with live suggestions, priced from the catalog itself.",
      icon: Compass,
      planned: false,
      tier: null,
      title: "Storefront search"
    },
    {
      description:
        "Shoppers open a product in a dialog over the grid, re-read from the catalog rather than quoted from the card.",
      icon: Eye,
      planned: false,
      tier: null,
      title: "Quick View"
    },
    {
      description: "Shoppers save what caught their eye and come back to it later.",
      icon: Heart,
      planned: false,
      tier: null,
      title: "Wishlist"
    },
    {
      description:
        "Dashboard and storefront in light, dark, or whatever the visitor's device already prefers.",
      icon: Moon,
      planned: false,
      tier: null,
      title: "Dark mode"
    },
    {
      description: "Seed a full demo catalog so the storefront is never empty on day one.",
      icon: PackageSearch,
      planned: false,
      tier: null,
      title: "Demo catalog"
    }
  ]
};

/** Shipping capabilities first, roadmap last, alphabetical inside each half. */
function byReadiness(a: CatalogueEntry, b: CatalogueEntry) {
  if (a.planned !== b.planned) return a.planned ? 1 : -1;

  return a.title.localeCompare(b.title);
}

const catalogueGroups = groupOrder.map((group) => {
  const gated: CatalogueEntry[] = PLAN_FEATURE_KEYS.filter(
    (key) => featureGroups[key] === group.id
  ).map((key) => {
    const definition = PLAN_FEATURE_REGISTRY[key];

    return {
      description: definition.description,
      icon: featureIcons[key],
      planned: definition.status === "planned",
      tier: unlockTier(key),
      title: definition.label
    };
  });

  return { ...group, items: [...ungatedFeatures[group.id], ...gated].sort(byReadiness) };
});

const catalogueTotal = catalogueGroups.reduce((total, group) => total + group.items.length, 0);

export function FeatureCatalogue() {
  return (
    <div className={styles.catalogue}>
      <div className={styles.catalogueHead}>
        <div className={styles.catalogueHeadCopy}>
          <span className={styles.catalogueEyebrow}>Full capability index</span>
          <h3>All {catalogueTotal} features, grouped the way you run the shop.</h3>
          <p>
            Not a highlights reel. This is everything StoreIM ships, with the plan each capability
            unlocks on, so you can find the one thing you actually need before you sign up.
          </p>
        </div>
        <ul className={styles.catalogueLegend}>
          <li>
            <i data-kind="all" /> On every plan
          </li>
          <li>
            <i data-kind="plan" /> Unlocks on that plan and above
          </li>
          <li>
            <i data-kind="soon" /> On the roadmap
          </li>
        </ul>
      </div>

      {catalogueGroups.map((group, index) => (
        <section className={styles.catalogueGroup} key={group.id}>
          <header className={styles.catalogueGroupHead}>
            <span className={styles.catalogueNumber}>{String(index + 1).padStart(2, "0")}</span>
            <div className={styles.catalogueGroupCopy}>
              <h4>{group.title}</h4>
              <p>{group.text}</p>
            </div>
            <small>{group.items.length} features</small>
          </header>
          <div className={styles.catalogueGrid}>
            {group.items.map((item) => (
              <CatalogueCard
                description={item.description}
                icon={item.icon}
                key={item.title}
                planned={item.planned}
                tier={item.tier}
                title={item.title}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function CatalogueCard({ description, icon: Icon, planned, tier, title }: CatalogueEntry) {
  return (
    <article className={styles.catalogueCard} data-planned={planned ? "true" : undefined}>
      <div className={styles.catalogueCardTop}>
        <span className={styles.catalogueIcon}>
          <Icon />
        </span>
        <div className={styles.catalogueTags}>
          <em className={styles.catalogueTag} data-tier={tier ? "plan" : "all"}>
            {tier ?? "All plans"}
          </em>
          {planned ? <i className={styles.catalogueSoon}>Soon</i> : null}
        </div>
      </div>
      <h5>{title}</h5>
      <p>{description}</p>
    </article>
  );
}
