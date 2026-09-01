import { ArrowUpRight, BarChart3, Bot, Box, Check, CircleDollarSign, ReceiptText, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./auth-experience.module.css";

export function AuthExperience({ children, description, eyebrow, title }: { children: ReactNode; description: string; eyebrow: string; title: string }) {
  return (
    <main className={styles.authPage}>
      <section className={styles.formSide}>
        <Link className={styles.brand} href="/"><span>S</span><b>Store<i>IM</i></b></Link>
        <div className={styles.formFrame}>
          <div className={styles.intro}><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
          {children}
        </div>
        <footer><span>© 2026 StoreIM</span><Link href="/">Back to homepage <ArrowUpRight /></Link></footer>
      </section>

      <aside className={styles.showcase} aria-label="StoreIM product preview">
        <div className={styles.showcaseGlow} /><div className={styles.showcaseGrid} />
        <div className={styles.showcaseCopy}><span><Sparkles /> Built for modern sellers</span><h2>Everything your store needs. One beautifully connected system.</h2><p>Move from first sale to clear, confident growth without stitching together a dozen tools.</p></div>
        <div className={styles.previewStage}>
          <div className={styles.dashboardPreview}>
            <aside><b>S</b>{[BarChart3, Box, ReceiptText].map((Icon, index) => <span data-active={index === 0} key={index}><Icon /></span>)}</aside>
            <div className={styles.previewContent}>
              <header><div><small>Overview</small><b>Good evening, Arafat</b></div><span><Sparkles /> Ask AI</span></header>
              <div className={styles.metrics}><PreviewMetric label="Revenue" value="৳67,743" /><PreviewMetric label="Orders" value="774" /><PreviewMetric label="Customers" value="1,248" /></div>
              <div className={styles.chart}><header><b>Revenue pulse</b><small>Last 7 days</small></header><div>{[42, 58, 48, 76, 62, 88, 72, 94, 68, 83].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></div>
            </div>
          </div>
          <div className={styles.aiCard}><header><span><Bot /></span><div><b>StoreIM AI</b><small>Live store context</small></div><i /></header><p>Revenue is up 18% this week. Three products need your attention.</p><footer><Check /> Insight ready</footer></div>
          <div className={styles.revenueFloat}><span><CircleDollarSign /></span><div><small>Today’s revenue</small><b>৳22,500</b></div><em>+18.4%</em></div>
        </div>
        <div className={styles.trustLine}><span><Check /> Store-scoped data</span><span><Check /> Secure credentials</span><span><Check /> Built for Bangladesh</span></div>
      </aside>
    </main>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><b>{value}</b></div>; }
