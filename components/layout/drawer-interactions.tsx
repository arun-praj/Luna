"use client";

import { useEffect } from "react";
import {
  animateBottomSheet,
  getSheetDragOffset,
  setBottomSheetPosition,
  shouldDismissSheet,
  stopBottomSheetAnimation,
} from "@/components/layout/bottom-sheet-motion";

type Position = { y: number; time: number };
type DragState = {
  pointerId: number;
  sheet: HTMLElement;
  handle: HTMLElement;
  startY: number;
  startOffset: number;
  sheetHeight: number;
  history: Position[];
};

function findOptedInSheet(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  const handle = target.closest<HTMLElement>("[data-luna-bottom-sheet-handle]");
  const sheet = handle?.closest<HTMLElement>("[data-luna-bottom-sheet]");
  if (!handle || !sheet) return null;
  return { handle, sheet };
}

function releasePointerCapture(handle: HTMLElement, pointerId: number) {
  if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
}

function dismissSheet(sheet: HTMLElement) {
  const closeTarget = sheet.querySelector<HTMLElement>("[data-luna-bottom-sheet-close]");
  if (closeTarget) {
    closeTarget.click();
    return;
  }
  sheet.dispatchEvent(new CustomEvent("luna:bottom-sheet-dismiss", { bubbles: true }));
}

export function DrawerInteractions() {
  useEffect(() => {
    let drag: DragState | null = null;

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const match = findOptedInSheet(event.target);
      if (!match) return;

      const { handle, sheet } = match;
      const startOffset = stopBottomSheetAnimation(sheet);
      sheet.dataset.lunaBottomSheetSettled = "true";
      sheet.style.willChange = "transform, opacity";
      try {
        handle.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is not available in a few embedded webviews; window listeners still continue the gesture.
      }
      event.preventDefault();
      drag = {
        pointerId: event.pointerId,
        sheet,
        handle,
        startY: event.clientY,
        startOffset,
        sheetHeight: Math.max(1, sheet.getBoundingClientRect().height),
        history: [{ y: event.clientY, time: event.timeStamp }],
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const rawOffset = drag.startOffset + event.clientY - drag.startY;
      const offset = getSheetDragOffset(rawOffset, drag.sheetHeight);
      setBottomSheetPosition(drag.sheet, offset, drag.sheetHeight);
      drag.history.push({ y: event.clientY, time: event.timeStamp });
      if (drag.history.length > 6) drag.history.shift();
      event.preventDefault();
    };

    const finishDrag = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const current = drag;
      drag = null;
      const last = current.history[current.history.length - 1] ?? { y: event.clientY, time: event.timeStamp };
      const first = current.history[Math.max(0, current.history.length - 5)] ?? last;
      const elapsedSeconds = Math.max(0.001, (last.time - first.time) / 1000);
      const velocity = (last.y - first.y) / elapsedSeconds;
      const rawOffset = current.startOffset + event.clientY - current.startY;
      const offset = getSheetDragOffset(rawOffset, current.sheetHeight);
      const dismiss = event.type !== "pointercancel" && shouldDismissSheet({ offset, velocity, sheetHeight: current.sheetHeight });

      releasePointerCapture(current.handle, current.pointerId);
      if (dismiss) {
        animateBottomSheet(current.sheet, current.sheetHeight, {
          initialVelocity: Math.max(0, velocity),
          momentum: velocity >= 700,
          onComplete: () => dismissSheet(current.sheet),
        });
      } else {
        animateBottomSheet(current.sheet, 0, { initialVelocity: velocity });
      }
    };

    window.addEventListener("pointerdown", onPointerDown, { capture: true });
    window.addEventListener("pointermove", onPointerMove, { capture: true, passive: false });
    window.addEventListener("pointerup", finishDrag, { capture: true });
    window.addEventListener("pointercancel", finishDrag, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, { capture: true });
      window.removeEventListener("pointermove", onPointerMove, { capture: true });
      window.removeEventListener("pointerup", finishDrag, { capture: true });
      window.removeEventListener("pointercancel", finishDrag, { capture: true });
    };
  }, []);

  return null;
}
