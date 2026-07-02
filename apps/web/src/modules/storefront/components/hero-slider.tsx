"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  DEFAULT_STOREFRONT_ADVANCED_SETTINGS,
  normalizeAdvancedSettings,
  type StorefrontAdvancedSettings,
  type StorefrontHeroSlide
} from "../customization";

type HeroSliderProps = {
  fallbackImageUrl?: string | null | undefined;
  settings?: StorefrontAdvancedSettings | null | undefined;
  storeSlug: string;
  subtitle?: string | null;
  title?: string | null;
};

export function HeroSlider({
  fallbackImageUrl,
  settings,
  storeSlug,
  subtitle,
  title
}: HeroSliderProps) {
  const advanced = normalizeAdvancedSettings(settings);
  const hero = advanced.hero;
  const [activeIndex, setActiveIndex] = useState(0);
  const fallbackSlide: StorefrontHeroSlide = {
    mediaType: "image",
    subtitle: hero.subtitle,
    title: hero.title,
    url: hero.imageUrl || fallbackImageUrl || "/demo-assets/general/hero/hero-01.webp"
  };
  const slides = useMemo(
    () => resolveSlides(hero, fallbackImageUrl, title, subtitle),
    [fallbackImageUrl, hero, subtitle, title]
  );
  const currentSlide = slides[activeIndex] ?? slides[0] ?? fallbackSlide;
  const isSlider = slides.length > 1 && hero.contentType.includes("slider");
  const heroStyle = {
    "--sf-hero-custom-height": `${hero.customHeight ?? 720}px`,
    "--sf-hero-custom-width": `${hero.customWidth ?? 1440}px`,
    "--sf-hero-overlay": hexToRgb(hero.overlayColor),
    "--sf-hero-overlay-opacity": String(hero.overlayOpacity / 100),
    "--sf-hero-text": hero.textColor
  } as CSSProperties;

  useEffect(() => {
    if (!isSlider || !hero.autoplay) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % slides.length);
    }, hero.sliderSpeed);

    return () => window.clearInterval(timer);
  }, [hero.autoplay, hero.sliderSpeed, isSlider, slides.length]);

  if (!hero.enabled) {
    return null;
  }

  return (
    <section
      className={`general-hero general-hero-${hero.height} general-hero-${hero.layoutWidth} general-hero-align-${hero.align}`}
      style={heroStyle}
      aria-labelledby="general-hero-title"
    >
      <MediaRenderer slide={currentSlide} />
      <div className="general-hero-overlay" />
      <div className="general-hero-copy">
        <h1 id="general-hero-title">{currentSlide.title || hero.title}</h1>
        <span>{currentSlide.subtitle || hero.subtitle}</span>
        <div className={`general-hero-actions general-hero-actions-${hero.buttonStyle}`}>
          <Link href={resolveHeroHref(storeSlug, hero.button1Link)}>{hero.button1Text}</Link>
          <Link href={resolveHeroHref(storeSlug, hero.button2Link)}>{hero.button2Text}</Link>
        </div>
      </div>
      {isSlider && hero.showArrows ? (
        <div className="general-hero-arrows">
          <button aria-label="Previous hero slide" onClick={() => setActiveIndex((index) => (index - 1 + slides.length) % slides.length)} type="button">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button aria-label="Next hero slide" onClick={() => setActiveIndex((index) => (index + 1) % slides.length)} type="button">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      ) : null}
      {isSlider && hero.showDots ? (
        <div className="general-hero-dots" aria-label="Hero slide navigation">
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

export function MediaRenderer({ slide }: { slide: StorefrontHeroSlide }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [slide.url]);

  if (!slide.url || failed) {
    return (
      <div className="general-hero-media general-hero-fallback" aria-hidden="true">
        <span />
      </div>
    );
  }

  if (slide.mediaType === "youtube") {
    const embedUrl = youtubeEmbedUrl(slide.url);

    return embedUrl ? (
      <iframe
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="general-hero-media"
        loading="lazy"
        onError={() => setFailed(true)}
        src={embedUrl}
        title={slide.title || "Storefront hero video"}
      />
    ) : null;
  }

  if (slide.mediaType === "video") {
    return (
      <video
        autoPlay
        className="general-hero-media"
        loop
        muted
        onError={() => setFailed(true)}
        playsInline
        src={slide.url}
      />
    );
  }

  return <img alt={slide.title || "Storefront hero"} className="general-hero-media" loading="eager" onError={() => setFailed(true)} src={slide.url} />;
}

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `${red} ${green} ${blue}`;
}

function resolveHeroHref(storeSlug: string, path: string) {
  if (path.startsWith("http")) {
    return path;
  }

  return `/s/${storeSlug}${path === "/" ? "" : path.startsWith("/") ? path : `/${path}`}`;
}

function resolveSlides(
  hero: StorefrontAdvancedSettings["hero"],
  fallbackImageUrl: string | null | undefined,
  title: string | null | undefined,
  subtitle: string | null | undefined
): StorefrontHeroSlide[] {
  if (hero.contentType === "youtube" && hero.youtubeUrl) {
    return [{
      mediaType: "youtube" as const,
      subtitle: subtitle || hero.subtitle,
      title: title || hero.title,
      url: hero.youtubeUrl
    }];
  }

  if (hero.contentType === "single-video" && hero.videoUrl) {
    return [{
      mediaType: "video" as const,
      subtitle: subtitle || hero.subtitle,
      title: title || hero.title,
      url: hero.videoUrl
    }];
  }

  if (hero.contentType.includes("slider")) {
    return hero.slides.length > 0 ? hero.slides : DEFAULT_STOREFRONT_ADVANCED_SETTINGS.hero.slides;
  }

  return [{
    mediaType: "image" as const,
    subtitle: subtitle || hero.subtitle,
    title: title || hero.title,
    url: hero.imageUrl || fallbackImageUrl || DEFAULT_STOREFRONT_ADVANCED_SETTINGS.hero.imageUrl || ""
  }];
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
