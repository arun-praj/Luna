"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { authenticatedFetch } from "@/lib/auth-client";

function isProtectedUpload(src: string) {
  return src.startsWith("/api/uploads/account-images/") || src.startsWith("/api/uploads/savings-images/");
}

type AuthenticatedImageProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  unoptimized?: boolean;
  "aria-hidden"?: boolean | "true" | "false";
};

export function AuthenticatedImage({ src, alt, width, height, className, unoptimized, "aria-hidden": ariaHidden }: AuthenticatedImageProps) {
  const [loadedImage, setLoadedImage] = useState<{ source: string; url: string } | null>(null);

  useEffect(() => {
    if (!isProtectedUpload(src)) return;

    const controller = new AbortController();
    let objectUrl: string | null = null;
    void authenticatedFetch(src, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        objectUrl = URL.createObjectURL(await response.blob());
        setLoadedImage({ source: src, url: objectUrl });
      })
      .catch(() => undefined);

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  const protectedUpload = isProtectedUpload(src);
  const resolvedSrc = protectedUpload
    ? loadedImage?.source === src
      ? loadedImage.url
      : null
    : src;

  if (!resolvedSrc) {
    return <span aria-hidden="true" className={`${className ?? ""} bg-surface-subtle`} style={{ width, height }} />;
  }

  return <Image src={resolvedSrc} alt={alt} width={width} height={height} className={className} unoptimized={unoptimized ?? true} aria-hidden={ariaHidden} />;
}
