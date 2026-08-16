export type BottomSheetSpringOptions = {
  initialVelocity?: number;
  momentum?: boolean;
  onComplete?: () => void;
};

type ActiveAnimation = {
  frame: number;
};

const activeAnimations = new WeakMap<HTMLElement, ActiveAnimation>();

/** Project a release velocity using the exponential-decay curve used by iOS scroll physics. */
export function project(initialVelocity: number, decelerationRate = 0.998) {
  if (!Number.isFinite(initialVelocity) || initialVelocity === 0) return 0;
  const rate = Math.min(0.9999, Math.max(0.9, decelerationRate));
  return (initialVelocity / 1000) * (rate / (1 - rate));
}

/** Apply progressively stronger resistance when a sheet is pulled beyond a boundary. */
export function rubberBand(value: number, dimension: number, constant = 0.55) {
  if (!Number.isFinite(value) || value === 0) return 0;
  const size = Math.max(1, Math.abs(dimension));
  const resistance = Math.max(0.01, constant);
  const distance = Math.abs(value);
  return Math.sign(value) * ((distance * size * resistance) / (size + resistance * distance));
}

export function getSheetDragOffset(rawOffset: number, sheetHeight: number) {
  if (rawOffset >= 0) return rawOffset;
  return rubberBand(rawOffset, sheetHeight);
}

export function getProjectedSheetOffset(offset: number, velocity: number) {
  return offset + project(Math.max(0, Number.isFinite(velocity) ? velocity : 0));
}

export function shouldDismissSheet({
  offset,
  velocity,
  sheetHeight,
}: {
  offset: number;
  velocity: number;
  sheetHeight: number;
}) {
  const height = Math.max(1, sheetHeight);
  const projectedOffset = getProjectedSheetOffset(offset, velocity);
  const distanceThreshold = Math.min(Math.max(height * 0.45, 144), 360);
  return projectedOffset >= distanceThreshold || (velocity >= 700 && offset >= 18);
}

function readTransformY(sheet: HTMLElement) {
  const transform = window.getComputedStyle(sheet).transform;
  if (!transform || transform === "none") return 0;
  const matrix3d = transform.match(/^matrix3d\((.+)\)$/);
  if (matrix3d) return Number.parseFloat(matrix3d[1].split(",")[13] ?? "0") || 0;
  const matrix = transform.match(/^matrix\((.+)\)$/);
  if (matrix) return Number.parseFloat(matrix[1].split(",")[5] ?? "0") || 0;
  return 0;
}

export function stopBottomSheetAnimation(sheet: HTMLElement) {
  const currentOffset = readTransformY(sheet);
  const active = activeAnimations.get(sheet);
  if (active) {
    window.cancelAnimationFrame(active.frame);
    activeAnimations.delete(sheet);
  }
  sheet.style.animation = "none";
  sheet.style.transform = `translate3d(0, ${currentOffset}px, 0)`;
  return currentOffset;
}

export function setBottomSheetPosition(sheet: HTMLElement, offset: number, sheetHeight: number) {
  const opacity = Math.max(0.92, 1 - Math.max(0, offset) / Math.max(1, sheetHeight) * 0.08);
  sheet.style.transform = `translate3d(0, ${offset}px, 0)`;
  sheet.style.opacity = String(opacity);
}

export function animateBottomSheet(
  sheet: HTMLElement,
  target: number,
  { initialVelocity = 0, momentum = false, onComplete }: BottomSheetSpringOptions = {},
) {
  const previous = activeAnimations.get(sheet);
  if (previous) window.cancelAnimationFrame(previous.frame);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const start = readTransformY(sheet);
  const destination = Math.max(0, target);

  if (reducedMotion) {
    sheet.style.transform = `translate3d(0, ${destination}px, 0)`;
    sheet.style.opacity = destination > 0 ? "0" : "1";
    onComplete?.();
    return;
  }

  let position = start;
  let velocity = Number.isFinite(initialVelocity) ? initialVelocity : 0;
  let previousTime = performance.now();
  const stiffness = momentum ? 280 : 300;
  const damping = momentum ? 29 : 2 * Math.sqrt(stiffness);

  const tick = (time: number) => {
    const delta = Math.min(0.032, Math.max(0.001, (time - previousTime) / 1000));
    previousTime = time;
    const acceleration = (destination - position) * stiffness - velocity * damping;
    velocity += acceleration * delta;
    position += velocity * delta;
    const settled = Math.abs(destination - position) < 0.5 && Math.abs(velocity) < 8;
    const progress = start === destination ? 1 : Math.min(1, Math.abs((position - start) / (destination - start)));
    sheet.style.transform = `translate3d(0, ${settled ? destination : position}px, 0)`;
    sheet.style.opacity = String(destination > 0 ? Math.max(0, 1 - progress) : Math.min(1, 0.92 + progress * 0.08));

    if (settled) {
      activeAnimations.delete(sheet);
      sheet.style.removeProperty("will-change");
      onComplete?.();
      return;
    }

    const frame = window.requestAnimationFrame(tick);
    activeAnimations.set(sheet, { frame });
  };

  const frame = window.requestAnimationFrame(tick);
  activeAnimations.set(sheet, { frame });
}
