import { notFound } from "next/navigation";

import { OnboardingGate } from "@/components/auth/onboarding-gate";
import { AnalyticsDetail } from "@/components/analytics/analytics-detail";

const analyticsTypes = ["income", "expenses", "savings"] as const;

export default async function AnalyticsTypePage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!analyticsTypes.includes(type as (typeof analyticsTypes)[number])) notFound();
  return (
    <OnboardingGate>
      <AnalyticsDetail type={type as (typeof analyticsTypes)[number]} />
    </OnboardingGate>
  );
}
