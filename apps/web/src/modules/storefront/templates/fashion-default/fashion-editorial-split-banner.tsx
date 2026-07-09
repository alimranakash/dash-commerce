import Link from "next/link";
import type { CSSProperties } from "react";
import styles from "./fashion-editorial-split-banner.module.css";

type FashionEditorialSplitBannerProps = {
  ctaLink?: string | null | undefined;
  ctaText?: string | null | undefined;
  heading?: string | null | undefined;
  height?: number | null | undefined;
  leftImageUrl?: string | null | undefined;
  overlayOpacity?: number | null | undefined;
  rightImageUrl?: string | null | undefined;
  textPosition?: "left" | "center" | "right" | undefined;
};

export function FashionEditorialSplitBanner({
  ctaLink,
  ctaText,
  heading,
  height,
  leftImageUrl,
  overlayOpacity,
  rightImageUrl,
  textPosition = "center"
}: FashionEditorialSplitBannerProps) {
  const resolvedHeading = heading?.trim() || "Timeless classics";
  const headingParts = splitHeading(resolvedHeading);
  const sectionStyle = {
    "--fashion-editorial-height": `${height ?? 720}px`,
    "--fashion-editorial-overlay": String(Math.min(0.85, Math.max(0, (overlayOpacity ?? 26) / 100)))
  } as CSSProperties;

  return (
    <section
      aria-labelledby="fashion-editorial-split-title"
      className={styles.section}
      style={sectionStyle}
    >
      <div className={`${styles.panel} ${styles.darkPanel}`}>
        {leftImageUrl ? (
          <img alt="" decoding="async" loading="lazy" src={leftImageUrl} />
        ) : (
          <div className={styles.darkFallback} aria-hidden="true" />
        )}
      </div>
      <div className={`${styles.panel} ${styles.lightPanel}`}>
        {rightImageUrl ? (
          <img alt="" decoding="async" loading="lazy" src={rightImageUrl} />
        ) : (
          <div className={styles.lightFallback} aria-hidden="true" />
        )}
      </div>
      <div className={styles.overlay} aria-hidden="true" />
      <div className={`${styles.content} ${styles[textPosition]}`}>
        <h2 id="fashion-editorial-split-title">
          {headingParts.leading}
          {headingParts.emphasis ? <em>{headingParts.emphasis}</em> : null}
        </h2>
        <Link href={ctaLink?.trim() || "/products"}>
          {ctaText?.trim() || "Explore"}
        </Link>
      </div>
    </section>
  );
}

function splitHeading(value: string) {
  const words = value.split(/\s+/);

  if (words.length < 2) {
    return { emphasis: "", leading: value };
  }

  return {
    emphasis: words.at(-1) ?? "",
    leading: `${words.slice(0, -1).join(" ")} `
  };
}
