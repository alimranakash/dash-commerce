"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./onboarding-experience.module.css";

/**
 * The two pieces of the setup wizard's look that both surfaces need.
 *
 * Registration walks a seller through these same questions now, and the
 * dashboard keeps the wizard for accounts that arrive without a store. Sharing
 * the markup is what stops the two from drifting into looking like different
 * products halfway through the same task.
 */

export function StepIntro({
  children,
  eyebrow,
  icon: Icon,
  text,
  title
}: {
  children: ReactNode;
  eyebrow: string;
  icon: LucideIcon;
  text: string;
  title: string;
}) {
  return (
    <div className={styles.stepContent}>
      <span className={styles.stepIcon}><Icon /></span>
      <div className={styles.stepCopy}><small>{eyebrow}</small><h2>{title}</h2><p>{text}</p></div>
      {children}
    </div>
  );
}

export function StorePreview({ country, currency, domain, name }: { country: string; currency: string; domain: string; name: string }) {
  return (
    <aside className={styles.previewCard}>
      <header><span>Live store preview</span><i><b /> Ready</i></header>
      <div className={styles.storefrontMock}>
        <nav><strong>{name || "YOUR STORE"}</strong><span>Shop&nbsp;&nbsp; About&nbsp;&nbsp; Contact</span></nav>
        <section><small>WELCOME TO</small><h2>{name || "Your next great store"}</h2><p>Thoughtfully selected products, ready for your customers.</p><button type="button">Explore collection</button></section>
        <footer><span>{domain}</span><b>{country} · {currency}</b></footer>
      </div>
      <div className={styles.previewFacts}>
        <div><span>Store Name</span><b>{name || "Not set yet"}</b></div>
        <div><span>Store URL</span><b>{domain}</b></div>
        <div><span>Country</span><b>{country}</b></div>
        <div><span>Currency</span><b>{currency}</b></div>
      </div>
    </aside>
  );
}
