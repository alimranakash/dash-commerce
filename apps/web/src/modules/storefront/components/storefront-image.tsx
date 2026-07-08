"use client";

import { useEffect, useState } from "react";

type StorefrontImageProps = {
  alt: string;
  fallback: string;
  loading?: "eager" | "lazy";
  src?: string | null | undefined;
};

export function StorefrontImage({ alt, fallback, loading = "lazy", src }: StorefrontImageProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [src]);

  if (!src || failed) {
    return <span>{fallback}</span>;
  }

  return (
    <>
      {!loaded ? <span>{fallback}</span> : null}
      <img
        alt={alt}
        decoding="async"
        loading={loading}
        onError={() => setFailed(true)}
        onLoad={() => setLoaded(true)}
        src={src}
        style={loaded ? undefined : { display: "none" }}
      />
    </>
  );
}
