export const TWO_FACTOR_MAX_ATTEMPTS = 5;

export function canRecordTwoFactorChallengeAttempt(attempts: number) {
  return attempts >= 0 && attempts < TWO_FACTOR_MAX_ATTEMPTS;
}

export function isConsumedTwoFactorChallenge(attempts: number) {
  return attempts > TWO_FACTOR_MAX_ATTEMPTS;
}
