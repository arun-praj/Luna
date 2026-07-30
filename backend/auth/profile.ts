import type { User } from "../db/schema";

/** Fields safe to return to a client. Never serialize passwordHash or auth state. */
export type PublicUserProfile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  currency: string;
  otpEnabled: boolean;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  createdAt: string;
};

export function toPublicUserProfile(user: User): PublicUserProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    currency: user.currency,
    otpEnabled: user.otpEnabled,
    emailVerifiedAt: user.emailVerifiedAt ?? null,
    phoneVerifiedAt: user.phoneVerifiedAt ?? null,
    createdAt: user.createdAt,
  };
}
