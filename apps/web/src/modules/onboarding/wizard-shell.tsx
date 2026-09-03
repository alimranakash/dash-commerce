"use client";

import type { LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { formatStorefrontMoney } from "../storefront/format";
import type { StorefrontTemplateId } from "../storefront/templates/template-mapping";
import styles from "./onboarding-experience.module.css";
import type { StorePreviewDesign } from "./store-preview";

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

/**
 * Each template's shape, borrowed for the mock.
 *
 * Only what a seller can see at this size — how tall the hero stands, how the
 * cards are cropped, how round the corners are — so the panel reads as four
 * different storefronts rather than four colour swaps. The real difference is
 * the pack's own photography and copy, which arrives as data.
 */
const mockLayouts = {
  "beauty-default": styles.mockBeauty,
  "electronics-default": styles.mockElectronics,
  "fashion-default": styles.mockFashion,
  "general-default": styles.mockGeneral
} satisfies Record<StorefrontTemplateId, string | undefined>;

/**
 * The storefront the seller is about to be handed, drawn from the demo pack that
 * their Business Type answer seeds — hero photograph, hero copy, colours,
 * navigation and the first product of each category. Answering that step
 * therefore changes the picture, which is the only way the question can be
 * answered well.
 */
export function StorePreview({
  country,
  currency,
  design,
  domain,
  name
}: {
  country: string;
  currency: string;
  design: StorePreviewDesign;
  domain: string;
  name: string;
}) {
  const palette = {
    "--pv-primary": design.primaryColor,
    "--pv-secondary": design.secondaryColor ?? design.primaryColor
  } as CSSProperties;

  return (
    <aside className={styles.previewCard}>
      <header><span>Live store preview</span><i><b /> Ready</i></header>
      <div className={`${styles.storefrontMock} ${mockLayouts[design.templateId] ?? ""}`} style={palette}>
        <nav><strong>{name || "YOUR STORE"}</strong><span>{design.navLabels.map((label) => <b key={label}>{label}</b>)}</span></nav>
        <section className={styles.mockHero}>
          {design.heroImageUrl ? <img alt="" src={design.heroImageUrl} /> : null}
          <div>
            {design.heroSubtitle ? <small>{design.heroSubtitle}</small> : null}
            <h2>{design.heroTitle}</h2>
            {design.tagline ? <p>{design.tagline}</p> : null}
            <button type="button">{design.ctaText}</button>
          </div>
        </section>
        <div className={styles.mockProducts}>
          <header><b>{design.featuredTitle}</b><span>View all</span></header>
          <ul>
            {design.products.map((product) => (
              <li key={product.title}>
                <figure><img alt={product.imageAlt} src={product.imageUrl} /></figure>
                <b>{product.title}</b>
                <span>{formatStorefrontMoney(product.price, currency)}{product.compareAtPrice ? <s>{formatStorefrontMoney(product.compareAtPrice, currency)}</s> : null}</span>
              </li>
            ))}
          </ul>
        </div>
        <footer><span>{domain}</span><b>{country} · {currency}</b></footer>
      </div>
      <p className={styles.previewNote}><b>{design.templateName}</b> template · {design.productCount} starter products across {design.categoryCount} categories, added for you.</p>
      <div className={styles.previewFacts}>
        <div><span>Store Name</span><b>{name || "Not set yet"}</b></div>
        <div><span>Store URL</span><b>{domain}</b></div>
        <div><span>Country</span><b>{country}</b></div>
        <div><span>Currency</span><b>{currency}</b></div>
      </div>
    </aside>
  );
}
