"use client";

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
  storeSlug,
  subtitle,
  title
}: FashionHeroSliderProps) {
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
    "--fashion-hero-overlay": hexToRgb(hero.overlayColor || "#000000"),
    "--fashion-hero-overlay-opacity": String((hero.overlayOpacity || 28) / 100),
    "--fashion-hero-text": hero.textColor || "#ffffff"
  } as CSSProperties;
  const primaryButtonText = hero.button1Text && hero.button1Text !== "Shop Now"
    ? hero.button1Text
    : "SHOP SWIMWEAR";

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
    <section className="fashion-hero" style={heroStyle} aria-labelledby="fashion-hero-title">
      <FashionHeroMedia slide={currentSlide} />
      <div className="fashion-hero-overlay" />
      <div className="fashion-hero-copy">
        <p>{currentSlide.subtitle || "THAT FEEL GOOD FIT"}</p>
        <h1 id="fashion-hero-title">{currentSlide.title || "Iconic style,\nmaximum heat."}</h1>
        <Link href={resolveHeroHref(storeSlug, hero.button1Link)}>{primaryButtonText}</Link>
      </div>
      {hero.showDots && (isSlider || slides.length > 1) ? (
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
      ) : (
        <div className="fashion-hero-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
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

  return <img alt={slide.title || "Fashion collection"} className="fashion-hero-media" loading="eager" onError={() => setFailed(true)} src={slide.url} />;
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
          ? configuredImageUrl || fallbackImageUrl || "/demo-assets/fashion/hero/hero-01.webp"
          : slide.url
      }))
      : [{
        mediaType: "image",
        subtitle: fallbackSubtitle,
        title: fallbackTitle,
        url: configuredImageUrl || fallbackImageUrl || "/demo-assets/fashion/hero/hero-01.webp"
      }];
  }

  return [{
    mediaType: "image",
    subtitle: fallbackSubtitle,
    title: fallbackTitle,
    url: configuredImageUrl || fallbackImageUrl || "/demo-assets/fashion/hero/hero-01.webp"
  }];
}

function resolveHeroHref(storeSlug: string, path: string) {
  if (path.startsWith("http")) {
    return path;
  }

  return `/s/${storeSlug}${path === "/" ? "" : path.startsWith("/") ? path : `/${path}`}`;
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
