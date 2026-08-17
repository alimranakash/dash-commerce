import {
  ArrowRight,
  BarChart3,
  Bot,
  Box,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CreditCard,
  PackageCheck,
  Percent,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Truck,
  Users
} from "lucide-react";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { ParallaxStage, TypingText } from "./landing-interactions";
import styles from "./landing-page.module.css";
import { PLAN_CATALOG } from "../../modules/admin/plan-catalog";

const features = [
  { icon: Store, title: "1 Minute Store Builder", text: "Launch a polished storefront with your brand, products, and domain." },
  { icon: Box, title: "Product & Inventory", text: "Manage catalog, stock levels, categories, pricing, and media in one place." },
  { icon: Users, title: "Orders & Customers", text: "Turn every order into an organized workflow and a lasting customer relationship." },
  { icon: Percent, title: "Coupons", text: "Create targeted offers that turn attention into completed purchases." },
  { icon: ShoppingCart, title: "Abandoned Cart", text: "See lost buying intent and prepare smart recovery campaigns." },
  { icon: CreditCard, title: "Payments", text: "Offer COD and Bangladesh-first manual payment methods with confidence." },
  { icon: Truck, title: "Courier", text: "Configure delivery zones today and connect courier automation tomorrow." },
  { icon: BarChart3, title: "Reports", text: "Understand revenue, orders, inventory, customers, and growth without spreadsheets." },
  { icon: Bot, title: "StoreOS AI Assistant", text: "Ask your store questions in natural language and get useful answers instantly." }
];

export function LandingPage() {
  return (
    <main className={styles.site}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Dash Commerce OS home">
          <span className={styles.brandMark}>D</span>
          <span>Dash Commerce <b>OS</b></span>
        </Link>
        <nav className={styles.nav} aria-label="Primary navigation">
          <a href="#story">Platform</a><a href="#journey">Journey</a><a href="#ai">AI</a><a href="#pricing">Pricing</a><Link href="/docs">Docs</Link>
        </nav>
        <div className={styles.headerActions}>
          <Link className={styles.loginLink} href="/login">Login</Link>
          <Link className={styles.primaryButton} href="/register">Start Free <ArrowRight /></Link>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroGlow} /><div className={styles.heroGrid} />
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}><Sparkles /> Commerce, finally in command</div>
          <h1>Launch, manage, and grow your online store with <span>AI.</span></h1>
          <p>Create a professional ecommerce store in minutes. Manage products, orders, payments, courier, reports, and AI insights from one powerful dashboard.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryButtonLarge} href="/register">Start Free <ArrowRight /></Link>
            <a className={styles.secondaryButton} href="#preview">View Demo <ChevronRight /></a>
          </div>
          <div className={styles.heroProof}><span><Check /> No code required</span><span><Check /> Built for Bangladesh</span><span><Check /> AI ready</span></div>
        </div>

        <ParallaxStage className={styles.previewStage} id="preview">
          <div className={styles.stageLight} />
          <DashboardPreview />
          <div className={`${styles.floatingMetric} ${styles.floatingMetricLeft}`}><span>Gross revenue</span><b>৳67,743</b><small><TrendingArrow /> 18.4%</small></div>
          <div className={`${styles.floatingMetric} ${styles.floatingMetricRight}`}><span>Conversion</span><b>4.8%</b><small>Best this month</small></div>
          <div className={styles.aiFloat}>
            <div><span><Bot /></span><p>StoreOS AI</p><small>Online</small></div>
            <p>Revenue is up 18% this week. Your top product is nearly out of stock.</p>
          </div>
        </ParallaxStage>
        <div className={styles.scrollCue}><span>Scroll to explore</span><i /></div>
      </section>

      <section className={styles.storyBridge} id="story">
        <div className={styles.storyStatement}>
          <span>Before Dash</span>
          <h2>Your business is growing.<br />Your tools are holding it back.</h2>
          <p>Orders in messages. Stock in spreadsheets. Payments in screenshots. Delivery in another app. The work multiplies, but clarity disappears.</p>
        </div>
        <div className={styles.painRail}>
          <PainCard icon={Clock3} title="Inbox orders" text="Every sale starts another manual chase." />
          <PainCard icon={Store} title="Borrowed presence" text="A social page is not a commerce brand." />
          <PainCard icon={Truck} title="Disconnected delivery" text="Payments and courier live worlds apart." />
          <PainCard icon={BarChart3} title="Invisible performance" text="No single view tells you what is working." />
        </div>
        <div className={styles.storyTurn}>
          <span>One storefront. One command center. One intelligence layer.</span>
          <h2>Dash turns the moving parts into momentum.</h2>
          <p>Your entire commerce operation, designed as one continuous system.</p>
          <ArrowRight />
        </div>
      </section>

      <section className={styles.journeySection} id="journey">
        <aside className={styles.journeyIntro}>
          <span>From idea to operation</span>
          <h2>One journey.<br />Every commerce moment.</h2>
          <p>Follow the path from launching a store to understanding the business behind it.</p>
          <div className={styles.journeyProgress}><i /><span>01</span><span>05</span></div>
        </aside>
        <div className={styles.journeyChapters}>
          <JourneyChapter number="01" eyebrow="Store creation" title="Go from idea to storefront while the coffee is still warm." text="Choose your identity, set the essentials, and launch a premium storefront without code or configuration anxiety.">
            <StoreBuilderVisual />
          </JourneyChapter>
          <JourneyChapter number="02" eyebrow="Command center" title="See the whole business without hunting for the truth." text="Revenue, orders, customers, inventory, and next actions arrive in one composed view.">
            <OperationsVisual />
          </JourneyChapter>
          <JourneyChapter number="03" eyebrow="Order flow" title="Every order knows exactly where it needs to go." text="Move from pending to completed with customer context, payment state, fulfillment detail, and a clear timeline.">
            <OrdersVisual />
          </JourneyChapter>
          <JourneyChapter number="04" eyebrow="Payments" title="Built for how your customers actually pay." text="COD, bKash, Nagad, and Rocket live inside one trustworthy checkout and order record.">
            <PaymentsVisual />
          </JourneyChapter>
          <JourneyChapter number="05" eyebrow="Courier" title="Delivery stops being a daily coordination problem." text="Set Bangladesh-first zones and rates now, with courier automation ready for the next stage.">
            <CourierVisual />
          </JourneyChapter>
        </div>
      </section>

      <section className={styles.featuresSection} id="features">
        <SectionIntro eyebrow="The system beneath the story" title="Every capability, composed into one operating layer." text="The depth is there when you need it. The interface stays calm when you do not." centered />
        <div className={styles.bentoGrid}>{features.map((feature, index) => <FeatureCard {...feature} featured={index === 0 || index === 8} key={feature.title} />)}</div>
      </section>

      <section className={styles.aiSection} id="ai">
        <div className={styles.aiAtmosphere} />
        <div className={styles.aiCopy}>
          <div className={styles.eyebrow}><Bot /> StoreOS intelligence</div>
          <h2>Your store can finally answer back.</h2>
          <p>Ask in the language you naturally use. StoreOS AI turns live commerce data into focused answers, useful context, and a clearer next step.</p>
          <ul><li><Check /> Understand sales without building reports</li><li><Check /> Surface low stock before it costs a sale</li><li><Check /> Keep every answer scoped to your store</li></ul>
        </div>
        <div className={styles.aiStage}>
          <div className={styles.aiMetricTop}><span>Live context</span><b>384 signals</b></div>
          <div className={styles.chatWindow}>
            <header><span><Bot /></span><div><b>StoreOS AI Assistant</b><small>Connected to Dash</small></div><i /></header>
            <div className={styles.chatBody}>
              <p className={styles.userBubble}>আজ কত অর্ডার এসেছে?</p>
              <div className={styles.aiBubble}><span><Sparkles /></span><p><TypingText text="আজ ১৮টি অর্ডার এসেছে, মোট বিক্রি ৳২২,৫০০।" /></p></div>
              <div className={styles.insightCard}><span>Today at a glance</span><div><b>18</b><small>Orders</small></div><div><b>৳22.5K</b><small>Revenue</small></div><div><b>৳1,250</b><small>Average</small></div></div>
            </div>
            <footer><span>Ask anything about your store...</span><button aria-label="Send AI message"><ArrowRight /></button></footer>
          </div>
          <div className={styles.aiMetricBottom}><span>Low stock detected</span><b>3 products</b></div>
        </div>
      </section>

      <section className={styles.pricingSection} id="pricing">
        <SectionIntro eyebrow="Simple pricing" title="Choose the operating power you need." text="Clear plans for stores at every stage. Start lean, then expand as your volume grows." centered />
        <div className={styles.pricingGrid}>
          {pricingPlans.map((plan) => (
            <PricingCard
              featured={plan.featured}
              features={plan.features}
              key={plan.name}
              name={plan.name}
              price={plan.price}
              text={plan.text}
            />
          ))}
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.finalGlow} />
        <div className={styles.eyebrow}><ShieldCheck /> Built for serious sellers</div>
        <h2>Your business deserves an operating system.</h2>
        <p>Turn today’s hustle into tomorrow’s durable commerce brand.</p>
        <Link className={styles.primaryButtonLarge} href="/register">Start Building Your Store <ArrowRight /></Link>
      </section>

      <footer className={styles.footer}>
        <div className={styles.brand}><span className={styles.brandMark}>D</span><span>Dash Commerce <b>OS</b></span></div>
        <p>Commerce infrastructure for the next generation of sellers.</p>
        <span>© 2026 Dash Commerce OS</span>
      </footer>
    </main>
  );
}

function DashboardPreview() {
  return <div className={styles.dashboardMockup}>
    <aside><div className={styles.mockLogo}>D</div>{[BarChart3, Box, ReceiptText, Users, Percent, Settings].map((Icon, index) => <span className={index === 0 ? styles.mockActive : ""} key={index}><Icon /></span>)}</aside>
    <div className={styles.mockContent}>
      <header><div><small>Overview</small><b>Good morning, Arafat</b></div><span><Sparkles /> Ask AI</span></header>
      <div className={styles.mockStats}><MockStat label="Revenue" value="৳67,743" accent="violet" /><MockStat label="Orders" value="774" accent="blue" /><MockStat label="Customers" value="1,248" accent="green" /><MockStat label="Conversion" value="4.8%" accent="orange" /></div>
      <div className={styles.mockMain}>
        <div className={styles.mockChart}><div><b>Recent sales</b><small>Last 7 days</small></div><div className={styles.bars}>{[38, 57, 45, 76, 53, 88, 68, 92, 61, 78, 48, 70].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></div>
        <div className={styles.mockOrders}><div><b>Latest orders</b><small>View all</small></div>{["#DASH-1048", "#DASH-1047", "#DASH-1046", "#DASH-1045"].map((order, index) => <p key={order}><span>{order}<small>{["Nusrat Jahan", "Rafi Ahmed", "Sadia Khan", "Imran Ali"][index]}</small></span><b>{["৳1,850", "৳3,200", "৳980", "৳2,450"][index]}</b><i>Paid</i></p>)}</div>
      </div>
    </div>
  </div>;
}

function JourneyChapter({ children, eyebrow, number, text, title }: { children: ReactNode; eyebrow: string; number: string; text: string; title: string }) {
  return <article className={styles.journeyChapter}>
    <div className={styles.chapterCopy}><span>{number} / {eyebrow}</span><h3>{title}</h3><p>{text}</p></div>
    <div className={styles.chapterVisual}>{children}</div>
  </article>;
}

function StoreBuilderVisual() {
  return <div className={styles.builderVisual}>
    <div className={styles.builderControls}><span>Brand your store</span><label>Store name<b>Akash Atelier</b></label><label>Primary color<i className={styles.colorSwatch} /></label><label>Hero message<b>Made for your everyday</b></label><button>Publish store <ArrowRight /></button></div>
    <div className={styles.storePreview}><header><b>AKASH</b><span>Shop &nbsp; Journal &nbsp; About</span></header><div><small>NEW COLLECTION</small><strong>Objects for a quieter life.</strong><button>Explore now</button></div></div>
    <span className={styles.liveBadge}><i /> Live preview</span>
  </div>;
}

function OperationsVisual() {
  return <div className={styles.operationPanel}>
    <div className={styles.operationHeader}><span>Live operations</span><small><i /> All systems healthy</small></div>
    <div className={styles.operationGrid}>
      <OperationTile icon={ReceiptText} label="Orders today" value="18" note="5 awaiting action" />
      <OperationTile icon={CircleDollarSign} label="Revenue" value="৳22,500" note="+18% this week" />
      <OperationTile icon={PackageCheck} label="Inventory" value="146" note="3 low stock" />
      <OperationTile icon={Users} label="Customers" value="384" note="12 returning" />
    </div>
    <div className={styles.activityLine}><span>11:42</span><b>Order #DASH-1048 confirmed</b><small>৳1,850</small></div>
    <div className={styles.activityLine}><span>11:36</span><b>Payment received via bKash</b><small>৳3,200</small></div>
    <div className={styles.activityLine}><span>11:21</span><b>New customer registered</b><small>Dhaka</small></div>
  </div>;
}

function OrdersVisual() {
  return <div className={styles.ordersVisual}>
    <header><div><span>Orders</span><b>28 open</b></div><button>+ New order</button></header>
    {[{ id: "#DASH-1048", customer: "Nusrat Jahan", value: "৳1,850", status: "Processing" }, { id: "#DASH-1047", customer: "Rafi Ahmed", value: "৳3,200", status: "Paid" }, { id: "#DASH-1046", customer: "Sadia Khan", value: "৳980", status: "Pending" }].map((order) => <div className={styles.orderRow} key={order.id}><i>{order.customer.charAt(0)}</i><span><b>{order.id}</b><small>{order.customer}</small></span><strong>{order.value}</strong><em data-status={order.status}>{order.status}</em><ChevronRight /></div>)}
    <footer><span>Created</span><i /><span>Payment</span><i /><span>Processing</span><i /><span>Delivered</span></footer>
  </div>;
}

function PaymentsVisual() {
  return <div className={styles.paymentsVisual}>
    <div className={styles.paymentPhone}><header><ShieldCheck /><span>Secure checkout</span></header><p>Choose payment method</p>{["Cash on Delivery", "bKash", "Nagad"].map((method, index) => <label key={method}><i className={index === 1 ? styles.radioActive : ""} /><span>{method}<small>{index === 0 ? "Pay when your order arrives" : "Manual mobile payment"}</small></span></label>)}<button>Place order · ৳2,450</button></div>
    <div className={styles.settlementCard}><span>Today’s payments</span><b>৳42,850</b><small>12 successful transactions</small><div><i /><span>Verified and store-scoped</span></div></div>
  </div>;
}

function CourierVisual() {
  return <div className={styles.courierVisual}>
    <div className={styles.routeMap}><span className={styles.routeDhaka}>Dhaka<small>৳70</small></span><i /><span className={styles.routeOutside}>Outside Dhaka<small>৳130</small></span><div className={styles.routePulse}><Truck /></div></div>
    <div className={styles.deliveryPanel}><header><span>Delivery #DASH-1048</span><b>In transit</b></header>{["Order confirmed", "Courier assigned", "Out for delivery"].map((step, index) => <p key={step}><i data-complete={index < 2} /><span>{step}<small>{["11:42 AM", "1:18 PM", "Expected tomorrow"][index]}</small></span></p>)}</div>
  </div>;
}

function TrendingArrow() { return <svg aria-hidden="true" fill="none" viewBox="0 0 16 16"><path d="M3 11 7 7l2.5 2.5L14 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" /><path d="M10 5h4v4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" /></svg>; }

function SectionIntro({ centered, eyebrow, text, title }: { centered?: boolean; eyebrow: string; text: string; title: string }) { return <div className={`${styles.sectionIntro} ${centered ? styles.centered : ""}`}><span>{eyebrow}</span><h2>{title}</h2><p>{text}</p></div>; }
function PainCard({ icon: Icon, text, title }: CardProps) { return <article className={styles.painCard}><span><Icon /></span><h3>{title}</h3><p>{text}</p></article>; }
function FeatureCard({ featured, icon: Icon, text, title }: CardProps & { featured: boolean }) { return <article className={`${styles.featureCard} ${featured ? styles.featuredCard : ""}`}><span><Icon /></span><small>Dash module</small><h3>{title}</h3><p>{text}</p><i><ArrowRight /></i></article>; }
function OperationTile({ icon: Icon, label, note, value }: { icon: CardProps["icon"]; label: string; note: string; value: string }) { return <div className={styles.operationTile}><span><Icon /></span><small>{label}</small><b>{value}</b><p>{note}</p></div>; }
function MockStat({ accent, label, value }: { accent: string; label: string; value: string }) { return <div data-accent={accent}><span>{label}</span><b>{value}</b></div>; }
function PricingCard({ featured, features, name, price, text }: { featured?: boolean; features: string[]; name: string; price: string; text: string }) { return <article className={`${styles.pricingCard} ${featured ? styles.featuredPricing : ""}`}>{featured ? <span className={styles.popular}>Most popular</span> : null}<h3>{name}</h3><p>{text}</p><div><b>{price}</b><span>/ month</span></div><ul>{features.map((item) => <li key={item}><Check /> {item}</li>)}</ul><Link href="/register">Start Free <ArrowRight /></Link></article>; }

/**
 * Capability copy per tier. Prices and limits are NOT written here — they are
 * derived from `PLAN_CATALOG` below, so the marketing page cannot drift from the
 * plans the product actually sells. Only bullets for capabilities that already
 * ship are stated plainly; anything still on the roadmap is labelled.
 */
const pricingHighlights: Record<string, string[]> = {
  free: ["Storefront, products and orders", "COD and manual payments"],
  growth: ["StoreOS AI assistant and POS", "Advanced analytics and reports", "Google Ads and TikTok tracking", "API access"],
  pro: ["Marketing, WhatsApp, email and SMS automation (coming soon)", "Affiliate tracking and advanced attribution (coming soon)"],
  starter: ["Custom domain", "Courier API and fraud check", "Abandoned cart recovery", "Marketing analytics and pixel tracking"]
};

const pricingPlans = [...PLAN_CATALOG]
  .sort((a, b) => a.sortOrder - b.sortOrder)
  .map((plan, index, ordered) => {
    const previous = ordered[index - 1];

    return {
      featured: plan.isFeatured,
      features: [
        ...(previous ? [`Everything in ${previous.name}`] : []),
        `${planLimit(plan.productLimit)} products · ${planLimit(plan.orderLimit)} orders / month`,
        `${planLimit(plan.customerLimit)} customers · ${plan.staffLimit} staff`,
        ...(pricingHighlights[plan.slug] ?? [])
      ],
      name: plan.name,
      price: `৳${Number(plan.priceMonthly).toLocaleString("en")}`,
      text: plan.description
    };
  });

function planLimit(value: number) {
  return value === 0 ? "Unlimited" : value.toLocaleString("en");
}
type CardProps = { icon: ComponentType<{ className?: string }>; text: string; title: string };
