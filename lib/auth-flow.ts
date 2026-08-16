export const REGISTRATION_HANDOFF_DELAY_MS = 1_000;

/**
 * Returns the time still needed before signup can hand the user to the
 * verification screen. A slow API response naturally uses the whole window,
 * while a fast response still gives the user a stable one-second loading state.
 */
export function remainingRegistrationHandoffMs(
  startedAt: number,
  now = Date.now(),
  minimumDuration = REGISTRATION_HANDOFF_DELAY_MS,
) {
  return Math.max(0, minimumDuration - Math.max(0, now - startedAt));
}

export async function waitForRegistrationHandoff(startedAt: number) {
  const remaining = remainingRegistrationHandoffMs(startedAt);
  if (remaining === 0) return;
  await new Promise<void>((resolve) => window.setTimeout(resolve, remaining));
}
