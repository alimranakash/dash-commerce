"use client";

import { useStorefrontBasePath } from "../../base-path-provider";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  normalizeAdvancedSettings,
  type StorefrontAdvancedSettings,
  type StorefrontHeroSlide
} from "../../customization";

type FashionHeroSliderProps = {
  fallbackImageUrl?: string | null | undefined;
  settings?: StorefrontAdvancedSettings | null | undefined;
  storeSlug: string;
  subtitle?: string | null;
  title?: string | null;
};

export function FashionHeroSlider({
  fallbackImageUrl,
  settings,
  subtitle,
  title
}: FashionHeroSliderProps) {
  const basePath = useStorefrontBasePath();
  const advanced = normalizeAdvancedSettings(settings);
  const hero = advanced.hero;
  const [activeIndex, setActiveIndex] = useState(0);
  const slides = useMemo(
    () => resolveSlides(hero, fallbackImageUrl, title, subtitle),
    [fallbackImageUrl, hero, subtitle, title]
  );
  const isSlider = slides.length > 1 && hero.contentType.includes("slider");
  const currentSlide = slides[activeIndex] ?? slides[0];
  const heroStyle = {
    "--fashion-hero-custom-height": `${hero.customHeight ?? 720}px`,
    "--fashion-hero-custom-width": `${hero.customWidth ?? 1440}px`,
    "--fashion-hero-overlay": hexToRgb(hero.overlayColor || "#000000"),
    "--fashion-hero-overlay-opacity": String((hero.overlayOpacity || 28) / 100),
    "--fashion-hero-text": hero.textColor || "#ffffff"
  } as CSSProperties;
  const primaryButtonText = hero.button1Text || "Shop Now";

  useEffect(() => {
    if (!isSlider || !hero.autoplay) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % slides.length);
    }, hero.sliderSpeed);

    return () => window.clearInterval(timer);
  }, [hero.autoplay, hero.sliderSpeed, isSlider, slides.length]);

  if (!hero.enabled || !currentSlide) {
    return null;
  }

  return (
    <section
      className={`fashion-hero fashion-hero-h-${hero.height} fashion-hero-w-${hero.layoutWidth} fashion-hero-align-${hero.align}`}
      style={heroStyle}
      aria-labelledby="fashion-hero-title"
    >
      <FashionHeroMedia slide={currentSlide} />
      <div className="fashion-hero-overlay" />
      <div className="fashion-hero-copy">
        <p>{currentSlide.subtitle || "THAT FEEL GOOD FIT"}</p>
        <h1 id="fashion-hero-title">{currentSlide.title || "Iconic style,\nmaximum heat."}</h1>
        <div className={`fashion-hero-actions fashion-hero-actions-${hero.buttonStyle}`}>
          <Link href={resolveHeroHref(basePath, hero.button1Link)}>{primaryButtonText}</Link>
          {hero.button2Text ? (
            <Link href={resolveHeroHref(basePath, hero.button2Link)}>{hero.button2Text}</Link>
          ) : null}
        </div>
      </div>
      {slides.length > 1 && hero.showArrows ? (
        <div className="fashion-hero-arrows">
          <button
            aria-label="Previous hero slide"
            onClick={() => setActiveIndex((index) => (index - 1 + slides.length) % slides.length)}
            type="button"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            aria-label="Next hero slide"
            onClick={() => setActiveIndex((index) => (index + 1) % slides.length)}
            type="button"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      ) : null}
      {hero.showDots && slides.length > 1 ? (
        <div className="fashion-hero-dots" aria-label="Hero slide navigation">
          {slides.map((slide, index) => (
            <button
              aria-label={`Go to slide ${index + 1}`}
              aria-pressed={activeIndex === index}
              key={`${slide.url}-${index}`}
              onClick={() => setActiveIndex(index)}
              type="button"
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function FashionHeroMedia({ slide }: { slide: StorefrontHeroSlide }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [slide.url]);

  if (!slide.url || failed) {
    return <div className="fashion-hero-media fashion-hero-fallback" aria-hidden="true" />;
  }

  if (slide.mediaType === "youtube") {
    const embedUrl = youtubeEmbedUrl(slide.url);

    return embedUrl ? (
      <iframe
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="fashion-hero-media"
        loading="lazy"
        onError={() => setFailed(true)}
        src={embedUrl}
        title={slide.title || "Fashion hero video"}
      />
    ) : <div className="fashion-hero-media fashion-hero-fallback" aria-hidden="true" />;
  }

  if (slide.mediaType === "video") {
    return (
      <video
        autoPlay
        className="fashion-hero-media"
        loop
        muted
        onError={() => setFailed(true)}
        playsInline
        src={slide.url}
      />
    );
  }

  const mobileUrl = mobileHeroVariant(slide.url);

  return (
    <picture>
      {mobileUrl ? <source media="(max-width: 820px)" srcSet={mobileUrl} /> : null}
      <img
        alt={slide.title || "Fashion collection"}
        className="fashion-hero-media"
        decoding="async"
        loading="eager"
        onError={() => setFailed(true)}
        src={slide.url}
      />
    </picture>
  );
}

// The hero art is a wide editorial crop that loses almost everything when a
// phone squeezes it into a portrait frame, so every demo pack ships a portrait
// `hero-mobile.webp` beside its wide slides. A `<source>` that 404s has no
// fallback, so the pattern stays pinned to that convention - any other image
// keeps the desktop art at all widths.
const heroPacksWithMobileArt = /^\/demo-assets\/[a-z-]+\/hero\/hero-0\d\.webp$/;

function mobileHeroVariant(src: string) {
  if (!heroPacksWithMobileArt.test(src)) {
    return undefined;
  }

  return src.replace(/hero-0\d\.webp$/, "hero-mobile.webp");
}

function resolveSlides(
  hero: StorefrontAdvancedSettings["hero"],
  fallbackImageUrl: string | null | undefined,
  title: string | null | undefined,
  subtitle: string | null | undefined
): StorefrontHeroSlide[] {
  const fallbackTitle = title || hero.title || "Iconic style,\nmaximum heat.";
  const fallbackSubtitle = subtitle || hero.subtitle || "THAT FEEL GOOD FIT";
  const configuredImageUrl = hero.imageUrl && !hero.imageUrl.includes("/demo-assets/general/hero/")
    ? hero.imageUrl
    : undefined;

  if (hero.contentType === "youtube" && hero.youtubeUrl) {
    return [{ mediaType: "youtube", subtitle: fallbackSubtitle, title: fallbackTitle, url: hero.youtubeUrl }];
  }

  if (hero.contentType === "single-video" && hero.videoUrl) {
    return [{ mediaType: "video", subtitle: fallbackSubtitle, title: fallbackTitle, url: hero.videoUrl }];
  }

  if (hero.contentType.includes("slider")) {
    return hero.slides.length > 0
      ? hero.slides.map((slide) => ({
        ...slide,
        subtitle: slide.subtitle || fallbackSubtitle,
        title: slide.title || fallbackTitle,
        url: slide.url.includes("/demo-assets/general/hero/")
          ? configuredImageUrl || fallbackImageUrl || ""
          : slide.url
      }))
      : [{
        mediaType: "image",
        subtitle: fallbackSubtitle,
        title: fallbackTitle,
        url: configuredImageUrl || fallbackImageUrl || ""
      }];
  }

  return [{
    mediaType: "image",
    subtitle: fallbackSubtitle,
    title: fallbackTitle,
    url: configuredImageUrl || fallbackImageUrl || ""
  }];
}

function resolveHeroHref(basePath: string, path: string) {
  if (path.startsWith("http")) {
    return path;
  }

  if (path === "/") {
    // An empty basePath would otherwise make this an empty href.
    return basePath || "/";
  }

  return `${basePath}${path.startsWith("/") ? path : `/${path}`}`;
}

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `${red} ${green} ${blue}`;
}

function youtubeEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    const id = parsed.hostname.includes("youtu.be")
      ? parsed.pathname.replace("/", "")
      : parsed.searchParams.get("v");

    return id ? `https://www.youtube.com/embed/${id}` : "";
  } catch {
    return "";
  }
}
