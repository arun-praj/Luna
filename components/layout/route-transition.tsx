"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const EXIT_DURATION_MS = 140;
const PENDING_FALLBACK_MS = 1800;

function isModifiedClick(event: MouseEvent) {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

export function RouteTransition() {
  const router = useRouter();
  const pathname = usePathname();
  const isNavigating = useRef(false);
  const timer = useRef<number | null>(null);
  const pendingTimer = useRef<number | null>(null);
  const prefetchedDestinations = useRef(new Set<string>());
  const [isPending, setIsPending] = useState(false);

  const prefetchLink = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Element)) return;

    const link = target.closest("a[href]");
    if (!(link instanceof HTMLAnchorElement)) return;
    if (
      link.target === "_blank" ||
      link.hasAttribute("download") ||
      link.getAttribute("aria-disabled") === "true"
    ) {
      return;
    }

    const destination = new URL(link.href, window.location.href);
    if (
      destination.origin !== window.location.origin ||
      destination.pathname.startsWith("/api/") ||
      (destination.pathname === window.location.pathname &&
        destination.search === window.location.search)
    ) {
      return;
    }

    const href = `${destination.pathname}${destination.search}${destination.hash}`;
    if (prefetchedDestinations.current.has(href)) return;

    prefetchedDestinations.current.add(href);
    router.prefetch(href);
  }, [router]);

  const showPending = () => {
    setIsPending(true);
    if (pendingTimer.current !== null) window.clearTimeout(pendingTimer.current);
    pendingTimer.current = window.setTimeout(() => {
      pendingTimer.current = null;
      setIsPending(false);
    }, PENDING_FALLBACK_MS);
  };

  useEffect(() => {
    if (pendingTimer.current !== null) {
      window.clearTimeout(pendingTimer.current);
      pendingTimer.current = null;
    }

    const frame = window.requestAnimationFrame(() => setIsPending(false));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    if (document.body.dataset.routeTransition !== "return") {
      return;
    }

    let frame: number | null = null;
    let attempts = 0;
    const clearProfileReturn = () => {
      const main = document.querySelector("main");
      const destinationHasEntryClass =
        main?.classList.contains("page-route-enter") ||
        main?.classList.contains("profile-route-enter");
      const destinationHasExitClass =
        main?.classList.contains("page-route-exit") ||
        main?.classList.contains("profile-route-exit");
      if (destinationHasEntryClass || destinationHasExitClass || attempts >= 180) {
        main?.classList.remove(
          "page-route-enter",
          "profile-route-enter",
          "page-route-exit",
          "profile-route-exit",
        );
        delete document.body.dataset.routeTransition;
        return;
      }

      attempts += 1;
      frame = window.requestAnimationFrame(clearProfileReturn);
    };

    frame = window.requestAnimationFrame(clearProfileReturn);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  useEffect(() => {
    const handlePointerOver = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;

      const link = event.target instanceof Element
        ? event.target.closest("a[href]")
        : null;
      const relatedTarget = event.relatedTarget;
      if (
        link instanceof HTMLAnchorElement &&
        relatedTarget instanceof Node &&
        link.contains(relatedTarget)
      ) {
        return;
      }

      prefetchLink(event.target);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") prefetchLink(event.target);
    };

    const handleFocusIn = (event: FocusEvent) => {
      prefetchLink(event.target);
    };

    const handleClick = (event: MouseEvent) => {
      if (isModifiedClick(event) || event.defaultPrevented) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (
        link.target === "_blank" ||
        link.hasAttribute("download") ||
        link.getAttribute("aria-disabled") === "true"
      ) {
        return;
      }

      const destination = new URL(link.href, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        destination.pathname === window.location.pathname &&
          destination.search === window.location.search
      ) {
        return;
      }

      if (isNavigating.current) {
        event.preventDefault();
        return;
      }

      const main = document.querySelector("main");
      if (!main) return;

      const ariaLabel = link.getAttribute("aria-label")?.toLowerCase() ?? "";
      const isBackNavigation =
        link.dataset.routeDirection === "back" ||
        /^(back|cancel|close)\b/.test(ariaLabel) ||
        ariaLabel.includes("return") ||
        ariaLabel === "go to luna home" || ariaLabel === "go to budget home";

      event.preventDefault();
      event.stopPropagation();

      // Forward navigation behaves like opening a drawer: keep the current
      // surface still while the destination surface enters.
      if (!isBackNavigation) {
        isNavigating.current = true;
        showPending();
        void router.push(`${destination.pathname}${destination.search}${destination.hash}`);
        isNavigating.current = false;
        return;
      }

      isNavigating.current = true;
      showPending();
      const leavingProfile = window.location.pathname === "/profile";
      main.classList.remove("profile-route-enter", "page-route-enter");
      main.classList.add(leavingProfile ? "profile-route-exit" : "page-route-exit");
      document.body.dataset.routeTransition = "return";

      timer.current = window.setTimeout(() => {
        isNavigating.current = false;
        timer.current = null;
        void router.push(`${destination.pathname}${destination.search}${destination.hash}`);
      }, EXIT_DURATION_MS);
    };

    document.addEventListener("pointerover", handlePointerOver, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("pointerover", handlePointerOver, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("focusin", handleFocusIn, true);
      document.removeEventListener("click", handleClick, true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      if (pendingTimer.current !== null) window.clearTimeout(pendingTimer.current);
      isNavigating.current = false;
    };
  }, [prefetchLink, router]);

  return isPending ? (
    <div
      aria-label="Loading page"
      className="route-navigation-progress"
      role="status"
    >
      <span aria-hidden="true" />
    </div>
  ) : null;
}
