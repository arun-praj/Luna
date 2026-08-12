export function shouldEvaluateBiometricLockForEntry(input: {
  isPublicPath: boolean;
  userId: string | null;
  initializedUserId: string | null;
}) {
  if (input.isPublicPath || !input.userId) return false;
  return input.initializedUserId !== input.userId;
}
