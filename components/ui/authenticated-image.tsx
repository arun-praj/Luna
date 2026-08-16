"use client";

import Image from "next/image";
import { type ReactNode, useEffect, useState } from "react";

import { authenticatedFetch } from "@/lib/auth-client";

function isProtectedUpload(src: string) {
  return src.startsWith("/api/uploads/account-images/")
    || src.startsWith("/api/uploads/savings-images/")
    || src.startsWith("/api/uploads/transaction-receipts/");
}

type AuthenticatedImageProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  fallback?: ReactNode;
  unoptimized?: boolean;
  "aria-hidden"?: boolean | "true" | "false";
};

export function AuthenticatedImage({ src, alt, width, height, className, fallback, unoptimized, "aria-hidden": ariaHidden }: AuthenticatedImageProps) {
  const [loadedImage, setLoadedImage] = useState<{ source: string; url: string } | null>(null);
  const [failedImage, setFailedImage] = useState<string | null>(null);

  useEffect(() => {
    if (!isProtectedUpload(src)) return;

    const controller = new AbortController();
    let objectUrl: string | null = null;
    void authenticatedFetch(src, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          setFailedImage(src);
          return;
        }
        objectUrl = URL.createObjectURL(await response.blob());
        setLoadedImage({ source: src, url: objectUrl });
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailedImage(src);
      });

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
  const loadFailed = failedImage === src;

  if (loadFailed && fallback) return <>{fallback}</>;

  if (!resolvedSrc) {
    return <span aria-hidden="true" className={`${className ?? ""} bg-surface-subtle`} style={{ width, height }} />;
  }

  return <Image src={resolvedSrc} alt={alt} width={width} height={height} className={className} unoptimized={unoptimized ?? true} aria-hidden={ariaHidden} />;
}
