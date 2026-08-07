import { AnalyticsDetail } from "@/components/analytics/analytics-detail";
import { OnboardingGate } from "@/components/auth/onboarding-gate";

export default function ExpandedExpenseAnalyticsPage() {
  return (
    <OnboardingGate>
      <AnalyticsDetail type="expenses" expanded />
    </OnboardingGate>
  );
}
