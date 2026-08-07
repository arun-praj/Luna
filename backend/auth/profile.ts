import type { User } from "../db/schema";

/** Fields safe to return to a client. Never serialize passwordHash or auth state. */
export type PublicUserProfile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  currency: string;
  monthlyReportEnabled: boolean;
  onboardingCompleted: boolean;
  tutorialStartedAt: string | null;
  tutorialCompletedAt: string | null;
  otpEnabled: boolean;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  lastLoginAt: string | null;
  avatarPreset: string;
  createdAt: string;
};

export function toPublicUserProfile(user: User): PublicUserProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    currency: user.currency,
    monthlyReportEnabled: user.monthlyReportEnabled,
    onboardingCompleted: user.onboardingCompleted,
    tutorialStartedAt: user.tutorialStartedAt ?? null,
    tutorialCompletedAt: user.tutorialCompletedAt ?? null,
    otpEnabled: user.otpEnabled,
    emailVerifiedAt: user.emailVerifiedAt ?? null,
    phoneVerifiedAt: user.phoneVerifiedAt ?? null,
    lastLoginAt: user.lastLoginAt ?? null,
    avatarPreset: user.avatarPreset,
    createdAt: user.createdAt,
  };
}
