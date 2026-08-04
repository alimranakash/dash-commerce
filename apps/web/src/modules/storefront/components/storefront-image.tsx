"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type StorefrontImageProps = {
  alt: string;
  fallback: string;
  loading?: "eager" | "lazy";
  src?: string | null | undefined;
};

export function StorefrontImage({ alt, fallback, loading = "lazy", src }: StorefrontImageProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setFailed(false);
    setLoaded(imageRef.current?.complete === true && imageRef.current.naturalWidth > 0);
  }, [src]);

  // The image is hidden until it loads, so a cached image can finish before React
  // attaches onLoad; re-check `complete` whenever the element is mounted.
  const attachImage = useCallback((node: HTMLImageElement | null) => {
    imageRef.current = node;
    if (node?.complete && node.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  if (!src || failed) {
    return <span>{fallback}</span>;
  }

  return (
    <>
      {!loaded ? <span>{fallback}</span> : null}
      <img
        alt={alt}
        decoding="async"
        loading={loaded ? loading : "eager"}
        onError={() => setFailed(true)}
        onLoad={() => setLoaded(true)}
        ref={attachImage}
        src={src}
        style={loaded ? undefined : { display: "none" }}
      />
    </>
  );
}
