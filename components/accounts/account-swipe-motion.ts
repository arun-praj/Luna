const DEFAULT_DECELERATION_RATE = 0.998;

/** Project a horizontal release velocity into the card's likely resting point. */
export function projectAccountSwipe(
  initialVelocity: number,
  decelerationRate = DEFAULT_DECELERATION_RATE,
) {
  if (!Number.isFinite(initialVelocity) || initialVelocity === 0) return 0;
  const rate = Math.min(0.9999, Math.max(0.9, decelerationRate));
  return (initialVelocity / 1000) * (rate / (1 - rate));
}

/** Add resistance when the user pulls beyond either swipe boundary. */
export function rubberBandAccountSwipe(value: number, dimension: number, constant = 0.55) {
  if (!Number.isFinite(value) || value === 0) return 0;
  const size = Math.max(1, Math.abs(dimension));
  const resistance = Math.max(0.01, constant);
  const distance = Math.abs(value);
  return Math.sign(value) * ((distance * size * resistance) / (size + resistance * distance));
}

export function getAccountSwipeDragOffset(rawOffset: number, actionWidth: number) {
  const width = Math.max(1, actionWidth);
  if (rawOffset < 0) return rubberBandAccountSwipe(rawOffset, width);
  if (rawOffset > width) return width + rubberBandAccountSwipe(rawOffset - width, width);
  return rawOffset;
}

export function getProjectedAccountSwipeOffset(offset: number, velocity: number) {
  return offset + projectAccountSwipe(Number.isFinite(velocity) ? velocity : 0);
}

export function shouldOpenAccountSwipe({
  offset,
  velocity,
  actionWidth,
}: {
  offset: number;
  velocity: number;
  actionWidth: number;
}) {
  const width = Math.max(1, actionWidth);
  const projectedOffset = getProjectedAccountSwipeOffset(offset, velocity);
  const distanceThreshold = width * 0.5;
  return projectedOffset >= distanceThreshold || (velocity >= 700 && offset >= 12);
}
