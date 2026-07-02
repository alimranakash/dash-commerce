"use client";

import { useState } from "react";

type StorefrontImageProps = {
  alt: string;
  fallback: string;
  src?: string | null | undefined;
};

export function StorefrontImage({ alt, fallback, src }: StorefrontImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <span>{fallback}</span>;
  }

  return <img alt={alt} decoding="async" loading="lazy" onError={() => setFailed(true)} src={src} />;
}
