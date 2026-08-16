export function canRecoverUnverifiedSignup(
  user: { emailVerifiedAt?: string | null } | null | undefined,
  passwordMatches: boolean,
) {
  return Boolean(user && !user.emailVerifiedAt && passwordMatches);
}
