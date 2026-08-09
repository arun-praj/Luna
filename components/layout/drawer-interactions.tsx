"use client";

import { useEffect } from "react";

const HANDLE_HEIGHT = 36;
const MIN_FLING_DISTANCE = 28;
const DISMISS_DISTANCE = 88;
const DISMISS_VELOCITY = 0.55;

type DragState = {
  pointerId: number;
  sheet: HTMLElement;
  startY: number;
  lastY: number;
  lastTime: number;
};

function findBottomDrawer(target: EventTarget | null, clientY: number) {
  if (!(target instanceof Element)) return null;
  const sheet = target.closest<HTMLElement>('[class*="rounded-t-"]');
  if (!sheet) return null;
  const rect = sheet.getBoundingClientRect();
  if (rect.bottom < window.innerHeight - 4 || clientY > rect.top + HANDLE_HEIGHT) return null;
  return sheet;
}

function closeDrawer(sheet: HTMLElement) {
  const closeButton = sheet.querySelector<HTMLButtonElement>('button[aria-label^="Close" i]');
  if (closeButton) {
    closeButton.click();
    return;
  }
  const backdrop = sheet.parentElement;
  if (backdrop instanceof HTMLElement) backdrop.click();
}

export function DrawerInteractions() {
  useEffect(() => {
    let drag: DragState | null = null;
    let resetTimer: number | null = null;

    function clearSheetStyle(sheet: HTMLElement) {
      sheet.style.removeProperty("transition");
      sheet.style.removeProperty("transform");
      sheet.style.removeProperty("will-change");
    }

    function onPointerDown(event: PointerEvent) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const sheet = findBottomDrawer(event.target, event.clientY);
      if (!sheet) return;
      if (resetTimer !== null) window.clearTimeout(resetTimer);
      drag = {
        pointerId: event.pointerId,
        sheet,
        startY: event.clientY,
        lastY: event.clientY,
        lastTime: event.timeStamp,
      };
      sheet.style.willChange = "transform";
      sheet.style.transition = "none";
    }

    function onPointerMove(event: PointerEvent) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const distance = Math.max(0, event.clientY - drag.startY);
      if (distance > 0) event.preventDefault();
      drag.sheet.style.transform = `translate3d(0, ${distance}px, 0)`;
      drag.lastY = event.clientY;
      drag.lastTime = event.timeStamp;
    }

    function finishDrag(event: PointerEvent) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const current = drag;
      drag = null;
      const distance = Math.max(0, event.clientY - current.startY);
      const elapsed = Math.max(1, event.timeStamp - current.lastTime);
      const velocity = Math.max(0, event.clientY - current.lastY) / elapsed;
      const shouldDismiss = distance >= DISMISS_DISTANCE || (distance >= MIN_FLING_DISTANCE && velocity >= DISMISS_VELOCITY);

      if (shouldDismiss) {
        clearSheetStyle(current.sheet);
        closeDrawer(current.sheet);
        return;
      }

      current.sheet.style.transition = "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)";
      current.sheet.style.transform = "translate3d(0, 0, 0)";
      resetTimer = window.setTimeout(() => {
        clearSheetStyle(current.sheet);
        resetTimer = null;
      }, 190);
    }

    window.addEventListener("pointerdown", onPointerDown, { capture: true });
    window.addEventListener("pointermove", onPointerMove, { capture: true, passive: false });
    window.addEventListener("pointerup", finishDrag, { capture: true });
    window.addEventListener("pointercancel", finishDrag, { capture: true });
    return () => {
      if (resetTimer !== null) window.clearTimeout(resetTimer);
      window.removeEventListener("pointerdown", onPointerDown, { capture: true });
      window.removeEventListener("pointermove", onPointerMove, { capture: true });
      window.removeEventListener("pointerup", finishDrag, { capture: true });
      window.removeEventListener("pointercancel", finishDrag, { capture: true });
    };
  }, []);

  return null;
}
